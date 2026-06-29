import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DialogRequest, DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dialog-host.component.html',
  styleUrls: ['./dialog-host.component.css'],
})
export class DialogHostComponent implements OnInit, OnDestroy {
  active: DialogRequest | null = null;
  inputValue = '';

  private sub?: Subscription;

  constructor(private dialog: DialogService) {}

  ngOnInit(): void {
    this.sub = this.dialog.requests.subscribe((req) => {
      this.active = req;
      this.inputValue = req.inputDefault ?? '';
      // focus input next tick
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>('.dlg-input, .dlg-select');
        el?.focus();
      }, 30);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onConfirm(): void {
    if (!this.active) return;
    if (this.active.kind === 'prompt') {
      const v = String(this.inputValue ?? '').trim();
      if (!v && !this.active.options) {
        // require non-empty input
        return;
      }
      this.dialog.resolve({ id: this.active.id, confirmed: true, value: v });
    } else {
      this.dialog.resolve({ id: this.active.id, confirmed: true });
    }
    this.close();
  }

  onCancel(): void {
    if (!this.active) return;
    this.dialog.resolve({ id: this.active.id, confirmed: false });
    this.close();
  }

  private close(): void {
    this.active = null;
    this.inputValue = '';
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.active && this.active.kind !== 'alert') this.onCancel();
    else if (this.active) this.onConfirm();
  }

  variantIcon(v: string | undefined): string {
    switch (v) {
      case 'success':
        return 'fa-circle-check';
      case 'warning':
        return 'fa-triangle-exclamation';
      case 'danger':
        return 'fa-circle-exclamation';
      default:
        return 'fa-circle-info';
    }
  }
}
