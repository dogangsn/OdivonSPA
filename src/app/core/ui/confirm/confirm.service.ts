import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

/** Odivon-styled SweetAlert2 confirmations for destructive/irreversible actions. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
    customClass: { popup: 'odivon-toast' },
  });

  async confirm(options: { title: string; text?: string; confirmText?: string; danger?: boolean }): Promise<boolean> {
    const result = await Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.danger ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: options.confirmText ?? 'Onayla',
      cancelButtonText: 'Vazgeç',
      confirmButtonColor: options.danger ? '#e11d48' : '#4f46e5',
      cancelButtonColor: '#64748b',
      reverseButtons: true,
      customClass: { popup: 'odivon-swal' },
    });
    return result.isConfirmed;
  }

  confirmDelete(itemName: string): Promise<boolean> {
    return this.confirm({
      title: 'Kaydı Sil',
      text: `"${itemName}" kaydını silmek istediğinize emin misiniz?`,
      confirmText: 'Sil',
      danger: true,
    });
  }

  async success(title: string, text?: string): Promise<void> {
    await Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonText: 'Tamam',
      confirmButtonColor: '#4f46e5',
      customClass: { popup: 'odivon-swal' },
    });
  }

  async error(title: string, text?: string): Promise<void> {
    await Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonText: 'Tamam',
      confirmButtonColor: '#4f46e5',
      customClass: { popup: 'odivon-swal' },
    });
  }

  async toastSuccess(title: string): Promise<void> {
    await this.toast.fire({ icon: 'success', title });
  }

  async toastError(title: string): Promise<void> {
    await this.toast.fire({ icon: 'error', title });
  }
}
