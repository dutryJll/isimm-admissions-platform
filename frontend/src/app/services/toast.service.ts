import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  text: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  constructor(private toastr: ToastrService) {}

  private normalizeText(text: string): string {
    return String(text ?? '')
      .replace(/[✅❌⚠️ℹ️]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  show(text: string, type: ToastType = 'info', durationMs: number = 3500): void {
    const normalized = this.normalizeText(text);
    const message = normalized || 'Notification';
    const title = 'ISIMM';
    const options = { timeOut: durationMs };

    if (type === 'success') {
      this.toastr.success(message, title, options);
      return;
    }
    if (type === 'warning') {
      this.toastr.warning(message, title, options);
      return;
    }
    if (type === 'error') {
      this.toastr.error(message, title, options);
      return;
    }
    this.toastr.info(message, title, options);
  }

  clear(): void {
    this.toastr.clear();
  }
}
