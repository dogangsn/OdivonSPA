import { DatePipe } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';
import { FirestoreDate } from '../models';

/**
 * Formats a record date the same way Angular's built-in `date` pipe does.
 * Builds its own `DatePipe` instance instead of `inject(DatePipe)` — DatePipe is only
 * DI-registered in components that explicitly import it, which most callers of `fsDate` don't.
 */
@Pipe({ name: 'fsDate', standalone: true })
export class FirestoreDatePipe implements PipeTransform {
  private readonly datePipe = new DatePipe(inject(LOCALE_ID));

  transform(value: FirestoreDate | null | undefined, format = 'dd.MM.yyyy'): string | null {
    if (!value) return null;
    return this.datePipe.transform(value, format);
  }
}
