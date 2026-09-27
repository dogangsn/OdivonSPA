import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { Product, StockMovementType } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class ProductService extends ApiCrudService<Product> {
  constructor() {
    super('/spa/products');
  }

  /**
   * The server writes the movement log entry and adjusts `mevcutStok` by the same signed delta in
   * one transaction, so the product balance and its movement history can never drift apart.
   */
  async recordStockMovement(productId: string, type: StockMovementType, signedDelta: number, note?: string): Promise<void> {
    if (!Number.isInteger(signedDelta)) throw new Error('Stok miktarı tam sayı olmalıdır.');
    await this.command(this.api.post('/spa/stock-movements', { productId, type, qty: signedDelta, note }));
  }
}
