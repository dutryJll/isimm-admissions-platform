import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { CandidatureService } from '../../../services/candidature.service';

interface AvisHistoryItem {
  id: number;
  membre_name?: string;
  member_name?: string;
  commission_name?: string;
  avis: boolean;
  avis_type?: 'favorable' | 'defavorable';
  argument?: string;
  date?: string;
  date_avis?: string;
}

interface UserCommissionOption {
  id: number;
  nom: string;
}

@Component({
  selector: 'app-avis-submission',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './avis-submission.component.html',
  styleUrls: ['./avis-submission.component.css'],
})
export class AvisSubmissionComponent implements OnInit {
  @Input() candidatureId: number | null = null;

  avisForm: FormGroup;
  commissionOptions: UserCommissionOption[] = [];
  submitting = false;
  errorMessage = '';
  successMessage = '';
  avisStatistics: any = null;
  avisHistory: AvisHistoryItem[] = [];
  loadingStats = false;
  editingAvisId: number | null = null;

  constructor(
    private candidatureService: CandidatureService,
    private formBuilder: FormBuilder,
  ) {
    this.avisForm = this.formBuilder.group({
      avis: [null, Validators.required],
      argument: ['', [Validators.minLength(10)]],
      commission_id: [null],
    });
  }

  ngOnInit(): void {
    this.loadCommissions();
    if (this.candidatureId) {
      this.loadAvisStatistics();
    }

    this.avisForm.get('avis')?.valueChanges.subscribe((avisValue) => {
      const argumentControl = this.avisForm.get('argument');
      if (!argumentControl) {
        return;
      }

      if (avisValue === false) {
        argumentControl.setValidators([Validators.required, Validators.minLength(10)]);
      } else {
        argumentControl.setValidators([Validators.minLength(10)]);
      }

      argumentControl.updateValueAndValidity({ emitEvent: false });
    });
  }

  private loadCommissions(): void {
    const activeCommissionId = localStorage.getItem('active_commission_id');
    const activeCommissionNumericId = activeCommissionId ? Number(activeCommissionId) : null;

    this.candidatureService.getMyCommissions(activeCommissionNumericId).subscribe({
      next: (res: any) => {
        this.commissionOptions = res.commissions || [];
        const selectedId =
          res.active_commission_id || activeCommissionNumericId || this.commissionOptions[0]?.id || null;
        this.avisForm.patchValue({ commission_id: selectedId }, { emitEvent: false });
      },
      error: () => {
        if (activeCommissionNumericId) {
          this.avisForm.patchValue({ commission_id: activeCommissionNumericId }, { emitEvent: false });
        }
      },
    });
  }

  loadAvisStatistics(): void {
    if (!this.candidatureId) return;

    this.loadingStats = true;
    this.candidatureService.getAvisStatistiques(this.candidatureId).subscribe({
      next: (res: any) => {
        this.avisStatistics = res;
        this.avisHistory = (res.avis || []).map((item: any) => this.normalizeAvis(item));
        this.loadingStats = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des statistiques', err);
        this.loadingStats = false;
      },
    });
  }

  submitAvis(): void {
    if (!this.avisForm.valid || !this.candidatureId) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    const avisValue = this.avisForm.get('avis')?.value;
    const argumentValue = String(this.avisForm.get('argument')?.value || '').trim();
    if (avisValue === false && !argumentValue) {
      this.errorMessage = 'Un argument est requis pour un avis défavorable';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      avis: avisValue,
      argument: argumentValue,
      commission_id: this.avisForm.get('commission_id')?.value || null,
    };

    this.candidatureService.submitAvis(this.candidatureId, payload).subscribe({
      next: (res: any) => {
        this.successMessage = res?.message || 'Avis soumis avec succès';
        this.avisForm.reset({ avis: null, argument: '', commission_id: this.avisForm.get('commission_id')?.value || null });
        this.editingAvisId = null;
        this.loadAvisStatistics();
        this.submitting = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Erreur lors de la soumission';
        this.submitting = false;
      },
    });
  }

  deleteAvis(avisId: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet avis ?')) {
      this.submitting = true;
      this.candidatureService.deleteAvis(this.candidatureId || 0, avisId).subscribe({
        next: () => {
          this.successMessage = 'Avis supprimé avec succès';
          this.loadAvisStatistics();
          this.submitting = false;
        },
        error: (err) => {
          this.errorMessage = 'Erreur lors de la suppression';
          this.submitting = false;
        },
      });
    }
  }

  updateAvis(avisId: number): void {
    if (!this.avisForm.valid || !this.candidatureId) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    const avisValue = this.avisForm.get('avis')?.value;
    const argumentValue = String(this.avisForm.get('argument')?.value || '').trim();
    if (avisValue === false && !argumentValue) {
      this.errorMessage = 'Un argument est requis pour un avis défavorable';
      return;
    }

    this.submitting = true;
    const payload = {
      avis: avisValue,
      argument: argumentValue,
      commission_id: this.avisForm.get('commission_id')?.value || null,
    };

    this.candidatureService.updateAvis(this.candidatureId, avisId, payload).subscribe({
      next: () => {
        this.successMessage = 'Avis modifié avec succès';
        this.avisForm.reset({ avis: null, argument: '', commission_id: this.avisForm.get('commission_id')?.value || null });
        this.editingAvisId = null;
        this.loadAvisStatistics();
        this.submitting = false;
      },
      error: (err) => {
        this.errorMessage = 'Erreur lors de la modification';
        this.submitting = false;
      },
    });
  }

  editAvis(avis: AvisHistoryItem): void {
    this.editingAvisId = avis.id;
    this.avisForm.patchValue({
      avis: avis.avis,
      argument: avis.argument || '',
      commission_id: this.avisForm.get('commission_id')?.value || null,
    });
  }

  resetForm(): void {
    this.avisForm.reset({ avis: null, argument: '', commission_id: this.avisForm.get('commission_id')?.value || null });
    this.editingAvisId = null;
    this.errorMessage = '';
    this.successMessage = '';
  }

  private normalizeAvis(item: any): AvisHistoryItem {
    return {
      id: item.id,
      membre_name: item.membre_name || item.member_name,
      member_name: item.member_name || item.membre_name,
      commission_name: item.commission_name,
      avis: !!item.avis,
      avis_type: item.avis_type,
      argument: item.argument,
      date: item.date || item.date_avis,
      date_avis: item.date_avis || item.date,
    };
  }
}
