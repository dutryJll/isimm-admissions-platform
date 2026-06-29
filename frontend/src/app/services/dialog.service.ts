import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type DialogVariant = 'info' | 'warning' | 'danger' | 'success';

export interface DialogRequest {
  /** unique id (auto-generated) */
  id: number;
  /** 'alert' = OK only, 'confirm' = OK + Cancel, 'prompt' = input + OK + Cancel */
  kind: 'alert' | 'confirm' | 'prompt';
  title: string;
  message?: string;
  variant?: DialogVariant;
  okLabel?: string;
  cancelLabel?: string;
  /** for 'prompt' only */
  inputPlaceholder?: string;
  inputDefault?: string;
  inputType?: 'text' | 'password' | 'email' | 'number';
  /** select options (for 'prompt' with a dropdown). If set, replaces the input. */
  options?: { value: string; label: string }[];
}

export interface DialogResult {
  id: number;
  confirmed: boolean;
  /** value entered (for 'prompt' kind only) */
  value?: string;
}

/**
 * Replacement for window.alert / window.confirm / window.prompt
 * Pop-ups are rendered by AppDialogHostComponent (mounted once in app.html).
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private nextId = 1;
  private requests$ = new Subject<DialogRequest>();
  private results$ = new Subject<DialogResult>();

  /** Stream consumed by the host component. */
  get requests(): Observable<DialogRequest> {
    return this.requests$.asObservable();
  }

  /** Internal: host calls this to deliver the result. */
  resolve(result: DialogResult): void {
    this.results$.next(result);
  }

  private open(req: Omit<DialogRequest, 'id'>): Promise<DialogResult> {
    const id = this.nextId++;
    return new Promise<DialogResult>((resolve) => {
      const sub = this.results$.subscribe((r) => {
        if (r.id === id) {
          sub.unsubscribe();
          resolve(r);
        }
      });
      this.requests$.next({ ...req, id });
    });
  }

  /** alert() replacement — single OK button. */
  alert(title: string, message?: string, variant: DialogVariant = 'info'): Promise<void> {
    return this.open({ kind: 'alert', title, message, variant, okLabel: 'OK' }).then(() => undefined);
  }

  /** confirm() replacement — returns true if OK, false if Cancel. */
  confirm(
    title: string,
    message?: string,
    options: { variant?: DialogVariant; okLabel?: string; cancelLabel?: string } = {},
  ): Promise<boolean> {
    return this.open({
      kind: 'confirm',
      title,
      message,
      variant: options.variant ?? 'warning',
      okLabel: options.okLabel ?? 'Confirmer',
      cancelLabel: options.cancelLabel ?? 'Annuler',
    }).then((r) => r.confirmed);
  }

  /** prompt() replacement — returns the entered text, or null if cancelled. */
  prompt(
    title: string,
    message?: string,
    options: {
      placeholder?: string;
      defaultValue?: string;
      inputType?: 'text' | 'password' | 'email' | 'number';
      okLabel?: string;
      cancelLabel?: string;
      variant?: DialogVariant;
      selectOptions?: { value: string; label: string }[];
    } = {},
  ): Promise<string | null> {
    return this.open({
      kind: 'prompt',
      title,
      message,
      variant: options.variant ?? 'info',
      okLabel: options.okLabel ?? 'Confirmer',
      cancelLabel: options.cancelLabel ?? 'Annuler',
      inputPlaceholder: options.placeholder,
      inputDefault: options.defaultValue,
      inputType: options.inputType ?? 'text',
      options: options.selectOptions,
    }).then((r) => (r.confirmed ? r.value ?? '' : null));
  }
}
