import { Injectable } from '@angular/core';
import { Observable, Subject, fromEvent, interval, merge, startWith } from 'rxjs';

/** How often open lists re-fetch on their own, standing in for the old Firestore live listeners. */
export const REFRESH_INTERVAL_MS = 60_000;

/**
 * Tells every open list when to re-fetch: right away, after any write made through the app,
 * periodically, and whenever the browser tab regains focus.
 */
@Injectable({ providedIn: 'root' })
export class DataRefreshService {
  private readonly writes = new Subject<void>();

  changes(): Observable<unknown> {
    return merge(this.writes, interval(REFRESH_INTERVAL_MS), fromEvent(window, 'focus')).pipe(startWith(null));
  }

  notifyChanged(): void {
    this.writes.next();
  }
}
