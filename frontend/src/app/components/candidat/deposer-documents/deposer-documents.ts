import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CandidatureService } from '../../../services/candidature.service';
import { SpecialitesService } from '../../../services/specialites.service';
import { FormsModule } from '@angular/forms';

interface FilePreview {
  fileName: string;
  fileSize: string;
  mimeType: string;
  isImage: boolean;
  previewUrl: string | null;
}

/** Définition d'une pièce officielle du dossier ISIMM */
interface PieceDef {
  key: string;
  titre: string;
  description: string;
  icon: string;
  iconClass: string;
  obligatoire: boolean;
  accept: string; // attribut accept de l'input
  allowedExt: string[]; // extensions autorisées (PARTIE B)
  pdfOnly: boolean; // doit obligatoirement être un PDF (PARTIE B)
  maxSizeMo: number;
}

@Component({
  selector: 'app-deposer-documents',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressBarModule, FormsModule],
  templateUrl: './deposer-documents.html',
  styleUrl: './deposer-documents.css',
})
export class DeposerDocumentsComponent implements OnInit, OnDestroy {
  // ── PARTIE A : liste officielle des 6 pièces ────────────────────────────
  readonly pieces: PieceDef[] = [
    {
      key: 'formulaire_candidature',
      titre: 'Les formulaires de candidature aux masters',
      description: 'Format : PDF | Taille max : 5 Mo',
      icon: 'fas fa-file-signature',
      iconClass: 'upload-dossier__icon--formulaire',
      obligatoire: true,
      accept: '.pdf',
      allowedExt: ['pdf'],
      pdfOnly: true,
      maxSizeMo: 5,
    },
    {
      key: 'cin',
      titre: "Copie de la Carte d'Identité Nationale (CIN)",
      description: 'Formats : PDF, JPG, PNG | Taille max : 5 Mo',
      icon: 'fas fa-id-card',
      iconClass: 'upload-dossier__icon--cin',
      obligatoire: true,
      accept: '.pdf,.jpg,.jpeg,.png',
      allowedExt: ['pdf', 'jpg', 'jpeg', 'png'],
      pdfOnly: false,
      maxSizeMo: 5,
    },
    {
      key: 'diplomes_bac',
      titre: "Diplômes obtenus depuis l'année du baccalauréat",
      description: 'Format : PDF | Taille max : 5 Mo',
      icon: 'fas fa-graduation-cap',
      iconClass: 'upload-dossier__icon--diplome',
      obligatoire: true,
      accept: '.pdf',
      allowedExt: ['pdf'],
      pdfOnly: true,
      maxSizeMo: 5,
    },
    {
      key: 'releves_bac',
      titre: "Relevés de notes depuis l'année du baccalauréat",
      description: 'Format : PDF | Taille max : 10 Mo',
      icon: 'fas fa-chart-line',
      iconClass: 'upload-dossier__icon--releves',
      obligatoire: true,
      accept: '.pdf',
      allowedExt: ['pdf'],
      pdfOnly: true,
      maxSizeMo: 10,
    },
    {
      key: 'attestation_retrait',
      titre:
        "Attestation(s) de retrait d'inscription et/ou de réorientation (le cas échéant)",
      description: 'Optionnel | Formats : PDF, JPG, PNG | Taille max : 5 Mo',
      icon: 'fas fa-file-circle-exclamation',
      iconClass: 'upload-dossier__icon--attestation',
      obligatoire: false,
      accept: '.pdf,.jpg,.jpeg,.png',
      allowedExt: ['pdf', 'jpg', 'jpeg', 'png'],
      pdfOnly: false,
      maxSizeMo: 5,
    },
    {
      key: 'cv',
      titre: 'Curriculum Vitae (CV)',
      description: 'Format : PDF | Taille max : 5 Mo',
      icon: 'fas fa-file-lines',
      iconClass: 'upload-dossier__icon--cv',
      obligatoire: true,
      accept: '.pdf',
      allowedExt: ['pdf'],
      pdfOnly: true,
      maxSizeMo: 5,
    },
  ];

  selectedFiles: { [key: string]: File | null } = {};
  filePreviews: { [key: string]: FilePreview | null } = {};
  uploadProgressByType: { [key: string]: number } = {};
  fileErrors: { [key: string]: string } = {};
  /** PARTIE B : empreintes SHA-256 par pièce (anti-doublon) */
  private fileHashes: { [key: string]: string } = {};

  documentsUploaded: number = 0;
  isSubmitting: boolean = false;
  submitProgress: number = 0;
  uploadStepLabel: string = 'En attente';

  availableSpecialites: string[] = [];
  selectedSpecialite: string = '';

  constructor(
    private router: Router,
    private candidatureService: CandidatureService,
    private specialitesService: SpecialitesService,
  ) {
    // Initialiser les maps pour chaque pièce
    this.pieces.forEach((p) => {
      this.selectedFiles[p.key] = null;
      this.filePreviews[p.key] = null;
      this.uploadProgressByType[p.key] = 0;
      this.fileErrors[p.key] = '';
    });
  }

  ngOnInit(): void {
    this.specialitesService.getSpecialitesData().subscribe(() => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
    });
  }

  ngOnDestroy(): void {
    this.clearAllObjectUrls();
  }

  /** Nombre de pièces obligatoires */
  get nbObligatoires(): number {
    return this.pieces.filter((p) => p.obligatoire).length;
  }

  /** Nombre de pièces obligatoires effectivement déposées */
  get nbObligatoiresDeposees(): number {
    return this.pieces.filter((p) => p.obligatoire && this.hasFile(p.key)).length;
  }

  get toutesObligatoiresPresentes(): boolean {
    return this.nbObligatoiresDeposees >= this.nbObligatoires;
  }

  // ── PARTIE B : sélection + validation du fichier ──────────────────────────
  async onFileSelected(event: any, piece: PieceDef): Promise<void> {
    const file: File | undefined = event?.target?.files?.[0];
    if (!file) return;

    this.fileErrors[piece.key] = '';

    const ext = (file.name.split('.').pop() || '').toLowerCase();

    // 1) Format global autorisé
    if (!piece.allowedExt.includes(ext)) {
      this.rejeter(piece, event, 'Ce fichier ne correspond pas au type attendu');
      return;
    }

    // 2) Contenu : PDF obligatoire pour relevés / diplômes / formulaire / CV
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    if (piece.pdfOnly && !isPdf) {
      this.rejeter(
        piece,
        event,
        'Cette pièce doit être un document PDF (les images ne sont pas acceptées).',
      );
      return;
    }

    // 3) Taille max
    const maxBytes = piece.maxSizeMo * 1024 * 1024;
    if (file.size > maxBytes) {
      this.rejeter(piece, event, `Fichier trop volumineux (max ${piece.maxSizeMo} Mo).`);
      return;
    }

    // 4) Anti-doublon : même fichier déposé pour 2 pièces différentes
    const hash = await this.computeHash(file);
    const doublonKey = Object.keys(this.fileHashes).find(
      (k) => k !== piece.key && this.fileHashes[k] === hash,
    );
    if (doublonKey) {
      const autre = this.pieces.find((p) => p.key === doublonKey);
      this.rejeter(
        piece,
        event,
        `Ce fichier a déjà été déposé pour « ${autre?.titre ?? 'une autre pièce'} ».`,
      );
      return;
    }

    // ✅ Validé
    this.revokePreviewUrl(piece.key);
    this.selectedFiles[piece.key] = file;
    this.filePreviews[piece.key] = this.buildFilePreview(file);
    this.fileHashes[piece.key] = hash;
    this.uploadProgressByType[piece.key] = 0;
    this.updateProgress();
  }

  private rejeter(piece: PieceDef, event: any, message: string): void {
    this.fileErrors[piece.key] = message;
    // réinitialiser l'input pour permettre de re-sélectionner le même fichier
    if (event?.target) event.target.value = '';
  }

  /** Calcule l'empreinte SHA-256 du contenu (anti-doublon) */
  private async computeHash(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // fallback si crypto.subtle indisponible (contexte non sécurisé)
      return `${file.name}:${file.size}:${file.lastModified}`;
    }
  }

  removeFile(key: string): void {
    this.revokePreviewUrl(key);
    this.selectedFiles[key] = null;
    this.filePreviews[key] = null;
    this.uploadProgressByType[key] = 0;
    this.fileErrors[key] = '';
    delete this.fileHashes[key];
    this.updateProgress();
  }

  hasFile(key: string): boolean {
    return !!this.selectedFiles[key];
  }

  getFileSize(file: File | null): string {
    if (!file) return '';
    const bytes = file.size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  updateProgress(): void {
    this.documentsUploaded = Object.values(this.selectedFiles).filter((f) => f !== null).length;
  }

  previewFor(key: string): FilePreview | null {
    return this.filePreviews[key] || null;
  }

  progressFor(key: string): number {
    if (!this.hasFile(key)) return 0;
    if (!this.isSubmitting && this.submitProgress === 0) return 100;
    return this.uploadProgressByType[key] ?? 0;
  }

  private syncPerDocumentProgress(progress: number): void {
    this.pieces
      .filter((p) => this.hasFile(p.key))
      .forEach((p) => (this.uploadProgressByType[p.key] = progress));
  }

  private buildFilePreview(file: File): FilePreview {
    const isImage = file.type.startsWith('image/');
    return {
      fileName: file.name,
      fileSize: this.getFileSize(file),
      mimeType: file.type || 'application/octet-stream',
      isImage,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
    };
  }

  private revokePreviewUrl(key: string): void {
    const preview = this.filePreviews[key];
    if (preview?.previewUrl) {
      URL.revokeObjectURL(preview.previewUrl);
    }
  }

  private clearAllObjectUrls(): void {
    Object.keys(this.filePreviews).forEach((key) => this.revokePreviewUrl(key));
  }

  soumettre(): void {
    if (!this.toutesObligatoiresPresentes) {
      alert('Veuillez déposer toutes les pièces obligatoires.');
      return;
    }

    this.isSubmitting = true;
    this.submitProgress = 10;
    this.uploadStepLabel = 'Préparation du dépôt';
    this.syncPerDocumentProgress(10);

    this.candidatureService.getMesCandidatures().subscribe({
      next: (items: any) => {
        const candidatures = Array.isArray(items) ? items : [];
        const cible =
          candidatures.find(
            (c: any) => c.statut === 'preselectionne' || c.statut === 'en_attente_dossier',
          ) ?? candidatures[0];

        if (!cible?.id) {
          this.isSubmitting = false;
          this.submitProgress = 0;
          alert('Aucune candidature trouvée');
          return;
        }

        const documents = this.pieces
          .filter((p) => this.hasFile(p.key))
          .map((p) => p.key);

        const payload = {
          formulaire: {
            cin: this.selectedFiles['cin']?.name ?? 'cin',
            telephone: '00000000',
            documents,
          },
        };

        this.uploadStepLabel = 'Envoi des données';

        this.candidatureService.deposerDossierNumeriqueWithProgress(cible.id, payload).subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress = event.total
                ? Math.round((event.loaded / event.total) * 100)
                : Math.min(this.submitProgress + 10, 95);
              this.submitProgress = Math.max(progress, 15);
              this.uploadStepLabel = 'Transfert en cours';
              this.syncPerDocumentProgress(this.submitProgress);
            }

            if (event.type === HttpEventType.Response) {
              this.submitProgress = 100;
              this.uploadStepLabel = 'Dossier soumis';
              this.syncPerDocumentProgress(100);
              this.isSubmitting = false;
              alert('Dossier soumis ✓');
              this.router.navigate(['/candidat/dashboard']);
            }
          },
          error: (error: any) => {
            this.isSubmitting = false;
            this.submitProgress = 0;
            this.uploadStepLabel = 'Erreur lors du dépôt';
            this.syncPerDocumentProgress(0);
            console.error('Erreur dépôt dossier:', error);
            const backendMessage = error?.error?.error;
            alert(`Échec du dépôt.${backendMessage ? `\n${backendMessage}` : ''}`);
          },
        });
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.submitProgress = 0;
        this.uploadStepLabel = 'Erreur de chargement';
        this.syncPerDocumentProgress(0);
        console.error('Erreur chargement candidatures:', error);
        alert('Impossible de charger les candidatures.');
      },
    });
  }
}
