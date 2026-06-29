import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { HttpClientModule } from '@angular/common/http';
import { CandidatureService } from '../../../services/candidature.service';

interface PieceJustificative {
  nom: string;
  statut: 'ok' | 'missing';
}

interface Candidat {
  id: number;
  nom: string;
  master: string;
  score: number;
  etat_dossier: 'Complet' | 'Incomplet';
  statut: string;
  pieces: PieceJustificative[];
  email?: string;
  cin?: string;
  date_candidature?: string;
}

@Component({
  selector: 'app-candidatures-consultation-modal',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './candidatures-consultation-modal.component.html',
  styleUrls: ['./candidatures-consultation-modal.component.css'],
})
export class CandidaturesConsultationModalComponent {
  list: Candidat[] = [];
  index = 0;
  loading = false;

  constructor(
    private candidatureService: CandidatureService,
    private dialogRef: MatDialogRef<CandidaturesConsultationModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { list: Candidat[]; startIndex: number },
  ) {
    this.list = data.list || [];
    this.index = data.startIndex || 0;
  }

  get current(): Candidat | undefined {
    return this.list[this.index];
  }

  next(): void {
    if (this.index < this.list.length - 1) this.index += 1;
    else this.dialogRef.close({ updated: true });
  }

  prev(): void {
    if (this.index > 0) this.index -= 1;
  }

  close(): void {
    this.dialogRef.close({ updated: true });
  }

  private changeStatusRequest(id: number, newStatus: string) {
    return this.candidatureService.updateStatus(id, newStatus);
  }

  valider(): void {
    const c = this.current;
    if (!c) return;
    this.loading = true;
    this.changeStatusRequest(c.id, 'preselectionne').subscribe(() => {
      this.loading = false;
      c.statut = 'preselectionne';
      this.next();
    });
  }

  rejeter(): void {
    const c = this.current;
    if (!c) return;
    this.loading = true;
    this.changeStatusRequest(c.id, 'rejete').subscribe(() => {
      this.loading = false;
      c.statut = 'rejete';
      this.next();
    });
  }
}
