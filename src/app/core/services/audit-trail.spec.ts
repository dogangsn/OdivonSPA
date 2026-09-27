import { serverTimestamp } from '@angular/fire/firestore';
import { auditEntry, deleteAuditId, pickKeys } from './audit-trail';

describe('audit-trail', () => {
  it('keeps only the patched keys for the "before" snapshot', () => {
    expect(pickKeys({ ad: 'Ayşe', telefon: '0532', active: true }, ['telefon', 'yok'])).toEqual({ telefon: '0532' });
  });

  it('drops Firestore sentinels and undefined values from logged data', () => {
    const entry = auditEntry('customers', 'update', 'c1', null, { ad: 'Ayşe', updatedAt: serverTimestamp(), note: undefined }, { uid: 'u1', email: 'a@b.c' });
    expect(entry['after']).toEqual({ ad: 'Ayşe' });
    expect(entry['userId']).toBe('u1');
    expect(entry['action']).toBe('update');
  });

  it('uses the id format firestore.rules expects for deletes', () => {
    expect(deleteAuditId('rooms', 'r1')).toBe('del-rooms-r1');
  });
});
