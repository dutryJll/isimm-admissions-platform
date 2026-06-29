import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reclamation-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <!-- Header -->
    <div class="rcd-header">
      <div class="rcd-header-left">
        <div class="rcd-eyebrow">Réclamation · Détail</div>
        <div class="rcd-title">{{ data.identifiant || 'Réclamation' }}</div>
      </div>
      <div class="rcd-header-right">
        <span class="rcd-status-chip" [ngClass]="getStatusClass()">
          <span class="rcd-status-dot"></span>
          {{ getStatusLabel() }}
        </span>
        <button class="rcd-close-btn" mat-icon-button (click)="dialogRef.close()" aria-label="Fermer">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="rcd-body">

      <!-- Message section -->
      <div class="rcd-section">
        <div class="rcd-section-title">
          <mat-icon class="rcd-icon">message</mat-icon>
          Votre message
        </div>
        <div class="rcd-objet-row">
          <span class="rcd-objet-label">Objet</span>
          <span class="rcd-objet-value">{{ getObjetLabel(data.objet) }}</span>
        </div>
        <div class="rcd-motif-box">
          {{ data.motif }}
        </div>
        <button *ngIf="data.piece_jointe_url" class="rcd-attachment-btn" (click)="openAttachment()">
          <mat-icon>attach_file</mat-icon>
          {{ data.piece_jointe_nom || 'Voir la pièce jointe' }}
        </button>
      </div>

      <!-- Response section -->
      <div class="rcd-section rcd-response-section" *ngIf="data.reponse">
        <div class="rcd-section-title">
          <mat-icon class="rcd-icon">reply</mat-icon>
          Réponse de l'administration
        </div>
        <div class="rcd-response-box">
          <mat-icon class="rcd-response-icon">info</mat-icon>
          <div class="rcd-response-text">{{ data.reponse }}</div>
        </div>
      </div>

      <!-- No response yet -->
      <div class="rcd-section rcd-pending-section" *ngIf="!data.reponse">
        <div class="rcd-pending-msg">
          <mat-icon>hourglass_empty</mat-icon>
          En attente de réponse de l'administration
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div class="rcd-footer">
      <button class="rcd-btn-fermer" mat-button (click)="dialogRef.close()">
        Fermer
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      font-family: 'Segoe UI', system-ui, sans-serif;
      min-width: 420px;
      max-width: 560px;
    }

    /* Header */
    .rcd-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #0F1F3D 0%, #185FA5 100%);
      gap: 12px;
    }
    .rcd-eyebrow {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: rgba(255,255,255,.65);
      margin-bottom: 4px;
    }
    .rcd-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -.2px;
    }
    .rcd-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .rcd-status-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .rcd-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    .chip-success { background: rgba(110,231,183,.25); color: #6EE7B7; border: 1px solid rgba(110,231,183,.4); }
    .chip-warning { background: rgba(253,211,77,.2); color: #FCD34D; border: 1px solid rgba(253,211,77,.35); }
    .chip-danger  { background: rgba(254,202,202,.2); color: #FECACA; border: 1px solid rgba(254,202,202,.35); }
    .chip-info    { background: rgba(191,219,254,.2); color: #BFDBFE; border: 1px solid rgba(191,219,254,.35); }

    .rcd-close-btn {
      width: 30px !important;
      height: 30px !important;
      color: rgba(255,255,255,.75) !important;
      --mdc-icon-button-icon-size: 18px;
    }
    .rcd-close-btn:hover { color: #fff !important; }

    /* Body */
    .rcd-body {
      padding: 18px 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .rcd-section {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 14px 16px;
    }
    .rcd-response-section { background: #EFF6FF; border-color: #BFDBFE; }
    .rcd-pending-section { background: #FFFBEB; border-color: #FCD34D; }

    .rcd-section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .07em;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 10px;
    }
    .rcd-icon { font-size: 14px !important; color: #185FA5; }

    .rcd-objet-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .rcd-objet-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #94A3B8;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 3px 8px;
      white-space: nowrap;
    }
    .rcd-objet-value {
      font-size: 13px;
      font-weight: 600;
      color: #0F172A;
    }

    .rcd-motif-box {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
      background: #fff;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 12px;
      white-space: pre-wrap;
    }

    .rcd-attachment-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1.5px solid #BFDBFE;
      background: #EFF6FF;
      color: #1E40AF;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all .15s;
    }
    .rcd-attachment-btn:hover { background: #185FA5; color: #fff; border-color: #185FA5; }
    .rcd-attachment-btn mat-icon { font-size: 15px !important; }

    .rcd-response-box {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .rcd-response-icon { font-size: 18px !important; color: #185FA5; flex-shrink: 0; margin-top: 1px; }
    .rcd-response-text { font-size: 13px; color: #1E3A5F; line-height: 1.6; }

    .rcd-pending-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #92400E;
      font-weight: 500;
    }
    .rcd-pending-msg mat-icon { font-size: 18px !important; color: #F59E0B; }

    /* Footer */
    .rcd-footer {
      display: flex;
      justify-content: flex-end;
      padding: 12px 24px 16px;
      border-top: 1px solid #E2E8F0;
      background: #F8FAFC;
    }
    .rcd-btn-fermer {
      padding: 8px 20px !important;
      border-radius: 9px !important;
      border: 1.5px solid #E2E8F0 !important;
      background: transparent !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      color: #64748B !important;
      font-family: inherit !important;
      transition: all .15s !important;
    }
    .rcd-btn-fermer:hover { border-color: #185FA5 !important; color: #185FA5 !important; }
  `],
})
export class ReclamationDetailDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ReclamationDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  getStatusLabel(): string {
    const labels: any = {
      en_cours: 'En cours',
      en_attente: 'En attente',
      traitee: 'Traitée',
      rejete: 'Rejetée',
    };
    return labels[(this.data?.statut || '').toLowerCase()] || this.data?.statut || '-';
  }

  getStatusClass(): string {
    const value = (this.data?.statut || '').toLowerCase();
    if (['selectionne', 'inscrit', 'valide', 'traitee'].includes(value)) return 'rcd-status-chip chip-success';
    if (['rejete', 'non_admis', 'non_preselectionne'].includes(value)) return 'rcd-status-chip chip-danger';
    if (['sous_examen', 'soumis', 'preselectionne'].includes(value)) return 'rcd-status-chip chip-info';
    return 'rcd-status-chip chip-warning';
  }

  openAttachment(): void {
    if (this.data?.piece_jointe_url) {
      window.open(this.data.piece_jointe_url, '_blank');
    }
  }

  getObjetLabel(objet: string): string {
    const labels: any = {
      score: 'Score incorrect',
      statut: 'Statut de candidature',
      dossier: 'Dossier incomplet',
      paiement: 'Paiement',
      autre: 'Autre',
    };
    return labels[objet] || objet || '';
  }
}
