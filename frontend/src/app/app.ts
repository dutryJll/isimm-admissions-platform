import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { CandidatureService } from './services/candidature.service';
import { AuthService } from './services/auth.service';
import { FormsModule } from '@angular/forms';
import {
  CommissionContextService,
  CommissionContextOption,
} from './services/commission-context.service';
import { DialogHostComponent } from './shared/dialog-host/dialog-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule, DialogHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  title = 'frontend';

  constructor(
    public themeService: ThemeService,
    private candidatureService: CandidatureService,
    public authService: AuthService,
    public router: Router,
    private commissionContext: CommissionContextService,
  ) {}

  ngOnInit(): void {
    this.loadMyCommissions();
  }

  loadMyCommissions(): void {
    this.candidatureService.getMyCommissions().subscribe(
      (res: any) => {
        const apiCommissions = Array.isArray(res?.commissions) ? res.commissions : [];
        const normalized = apiCommissions.length
          ? apiCommissions.map((commission: any, index: number) => ({
              id: Number(commission.id) || index + 1,
              nom:
                commission.nom ||
                commission.description ||
                this.commissionContext.commissions[index]?.nom ||
                `Commission ${index + 1}`,
              description: commission.description || '',
            }))
          : this.commissionContext.commissions;

        this.commissionContext.setCommissions(normalized);
        const responseActiveId = Number(res?.active_commission_id);
        const fallbackActiveId =
          this.commissionContext.activeCommissionId || normalized[0]?.id || null;
        const activeCommissionId = Number.isFinite(responseActiveId)
          ? responseActiveId
          : fallbackActiveId;
        this.commissionContext.setActiveCommissionId(activeCommissionId);
      },
      (err) => {
        const fallbackCommissions = this.commissionContext.commissions;
        if (!this.commissionContext.activeCommissionId && fallbackCommissions.length) {
          this.commissionContext.setActiveCommissionId(fallbackCommissions[0].id);
        }
      },
    );
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
