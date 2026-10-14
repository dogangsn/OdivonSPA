import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { VersionService } from '../../../core/version/version.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (version.modalVisible()) {
      <div
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/75 dark:bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
        (click)="onBackdropClick($event)"
      >
        <div
          class="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
          (click)="$event.stopPropagation()"
        >
          <!-- Top Accent Light Glow -->
          <div
            class="absolute -top-16 -left-16 w-40 h-40 bg-indigo-500/20 dark:bg-indigo-500/30 rounded-full blur-3xl pointer-events-none"
          ></div>
          <div
            class="absolute -bottom-16 -right-16 w-40 h-40 bg-purple-500/20 dark:bg-purple-500/25 rounded-full blur-3xl pointer-events-none"
          ></div>

          <!-- Header -->
          <div class="p-6 sm:p-7 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-3.5">
              <div
                class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
                [class]="
                  version.updateRequired()
                    ? 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-600/25'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                "
              >
                <mat-icon class="icon-size-6" [svgIcon]="version.updateRequired() ? 'heroicons_solid:arrow-path' : 'heroicons_solid:shield-check'"></mat-icon>
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight m-0">
                  {{ version.updateRequired() ? 'Yeni Sürüm Mevcut' : 'Sistem Sürüm Bilgisi' }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                  {{
                    version.updateRequired()
                      ? 'OdivonSPA daha kararlı ve hızlı bir sürüme yükseltildi.'
                      : 'Şu anda sistemin en güncel sürümünü kullanıyorsunuz.'
                  }}
                </p>
              </div>
            </div>

            @if (!version.updateRequired()) {
              <button
                type="button"
                (click)="version.closeModal()"
                class="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
              </button>
            }
          </div>

          <!-- Body -->
          <div class="p-6 sm:p-7 py-5 space-y-4">
            <!-- Versions Comparison Card -->
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
              <!-- Current Version -->
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                  v
                </div>
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Şu Anki Sürüm</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm font-black text-slate-900 dark:text-white">v{{ version.current.version }}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      #{{ version.current.commit }}
                    </span>
                  </div>
                </div>
              </div>

              @if (version.updateRequired()) {
                <div class="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                  <mat-icon class="icon-size-4" [svgIcon]="'heroicons_outline:arrow-right'"></mat-icon>
                </div>

                <!-- New Available Version -->
                <div class="flex items-center gap-2.5 text-right">
                  <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">Yeni Sürüm</span>
                    <div class="flex items-center justify-end gap-1.5">
                      <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">
                        v{{ version.available()?.version || version.current.version }}
                      </span>
                      @if (version.available()?.commit) {
                        <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">
                          #{{ version.available()?.commit }}
                        </span>
                      }
                    </div>
                  </div>
                  <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    ✦
                  </div>
                </div>
              } @else {
                <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                  <mat-icon class="icon-size-4" [svgIcon]="'heroicons_solid:check-circle'"></mat-icon>
                  <span>Kararlı & Güncel</span>
                </div>
              }
            </div>

            <!-- Release Notes Box -->
            <div class="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <mat-icon class="icon-size-4 text-purple-600 dark:text-purple-400" [svgIcon]="'heroicons_solid:sparkles'"></mat-icon>
                  {{ version.updateRequired() ? 'Yeni Sürüm Notları' : 'Sürüm Detayları' }}
                </span>
                <span class="text-[10px] font-semibold text-slate-400">
                  {{ formatBuildDate(version.available()?.builtAt || version.current.builtAt) }}
                </span>
              </div>
              <p class="m-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {{ getReleaseNotes() }}
              </p>
            </div>

            <!-- Cookie & Cache Clean Notice -->
            <div class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
              <mat-icon class="icon-size-4 text-indigo-500 shrink-0 mt-0.5" [svgIcon]="'heroicons_outline:shield-check'"></mat-icon>
              <span>
                {{
                  version.updateRequired()
                    ? 'Güncelleme uygulandığında tarayıcı önbelleği ve çerezler güvenle temizlenecek, oturumunuz taze bir şekilde yeniden başlatılacaktır.'
                    : 'Sistem düzenli aralıklarla ve sekme odaklandığında arka planda otomatik sürüm denetimi gerçekleştirir.'
                }}
              </span>
            </div>
          </div>

          <!-- Modal Action Footer -->
          <div class="p-6 sm:p-7 pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
            @if (version.updateRequired()) {
              <button
                type="button"
                class="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-600 text-white font-black text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                [disabled]="version.applying()"
                (click)="version.applyUpdate()"
              >
                @if (version.applying()) {
                  <mat-icon class="icon-size-4.5 animate-spin" [svgIcon]="'heroicons_outline:arrow-path'"></mat-icon>
                  <span>Çerezler Temizleniyor & Güncelleniyor...</span>
                } @else {
                  <mat-icon class="icon-size-4.5" [svgIcon]="'heroicons_solid:arrow-down-tray'"></mat-icon>
                  <span>Şimdi Güncelle ve Yeniden Başlat</span>
                }
              </button>
            } @else {
              <button
                type="button"
                (click)="version.checkNow()"
                class="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                [disabled]="version.isChecking()"
              >
                <mat-icon class="icon-size-4" [class.animate-spin]="version.isChecking()" [svgIcon]="'heroicons_outline:arrow-path'">
                </mat-icon>
                <span>{{ version.isChecking() ? 'Denetleniyor...' : 'Güncellemeleri Denetle' }}</span>
              </button>

              <button
                type="button"
                (click)="version.closeModal()"
                class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Tamam
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class UpdateBanner {
  protected readonly version = inject(VersionService);

  onBackdropClick(event: MouseEvent): void {
    if (!this.version.updateRequired()) {
      this.version.closeModal();
    }
  }

  getReleaseNotes(): string {
    const available = this.version.available();
    if (available?.notes && available.notes.trim()) {
      return available.notes;
    }
    const current = this.version.current;
    if (current?.notes && current.notes.trim()) {
      return current.notes;
    }
    return 'Yeni nesil OdivonSPA performans optimizasyonları, güvenlik yamaları ve kullanıcı deneyimi geliştirmeleri içerir.';
  }

  formatBuildDate(dateStr?: string): string {
    if (!dateStr) return 'Güncel';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Güncel';
      return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Güncel';
    }
  }
}
