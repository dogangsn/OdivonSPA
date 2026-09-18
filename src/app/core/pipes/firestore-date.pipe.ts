import { DatePipe } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { FirestoreDate } from '../models';

/**
 * Formats a Firestore `Timestamp | Date` the same way Angular's built-in `date` pipe does.
 * Builds its own `DatePipe` instance instead of `inject(DatePipe)` — DatePipe is only
 * DI-registered in components that explicitly import it, which most callers of `fsDate` don't.
 */
@Pipe({ name: 'fsDate', standalone: true })
export class FirestoreDatePipe implements PipeTransform {
  private readonly datePipe = new DatePipe(inject(LOCALE_ID));

  transform(value: FirestoreDate | null | undefined, format = 'dd.MM.yyyy'): string | null {
    if (!value) return null;
    const date = value instanceof Timestamp ? value.toDate() : value;
    return this.datePipe.transform(date, format);
  }
}
