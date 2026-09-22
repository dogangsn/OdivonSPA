// End-to-end smoke test against the Firebase emulators + the local Express server (also exercises
// firestore.rules). Run: npm run test:e2e   (wraps `firebase emulators:exec`, needs Java on PATH)
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, addDoc, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';

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

  // --- catalog + customer via rules-protected client writes ---
  const room = (await addDoc(col('rooms'), { ad: 'Oda 1', kapasite: 1, active: true })).id;
  const service = (await addDoc(col('services'), { ad: 'Klasik Masaj', tur: 'Masaj', kategori: 'Masaj', sureDk: 60, fiyat: 600, uygunStaffIds: [], active: true })).id;
  const customer = (await addDoc(col('customers'), { ad: 'Ayşe', telefon: '0532', cinsiyet: 'kadin', etiketler: [], kvkkOnay: true, active: true })).id;
  await addDoc(col('commissionRules'), { scope: 'service', refId: service, type: 'percent', value: 20, priority: 1, active: true });
  const plan = (await addDoc(col('packagePlans'), { ad: '5 Seans', serviceId: service, seansAdedi: 5, fiyat: 1000, gecerlilikGunu: 90, active: true })).id;
  step('catalog written under rules');

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

  await addDoc(col('staffLeaves'), { staffId, type: 'yillik', startDate: Timestamp.fromDate(new Date(Date.UTC(2030, 0, 5))), endDate: Timestamp.fromDate(new Date(Date.UTC(2030, 0, 6))) });
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

  // --- close today's register (Istanbul day): 600 session + 1000 package ---
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const closed = await call('closeCashRegisterDay', { date: today });
  assert.equal(closed.totalIncome, 1600);
  assert.equal(closed.netCash, 1600);
  step(`day ${today} closed: income 1600 (package sale included)`);

  // --- /internal/mark-expired-packages is guarded by the cron secret, not Firebase auth ---
  const resp = await fetch(`${SERVER_URL}/internal/mark-expired-packages`, { method: 'POST', headers: { 'X-Cron-Secret': CRON_SECRET } });
  assert.equal(resp.status, 200);
  step('internal mark-expired-packages endpoint reachable with cron secret');

  console.log('\nAll e2e checks passed.');
}

// Explicit exit: the Firestore client keeps the event loop alive otherwise (test would hang on failure).
main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
