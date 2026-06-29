import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CandidatureService } from '../../../services/candidature.service';

@Component({
  selector: 'app-candidatures-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidatures-list.component.html',
  styleUrls: ['./candidatures-list.component.css'],
})
export class CandidaturesListComponent implements OnInit {
  candidatures: any[] = [];
  selectedIds: number[] = [];
  isAllSelected = false;
  showAvisModal = false;
  currentCandidature: any = null;
  avisValue: boolean | null = null;
  avisArgument = '';
  avisError = '';

  constructor(private candidatureService: CandidatureService) {}

  ngOnInit(): void {
    this.loadCandidatures();
  }

  loadCandidatures(): void {
    this.candidatureService.getCandidaturesCommissionClassees().subscribe({
      next: (res: any) => {
        this.candidatures = res || [];
      },
      error: () => (this.candidatures = []),
    });
  }

  toggleSelect(id: number): void {
    const idx = this.selectedIds.indexOf(id);
    if (idx >= 0) this.selectedIds.splice(idx, 1);
    else this.selectedIds.push(id);
    this.isAllSelected = this.selectedIds.length === this.candidatures.length;
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selectedIds = [];
      this.isAllSelected = false;
      return;
    }
    this.selectedIds = this.candidatures.map((c) => c.id);
    this.isAllSelected = true;
  }

  consultMass(): void {
    console.log('Consulter en masse', this.selectedIds);
  }

  consultCandidate(id: number): void {
    console.log('Consulter', id);
  }

  openAvisModal(candidature: any): void {
    this.currentCandidature = candidature;
    this.avisValue = true;
    this.avisArgument = '';
    this.avisError = '';
    this.showAvisModal = true;
  }

  closeAvisModal(): void {
    this.showAvisModal = false;
    this.currentCandidature = null;
  }

  submitAvis(): void {
    this.avisError = '';
    if (this.avisValue === false && (!this.avisArgument || !this.avisArgument.trim())) {
      this.avisError = 'Argumentation requise pour un avis défavorable.';
      return;
    }

    const payload: any = { avis: this.avisValue, argument: this.avisArgument || '' };
    // Optionally include commission_id from localStorage
    const activeCommission = localStorage.getItem('active_commission_id');
    if (activeCommission) payload.commission_id = Number(activeCommission);

    this.candidatureService.submitAvis(this.currentCandidature.id, payload).subscribe(
      (res) => {
        this.closeAvisModal();
        // Optionally refresh list or show toast
        this.loadCandidatures();
      },
      (err) => {
        this.avisError = err?.error?.error || 'Erreur lors de l envoi de l avis.';
      },
    );
  }

  downloadZip(): void {
    console.log('Télécharger ZIP', this.selectedIds);
  }

  markAllAsRead(): void {
    console.log('Lire tous', this.selectedIds);
  }
}
