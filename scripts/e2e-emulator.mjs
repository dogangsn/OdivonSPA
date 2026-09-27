// End-to-end smoke test against the Firebase emulators + the local Express server (also exercises
// firestore.rules). Run: npm run test:e2e   (wraps `firebase emulators:exec`, needs Java on PATH)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, doc, getDoc, getDocs, updateDoc, writeBatch, serverTimestamp, increment, runTransaction, Timestamp } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT ?? 8787);
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;
const CRON_SECRET = 'e2e-test-secret';

const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'odivonspa', apiKey: 'fake-api-key' });
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true });
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
connectFirestoreEmulator(db, fsHost, Number(fsPort));

/** Maps a legacy callable name + payload to the equivalent server/ route. */
function routeFor(name, data) {
  switch (name) {
    case 'createTenant':
      return { method: 'POST', path: '/api/tenants', body: data };
    case 'inviteStaffUser':
      return { method: 'POST', path: '/api/staff/invite', body: data };
    case 'setStaffRole':
      return { method: 'PATCH', path: `/api/staff/${data.staffId}/role`, body: { role: data.role } };
    case 'deactivateStaffUser':
      return { method: 'POST', path: `/api/staff/${data.staffId}/deactivate`, body: {} };
    case 'saveAppointment':
      return { method: 'POST', path: '/api/appointments', body: data };
    case 'sellPackage':
      return { method: 'POST', path: '/api/packages/sell', body: data };
    case 'checkoutSession':
      return { method: 'POST', path: '/api/pos/checkout-session', body: data };
    case 'createPayment':
      return { method: 'POST', path: '/api/payments', body: data };
    case 'refundPayment':
      return { method: 'POST', path: `/api/payments/${data.paymentId}/refund`, body: { reason: data.reason } };
    case 'payoutCommissions':
      return { method: 'POST', path: '/api/commissions/payout', body: data };
    case 'closeCashRegisterDay':
      return { method: 'POST', path: `/api/cash-register-days/${data.date}/close`, body: {} };
    case 'reopenCashRegisterDay':
      return { method: 'POST', path: `/api/cash-register-days/${data.date}/reopen`, body: { reason: data.reason } };
    default:
      throw new Error(`Unknown callable: ${name}`);
  }
}

const call = async (name, data) => {
  const { method, path: urlPath, body } = routeFor(name, data);
  const token = await auth.currentUser.getIdToken();
  const resp = await fetch(`${SERVER_URL}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  });
  const json = await resp.json();
  if (!resp.ok) {
    const err = new Error(json.message ?? `request failed (${resp.status})`);
    err.code = json.code;
    throw err;
  }
  return json;
};
const fails = async (promise, code) => {
  await assert.rejects(promise, (e) => (e.code ?? '').includes(code), `expected ${code}`);
};
const step = (msg) => console.log(`✔ ${msg}`);

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(`${SERVER_URL}/health`);
      if (resp.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not become healthy in time');
}

async function main() {
  const server = spawn('node', [path.join(__dirname, '..', 'server', 'dist', 'index.js')], {
    env: { ...process.env, PORT: String(SERVER_PORT), ALLOWED_ORIGINS: 'http://localhost:4200', CRON_SECRET },
    stdio: 'inherit',
  });

  try {
    await waitForHealth();
    step('local server up');
    await runChecks();
  } finally {
    server.kill();
  }
}

async function runChecks() {
  // --- onboarding ---
  const email = `owner-${Date.now()}@test.local`;
  await createUserWithEmailAndPassword(auth, email, 'Test1234!');
  const { tenantId } = await call('createTenant', { businessName: 'Test Spa', ownerName: 'Owner' });
  await auth.currentUser.getIdToken(true);
  step(`tenant created (${tenantId})`);

  const col = (name) => collection(db, `tenants/${tenantId}/${name}`);

  // Mirrors FirestoreCrudService: every client write is batched with its own auditLogs entry.
  const logEntry = (entity, action, entityId, after) => ({
    entity, action, entityId, before: null, after, userId: auth.currentUser.uid, userEmail: email, createdAt: serverTimestamp(),
  });
  const auditedAdd = async (name, data) => {
    const ref = doc(col(name));
    const log = doc(col('auditLogs'));
    const batch = writeBatch(db);
    batch.set(ref, { ...data, auditId: log.id });
    batch.set(log, logEntry(name, 'create', ref.id, data));
    await batch.commit();
    return { id: ref.id };
  };
  const auditedUpdate = async (name, id, patch) => {
    const log = doc(col('auditLogs'));
    const batch = writeBatch(db);
    batch.update(doc(col(name), id), { ...patch, auditId: log.id });
    batch.set(log, logEntry(name, 'update', id, patch));
    await batch.commit();
  };
  const auditedDelete = async (name, id) => {
    const batch = writeBatch(db);
    batch.delete(doc(col(name), id));
    batch.set(doc(col('auditLogs'), `del-${name}-${id}`), logEntry(name, 'delete', id, null));
    await batch.commit();
  };

  // --- catalog + customer via rules-protected client writes ---
  const room = (await auditedAdd('rooms', { ad: 'Oda 1', kapasite: 1, active: true })).id;
  const service = (await auditedAdd('services', { ad: 'Klasik Masaj', tur: 'Masaj', kategori: 'Masaj', sureDk: 60, fiyat: 600, uygunStaffIds: [], active: true })).id;
  const customer = (await auditedAdd('customers', { ad: 'Ayşe', telefon: '0532', cinsiyet: 'kadin', etiketler: [], kvkkOnay: true, active: true })).id;
  await auditedAdd('commissionRules', { scope: 'service', refId: service, type: 'percent', value: 20, priority: 1, active: true });
  const plan = (await auditedAdd('packagePlans', { ad: '5 Seans', serviceId: service, seansAdedi: 5, fiyat: 1000, gecerlilikGunu: 90, active: true })).id;
  await assert.rejects(addDoc(col('customers'), { ad: 'Kayıtsız', active: true }), /permission|PERMISSION/i);
  await assert.rejects(
    (async () => {
      const b = writeBatch(db);
      const ref = doc(col('customers'));
      const log = doc(col('auditLogs'));
      b.set(ref, { ad: 'Sahte', active: true, auditId: log.id });
      b.set(log, { ...logEntry('customers', 'create', ref.id, null), userId: 'someone-else' });
      await b.commit();
    })(),
    /permission|PERMISSION/i,
  );
  await auditedUpdate('customers', customer, { telefon: '0533' });
  const tempRoom = (await auditedAdd('rooms', { ad: 'Geçici', kapasite: 1, active: true })).id;
  await assert.rejects(
    (async () => { const b = writeBatch(db); b.delete(doc(col('rooms'), tempRoom)); await b.commit(); })(),
    /permission|PERMISSION/i,
  );
  await auditedDelete('rooms', tempRoom);
  const logs = (await getDocs(col('auditLogs'))).docs.map((d) => d.data());
  assert.ok(logs.some((l) => l.entity === 'customers' && l.action === 'update' && l.entityId === customer));
  assert.ok(logs.some((l) => l.entity === 'rooms' && l.action === 'delete' && l.entityId === tempRoom));
  step('catalog written under rules; writes without (or with a forged) audit entry denied; update/delete logged');

  // --- direct appointment create must be blocked; server route enforces overlap ---
  await assert.rejects(addDoc(col('appointments'), { staffId: 'x' }), /permission|PERMISSION/i);
  step('direct appointment create denied by rules');

  const { staffId } = await call('inviteStaffUser', { email: `t-${Date.now()}@test.local`, ad: 'Zeynep', role: 'therapist' });
  const start = new Date(Date.UTC(2030, 0, 1, 10, 0));
  const { id: apptId } = await call('saveAppointment', { customerId: customer, staffId, roomId: room, serviceId: service, start: start.toISOString() });
  await fails(
    call('saveAppointment', { customerId: customer, staffId, roomId: room, serviceId: service, start: new Date(start.getTime() + 15 * 60000).toISOString() }),
    'failed-precondition',
  );
  step('appointment saved; overlapping one rejected');

  await auditedAdd('staffLeaves', { staffId, type: 'yillik', startDate: Timestamp.fromDate(new Date(Date.UTC(2030, 0, 5))), endDate: Timestamp.fromDate(new Date(Date.UTC(2030, 0, 6))) });
  await fails(
    call('saveAppointment', { customerId: customer, staffId, roomId: room, serviceId: service, start: new Date(Date.UTC(2030, 0, 5, 12)).toISOString() }),
    'failed-precondition',
  );
  step('appointment on staff leave rejected');

  // --- package sale must hit payments; direct create denied ---
  await assert.rejects(addDoc(col('customerPackages'), { customerId: customer }), /permission|PERMISSION/i);
  await fails(call('sellPackage', { customerId: customer, packagePlanId: plan, payments: [{ method: 'nakit', amount: 900 }] }), 'failed-precondition');
  await call('sellPackage', { customerId: customer, packagePlanId: plan, payments: [{ method: 'kart', amount: 1000 }] });
  const pkgPayments = (await getDocs(col('payments'))).docs.map((d) => d.data());
  assert.equal(pkgPayments.length, 1);
  assert.equal(pkgPayments[0].amount, 1000);
  step('package sold; 1000 TL payment recorded');

  // --- POS checkout: commission 20% of 600 = 120 ---
  const sale = await call('checkoutSession', {
    appointmentId: apptId, customerId: customer, staffId, roomId: room,
    items: [{ kind: 'service', refId: service, qty: 1 }],
    payments: [{ method: 'nakit', amount: 600 }],
  });
  assert.match(sale.receiptNo, /^S-\d{8}-0001$/);
  const accruals = (await getDocs(col('commissionAccruals'))).docs.map((d) => d.data());
  assert.equal(accruals.length, 1);
  assert.equal(accruals[0].amount, 120);
  assert.equal((await getDoc(doc(db, `tenants/${tenantId}/appointments/${apptId}`))).data().status, 'Tamamlandı');
  step(`checkout ${sale.receiptNo}; commission 120 accrued; appointment completed`);

  // --- a completed appointment is final: no status change, reschedule or second checkout ---
  const apptRef = doc(db, `tenants/${tenantId}/appointments/${apptId}`);
  const uid = auth.currentUser.uid;
  await assert.rejects(auditedUpdate('appointments', apptId, { status: 'Bekliyor', updatedBy: uid }), /permission|PERMISSION/i);
  await fails(call('saveAppointment', { id: apptId, customerId: customer, staffId, roomId: room, serviceId: service, start: start.toISOString() }), 'failed-precondition');
  await fails(
    call('checkoutSession', { appointmentId: apptId, customerId: customer, staffId, roomId: room, items: [{ kind: 'service', refId: service, qty: 1 }], payments: [{ method: 'nakit', amount: 600 }] }),
    'failed-precondition',
  );
  const { id: appt2 } = await call('saveAppointment', { customerId: customer, staffId, roomId: room, serviceId: service, start: new Date(Date.UTC(2030, 0, 2, 10)).toISOString() });
  const appt2Ref = doc(db, `tenants/${tenantId}/appointments/${appt2}`);
  await assert.rejects(auditedUpdate('appointments', appt2, { status: 'Tamamlandı', updatedBy: uid }), /permission|PERMISSION/i);
  await assert.rejects(updateDoc(appt2Ref, { status: 'Onaylandı', updatedBy: uid }), /permission|PERMISSION/i);
  await auditedUpdate('appointments', appt2, { status: 'Onaylandı', updatedBy: uid });
  step('completed appointment locked; client cannot set "Tamamlandı"; open one moves to "Onaylandı"');

  // --- staff role/active change only via the server; invite input validated ---
  await assert.rejects(auditedUpdate('staff', staffId, { role: 'admin' }), /permission|PERMISSION/i);
  await auditedUpdate('staff', staffId, { telefon: '0555' });
  await fails(call('inviteStaffUser', { email: `x-${Date.now()}@test.local`, ad: 'X', role: 'superadmin' }), 'invalid-argument');
  await fails(call('inviteStaffUser', { email, ad: 'Dup', role: 'reception' }), 'failed-precondition');
  step('direct staff role write denied; profile edit allowed; bad role and duplicate e-mail rejected');

  // --- malformed POS input must be rejected before any stock/package/money changes ---
  const product = (await auditedAdd('products', { ad: 'Yağ', fiyat: 50, mevcutStok: 5, active: true })).id;
  await assert.rejects(addDoc(col('stockMovements'), { productId: product, type: 'giris', qty: 0.5, createdBy: auth.currentUser.uid }), /permission|PERMISSION/i);
  // Same shape as ProductService.recordStockMovement: stock bump + movement + audit entry in one transaction.
  await runTransaction(db, async (tx) => {
    const log = doc(col('auditLogs'));
    tx.update(doc(col('products'), product), { mevcutStok: increment(2), auditId: log.id });
    tx.set(doc(col('stockMovements')), { productId: product, type: 'giris', qty: 2, note: null, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
    tx.set(log, logEntry('products', 'update', product, { mevcutStok: 7 }));
  });
  await runTransaction(db, async (tx) => {
    const log = doc(col('auditLogs'));
    tx.update(doc(col('products'), product), { mevcutStok: increment(-2), auditId: log.id });
    tx.set(doc(col('stockMovements')), { productId: product, type: 'fire', qty: -2, note: null, createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
    tx.set(log, logEntry('products', 'update', product, { mevcutStok: 5 }));
  });
  const posBase = { customerId: customer, staffId, roomId: room };
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: -3 }], payments: [] }), 'invalid-argument');
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 1.5 }], payments: [{ method: 'nakit', amount: 75 }] }), 'invalid-argument');
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 1, discount: -100 }], payments: [{ method: 'nakit', amount: 150 }] }), 'invalid-argument');
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 1, discount: 80 }], payments: [] }), 'invalid-argument');
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 1 }], discountAmount: 80, payments: [] }), 'invalid-argument');
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 2 }], payments: [{ method: 'nakit', amount: 150 }, { method: 'kart', amount: -50 }] }), 'invalid-argument');
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 3 }, { kind: 'product', refId: product, qty: 3 }], payments: [{ method: 'nakit', amount: 300 }] }), 'failed-precondition');
  assert.equal((await getDoc(doc(db, `tenants/${tenantId}/products/${product}`))).data().mevcutStok, 5);
  step('negative/fractional qty, bad discounts, negative payments and split-line overselling rejected; stock untouched');

  // --- manual payments go through the server; direct writes and double refunds are blocked ---
  await assert.rejects(addDoc(col('payments'), { amount: 99999, method: 'nakit', isRefund: false }), /permission|PERMISSION/i);
  await fails(call('createPayment', { method: 'nakit', amount: -10 }), 'invalid-argument');
  const { paymentId } = await call('createPayment', { customerId: customer, method: 'nakit', amount: 200, note: 'Bahşiş' });
  await call('refundPayment', { paymentId, reason: 'Test' });
  await fails(call('refundPayment', { paymentId, reason: 'Tekrar' }), 'failed-precondition');
  step('direct payment write denied; manual payment 200 recorded, refunded once, second refund rejected');

  // --- close today's register (Istanbul day): 600 session + 1000 package ---
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const closed = await call('closeCashRegisterDay', { date: today });
  assert.equal(closed.totalIncome, 1600);
  assert.equal(closed.netCash, 1600);
  step(`day ${today} closed: income 1600 (package sale included, manual payment netted by its refund)`);

  // --- a closed day is final: no new money until an admin reopens it ---
  await fails(call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 1 }], payments: [{ method: 'nakit', amount: 50 }] }), 'failed-precondition');
  await fails(call('createPayment', { method: 'kart', amount: 10 }), 'failed-precondition');
  await fails(call('sellPackage', { customerId: customer, packagePlanId: plan, payments: [{ method: 'kart', amount: 1000 }] }), 'failed-precondition');
  await fails(call('closeCashRegisterDay', { date: '2026-02-30' }), 'invalid-argument');
  await call('reopenCashRegisterDay', { date: today, reason: 'Düzeltme' });
  await call('checkoutSession', { ...posBase, items: [{ kind: 'product', refId: product, qty: 1 }], payments: [{ method: 'nakit', amount: 50 }] });
  step('closed day rejects checkout, payment and package sale; works again after reopen');

  // --- /internal/mark-expired-packages is guarded by the cron secret, not Firebase auth ---
  const resp = await fetch(`${SERVER_URL}/internal/mark-expired-packages`, { method: 'POST', headers: { 'X-Cron-Secret': CRON_SECRET } });
  assert.equal(resp.status, 200);
  step('internal mark-expired-packages endpoint reachable with cron secret');

  // --- HTTP hardening: security headers, CORS rejection and malformed bodies get proper status codes ---
  const health = await fetch(`${SERVER_URL}/health`);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-powered-by'), null);
  const badOrigin = await fetch(`${SERVER_URL}/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(badOrigin.status, 403);
  const token = await auth.currentUser.getIdToken();
  const badJson = await fetch(`${SERVER_URL}/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{not json',
  });
  assert.equal(badJson.status, 400);
  const resolved = await fetch(`${SERVER_URL}/api/membership/resolve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(resolved.status, 200);
  assert.ok(resolved.headers.get('ratelimit-policy'), 'rate limit headers present');
  step('helmet headers set; foreign origin 403; malformed JSON 400; rate limit headers present');

  console.log('\nAll e2e checks passed.');
}

// Explicit exit: the Firestore client keeps the event loop alive otherwise (test would hang on failure).
main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
