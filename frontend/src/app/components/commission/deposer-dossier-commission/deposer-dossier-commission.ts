import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';
import { SpecialitesService } from '../../../services/specialites.service';

interface FilePreview {
  fileName: string;
  fileSize: string;
  mimeType: string;
  isImage: boolean;
  previewUrl?: string;
}

@Component({
  selector: 'app-deposer-dossier-commission',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule, FormsModule],
  templateUrl: './deposer-dossier-commission.html',
  styleUrls: ['./deposer-dossier-commission.css'],
})
export class DeposerDossierCommissionComponent implements OnInit {
  candidatNom: string = 'Nom du Candidat';
  documentsUploaded: number = 0;
  isSubmitting: boolean = false;
  submitProgress: number = 0;
  uploadStepLabel: string = 'Préparation...';

  private files: { [key: string]: File } = {};
  private previews: { [key: string]: FilePreview } = {};
  private progress: { [key: string]: number } = {};
  photoPreview: string | null = null;
  availableSpecialites: string[] = [];
  selectedSpecialite: string = '';

  constructor(
    private router: Router,
    private candidatureService: CandidatureService,
    private toastService: ToastService,
    private specialitesService: SpecialitesService,
  ) {}

  ngOnInit(): void {
    // Initialiser les données du candidat depuis les paramètres de route ou service
    this.initializeCandidatData();
    this.specialitesService.getSpecialitesData().subscribe(() => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
    });
  }

  private initializeCandidatData(): void {
    // TODO: Récupérer les données du candidat depuis les paramètres de route ou service
    // this.candidatNom = this.route.snapshot.params['nom'] || 'Candidat Inconnu';
  }

  hasFile(type: string): boolean {
    return !!this.files[type];
  }

  previewFor(type: string): FilePreview | null {
    return this.previews[type] || null;
  }

  progressFor(type: string): number {
    return this.progress[type] || 0;
  }

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validation de taille
    const maxSizes: { [key: string]: number } = {
      cin: 5 * 1024 * 1024, // 5MB
      releves: 10 * 1024 * 1024, // 10MB
      diplome: 5 * 1024 * 1024, // 5MB
      photo: 2 * 1024 * 1024, // 2MB
    };

    if (file.size > maxSizes[type]) {
      this.toastService.show(
        `Le fichier est trop volumineux. Taille maximale: ${maxSizes[type] / (1024 * 1024)} MB`,
        'error',
      );
      return;
    }

    // Validation de type
    const allowedTypes: { [key: string]: string[] } = {
      cin: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
      releves: ['application/pdf'],
      diplome: ['application/pdf'],
      photo: ['image/jpeg', 'image/jpg', 'image/png'],
    };

    if (!allowedTypes[type].includes(file.type)) {
      this.toastService.show('Type de fichier non autorisé', 'error');
      return;
    }

    this.files[type] = file;
    this.progress[type] = 0;

    // Créer la prévisualisation
    this.createPreview(file, type);

    // Simuler le progrès d'upload
    this.simulateUploadProgress(type);

    // Mettre à jour le compteur
    this.updateDocumentCount();
  }

  private createPreview(file: File, type: string): void {
    const preview: FilePreview = {
      fileName: file.name,
      fileSize: this.formatFileSize(file.size),
      mimeType: file.type,
      isImage: file.type.startsWith('image/'),
    };

    if (preview.isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.previewUrl = e.target?.result as string;
        if (type === 'photo') {
          this.photoPreview = preview.previewUrl;
        }
      };
      reader.readAsDataURL(file);
    }

    this.previews[type] = preview;
  }

  private simulateUploadProgress(type: string): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      this.progress[type] = Math.round(progress);
    }, 200);
  }

  private updateDocumentCount(): void {
    this.documentsUploaded = Object.keys(this.files).length;
  }

  removeFile(type: string): void {
    delete this.files[type];
    delete this.previews[type];
    delete this.progress[type];
    if (type === 'photo') {
      this.photoPreview = null;
    }
    this.updateDocumentCount();
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  retourListe(): void {
    this.router.navigate(['/commission/dashboard']);
  }

  async soumettre(): Promise<void> {
    if (this.documentsUploaded < 4) {
      this.toastService.show('Tous les documents doivent être téléchargés', 'error');
      return;
    }

    this.isSubmitting = true;
    this.submitProgress = 0;

    try {
      // Étape 1: Validation des documents
      this.uploadStepLabel = 'Validation des documents...';
      await this.delay(1000);
      this.submitProgress = 25;

      // Étape 2: Upload des fichiers
      this.uploadStepLabel = 'Téléchargement des fichiers...';
      await this.delay(2000);
      this.submitProgress = 50;

      // Étape 3: Traitement OCR
      this.uploadStepLabel = 'Traitement OCR...';
      await this.delay(1500);
      this.submitProgress = 75;

      // Étape 4: Sauvegarde finale
      this.uploadStepLabel = 'Sauvegarde finale...';
      await this.delay(1000);
      this.submitProgress = 100;

      // TODO: Appeler le service pour soumettre les documents
      // await this.candidatureService.soumettreDocumentsCommission(this.files);

      this.toastService.show('Documents soumis avec succès', 'success');
      this.retourListe();
    } catch (error) {
      this.toastService.show('Erreur lors de la soumission des documents', 'error');
      console.error('Erreur soumission:', error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
