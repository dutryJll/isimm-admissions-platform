import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-import-inscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './import-inscriptions.html',
  styleUrls: ['./import-inscriptions.css'],
})
export class ImportInscriptionsComponent {
  fichierSelectionne: File | null = null;
  loading = false;
  resultats: any = null;
  errorMessage = '';
  successMessage = '';

  // v7 §6.5 — Résultat de la comparaison « admis non inscrits »
  nonInscritsResultats: any = null;

  constructor(
    private candidatureService: CandidatureService,
    private toastService: ToastService
  ) {}

  onFichierSelectionne(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Vérifier l'extension
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        this.errorMessage = 'Veuillez sélectionner un fichier Excel (.xlsx ou .xls)';
        this.toastService.show(this.errorMessage, 'error');
        return;
      }

      this.fichierSelectionne = file;
      this.errorMessage = '';
    }
  }

  telechargerTemplate(): void {
    // Créer un fichier Excel template
    // Pour simplifier, on crée juste un CSV
    const csv = 'numero_inscription\n20241234567\n20241234568\n20241234569';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_inscriptions.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  importerFichier(): void {
    if (!this.fichierSelectionne) {
      this.errorMessage = 'Veuillez sélectionner un fichier';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.resultats = null;

    this.candidatureService.verifierExcelInscriptions(this.fichierSelectionne).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = `Vérification terminée: ${response.nb_confirmes} inscriptions confirmées`;
          this.resultats = response;
          this.toastService.show(this.successMessage, 'success');
          this.fichierSelectionne = null;
        }
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Erreur lors de l\'import';
        this.toastService.show(this.errorMessage, 'error');
        this.loading = false;
      },
    });
  }

  // v7 §6.5 — Importer la liste officielle et identifier les ADMIS NON INSCRITS.
  comparerAdmisNonInscrits(): void {
    if (!this.fichierSelectionne) {
      this.errorMessage = 'Veuillez sélectionner un fichier';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.nonInscritsResultats = null;

    this.candidatureService.comparerInscritsAdmis(this.fichierSelectionne).subscribe({
      next: (response) => {
        this.nonInscritsResultats = response;
        this.successMessage =
          `${response.nb_non_inscrits} admis non inscrit(s) sur ${response.nb_admis} admis ` +
          `(${response.nb_inscrits_fichier} inscrits dans le fichier).`;
        this.toastService.show(this.successMessage, 'success');
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.error || 'Erreur lors de la comparaison';
        this.toastService.show(this.errorMessage, 'error');
        this.loading = false;
      },
    });
  }

  recommencer(): void {
    this.fichierSelectionne = null;
    this.resultats = null;
    this.nonInscritsResultats = null;
    this.errorMessage = '';
    this.successMessage = '';
  }
}
