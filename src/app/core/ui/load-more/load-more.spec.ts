import { signal } from '@angular/core';
import { LIST_WINDOW, ListWindow } from './load-more';

describe('ListWindow', () => {
  it('reports more only when the window came back full, and grows by one page', () => {
    const w = new ListWindow();
    const items = signal<unknown[]>(new Array(LIST_WINDOW).fill(0));
    const hasMore = w.hasMore(items);
    expect(hasMore()).toBe(true);

    w.more();
    expect(w.count()).toBe(LIST_WINDOW * 2);
    expect(hasMore()).toBe(false);

    items.set(new Array(LIST_WINDOW * 2).fill(0));
    expect(hasMore()).toBe(true);
  });
});
