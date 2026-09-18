import { Injectable, inject } from '@angular/core';
import { doc, increment, orderBy, runTransaction, serverTimestamp } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { Product, StockMovementType } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ProductService extends FirestoreCrudService<Product> {
  constructor() {
    super('products');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('ad', 'asc'));
  }

  /**
   * Atomically writes a stock movement log entry and adjusts `mevcutStok` by the same signed delta,
   * so the product balance and its movement history can never drift apart.
   */
  async recordStockMovement(productId: string, type: StockMovementType, signedDelta: number, note?: string): Promise<void> {
    const tenantId = this.auth.tenantId();
    if (!tenantId) throw new Error('Tenant context missing.');
    const uid = this.auth.user()?.uid ?? 'unknown';

    const productRef = doc(this.firestore, `tenants/${tenantId}/products/${productId}`);
    const movementRef = doc(this.firestore, `tenants/${tenantId}/stockMovements/${crypto.randomUUID()}`);

    await runTransaction(this.firestore, async (tx) => {
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) throw new Error('Ürün bulunamadı.');
      const current = (productSnap.data()['mevcutStok'] as number) ?? 0;
      if (current + signedDelta < 0) {
        throw new Error('Stok miktarı negatif olamaz.');
      }
      tx.update(productRef, { mevcutStok: increment(signedDelta) });
      tx.set(movementRef, {
        productId,
        type,
        qty: signedDelta,
        note: note ?? null,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
    });
  }
}
