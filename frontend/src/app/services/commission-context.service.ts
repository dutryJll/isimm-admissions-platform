import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CommissionContextOption {
  id: number;
  nom: string;
  description?: string;
  category?: 'ingenieur' | 'master-ds' | 'master-gl';
}

@Injectable({
  providedIn: 'root',
})
export class CommissionContextService {
  private readonly storageKey = 'active_commission_id';
  private readonly commissionsSubject = new BehaviorSubject<CommissionContextOption[]>([
    {
      id: 1,
      nom: 'Cycle Ingénieur en Génie Logiciel (GL)',
      category: 'ingenieur',
    },
    {
      id: 2,
      nom: 'Mastère de Recherche en Data Science',
      category: 'master-ds',
    },
    {
      id: 3,
      nom: 'Mastère Professionnel en Génie Logiciel (GL)',
      category: 'master-gl',
    },
  ]);
  private readonly activeCommissionIdSubject = new BehaviorSubject<number | null>(
    this.readStoredCommissionId(),
  );

  readonly commissions$ = this.commissionsSubject.asObservable();
  readonly activeCommissionId$ = this.activeCommissionIdSubject.asObservable();

  get commissions(): CommissionContextOption[] {
    return this.commissionsSubject.value;
  }

  get activeCommissionId(): number | null {
    return this.activeCommissionIdSubject.value;
  }

  get activeCommission(): CommissionContextOption | null {
    const id = this.activeCommissionIdSubject.value;
    return this.commissionsSubject.value.find((commission) => commission.id === id) || null;
  }

  setCommissions(commissions: CommissionContextOption[]): void {
    const normalized = commissions.length ? commissions : this.commissionsSubject.value;
    this.commissionsSubject.next(normalized);
    if (this.activeCommissionIdSubject.value === null && normalized.length > 0) {
      this.setActiveCommissionId(normalized[0].id, false);
    }
  }

  setActiveCommissionId(value: number | null, persist = true): void {
    this.activeCommissionIdSubject.next(value);
    if (persist) {
      if (value === null) {
        localStorage.removeItem(this.storageKey);
      } else {
        localStorage.setItem(this.storageKey, String(value));
      }
    }
  }

  syncFromStorage(): void {
    this.activeCommissionIdSubject.next(this.readStoredCommissionId());
  }

  private readStoredCommissionId(): number | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
