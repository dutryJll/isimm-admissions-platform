import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommissionContextService } from './commission-context.service';

@Injectable({
  providedIn: 'root',
})
export class CommissionStateService {
  constructor(private commissionContext: CommissionContextService) {}

  get activeCommissionId$(): Observable<number | null> {
    return this.commissionContext.activeCommissionId$;
  }

  get activeCommissionId(): number | null {
    return this.commissionContext.activeCommissionId;
  }

  setActiveCommissionId(id: number | null, persist = true): void {
    this.commissionContext.setActiveCommissionId(id, persist);
  }
}
