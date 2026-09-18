import { Injectable } from '@angular/core';
import { orderBy } from '@angular/fire/firestore';
import { FirestoreCrudService } from '../../../core/services/firestore-crud.service';
import { Room } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class RoomService extends FirestoreCrudService<Room> {
  constructor() {
    super('rooms');
  }

  override watchAllSignal() {
    return super.watchAllSignal(orderBy('ad', 'asc'));
  }
}
