import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'isimm-theme';
  private readonly isDarkSubject = new BehaviorSubject<boolean>(false);
  readonly isDark$ = this.isDarkSubject.asObservable();

  constructor() {
    const saved = localStorage.getItem(this.storageKey);
    const isDark = saved === 'dark';
    this.setTheme(isDark);
  }

  toggleTheme(): void {
    this.setTheme(!this.isDarkSubject.value);
  }

  private setTheme(isDark: boolean): void {
    this.isDarkSubject.next(isDark);
    document.body.classList.toggle('theme-dark', isDark);
    localStorage.setItem(this.storageKey, isDark ? 'dark' : 'light');
  }
}
