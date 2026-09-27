import { Component, Signal, computed, input, output, signal } from '@angular/core';

export const LIST_WINDOW = 50;

/** Growing read window for a list backed by `watchWindowSignal`: keeps Firestore reads proportional to what's shown. */
export class ListWindow {
  readonly count = signal(LIST_WINDOW);

  /** A full window means there may be older documents to fetch. */
  hasMore(items: Signal<unknown[]>): Signal<boolean> {
    return computed(() => items().length >= this.count());
  }

  more(): void {
    this.count.update((n) => n + LIST_WINDOW);
  }
}

@Component({
  selector: 'app-load-more',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="flex justify-center px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          (click)="more.emit()"
          class="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
        >
          Daha fazla yükle
        </button>
      </div>
    }
  `,
})
export class LoadMore {
  readonly visible = input.required<boolean>();
  readonly more = output<void>();
}
