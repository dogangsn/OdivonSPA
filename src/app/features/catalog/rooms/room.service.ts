import { Injectable } from '@angular/core';
import { ApiCrudService } from '../../../core/services/api-crud.service';
import { Room } from '../../../core/models';

@Injectable({ providedIn: 'root' })
export class RoomService extends ApiCrudService<Room> {
  constructor() {
    super('/spa/rooms');
  }
}
