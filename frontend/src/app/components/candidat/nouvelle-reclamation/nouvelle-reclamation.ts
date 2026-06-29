import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CandidatureService } from '../../../services/candidature.service';
import { AuthService } from '../../../services/auth.service';
import { isPublicOffer } from '../../../shared/public-offer';
import { environment } from '../../../../environments/environment';

interface CandidatureLight {
  id: number;
  master_id?: number;
  master_nom?: string;
}

interface MasterOption {
  id: number;
  nom: string;
}

@Component({
  selector: 'app-nouvelle-reclamation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouvelle-reclamation.html',
  styleUrl: './nouvelle-reclamation.css',
})
export class NouvelleReclamationComponent implements OnInit {
  mesCandidatures: CandidatureLight[] = [];
  masterOptions: MasterOption[] = [];

  formData: {
    master_id: string;
    objet: string;
    motif: string;
  } = {
    master_id: '',
    objet: '',
    motif: '',
  };

  // File and type support for justificatif upload
  justificatifFile: File | null = null;
  selectedFileName = '';

  // New field: type de reclamation (can be used to further classify)
  // We'll store it alongside formData as `type`
  // Note: kept separate for clarity in template binding
  reclamationType = '';

  isSubmitting = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private candidatureService: CandidatureService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.authService.getAccessToken();
    console.log('🔐 Token disponible?', !!token);
    if (!token) {
      console.warn('⚠️ Pas de token trouvé! Impossible de charger les candidatures');
      this.masterOptions = [];
      return;
    }

    console.log('📤 Appel getMesCandidatures() avec token...');
    this.candidatureService.getMesCandidatures().subscribe({
      next: (response: any) => {
        console.log('📥 Réponse reçue:', response);
        const list = Array.isArray(response) ? response : response?.results || [];
        console.log('📋 Après parsing - candidatures count:', list.length);

        this.mesCandidatures = list.map((item: any) => {
          const masterId = this.extractMasterId(item);
          console.log(
            `  - Item ID ${item?.id}: master_id=${masterId}, master_nom=${item?.master_nom}`,
          );
          return {
            id: Number(item?.id),
            master_id: masterId,
            master_nom: item?.master_nom ?? item?.master_name ?? 'Master',
          };
        });

        console.log('📋 Candidatures chargées:', this.mesCandidatures.length, 'items');
        console.log('📋 Détail candidatures:', JSON.stringify(this.mesCandidatures, null, 2));

        this.buildMasterOptionsFromCandidatures();
        console.log('✅ Master options extraites:', this.masterOptions.length, 'options');
        console.log('✅ Master options détail:', JSON.stringify(this.masterOptions, null, 2));
      },
      error: (err) => {
        console.error(
          '❌ Erreur chargement candidatures:',
          'Status:',
          err?.status,
          'Message:',
          err?.statusText,
          'Body:',
          err?.error,
        );
        this.mesCandidatures = [];
        this.masterOptions = [];
      },
    });
  }

  private extractMasterId(item: any): number | undefined {
    const fromMasterId = Number(item?.master_id);
    if (Number.isFinite(fromMasterId) && fromMasterId > 0) {
      console.log(`    ✓ extractMasterId: found from master_id field = ${fromMasterId}`);
      return fromMasterId;
    }

    const masterField = item?.master;
    if (typeof masterField === 'number') {
      console.log(`    ✓ extractMasterId: found from master field (number) = ${masterField}`);
      return masterField;
    }

    if (masterField && typeof masterField === 'object') {
      const nestedId = Number(masterField.id);
      if (Number.isFinite(nestedId) && nestedId > 0) {
        console.log(`    ✓ extractMasterId: found from master.id field = ${nestedId}`);
        return nestedId;
      }
    }

    console.log(`    ✗ extractMasterId: no valid master_id found in item`, item);
    return undefined;
  }

  private buildMasterOptionsFromCandidatures(): void {
    console.log('🔨 buildMasterOptionsFromCandidatures START');
    const unique = new Map<number, string>();

    for (const candidature of this.mesCandidatures) {
      const masterId = Number(candidature.master_id);
      console.log(
        `  Processing candidature ID=${candidature.id}, masterId=${masterId}, master_nom=${candidature.master_nom}`,
      );

      if (!Number.isFinite(masterId) || masterId <= 0) {
        console.log(`    → SKIPPED: masterId invalid (${masterId})`);
        continue;
      }

      const label = (candidature.master_nom || 'Master').trim();
      unique.set(masterId, label || 'Master');
      console.log(`    → ADDED: Map[${masterId}] = "${label}"`);
    }

    this.masterOptions = Array.from(unique.entries()).map(([id, nom]) => ({ id, nom }));
    console.log('🔨 buildMasterOptionsFromCandidatures END - found', unique.size, 'unique masters');
  }

  private loadMasterOptionsFromOffres(): void {
    const token = this.authService.getAccessToken();

    console.log("🔄 Chargement des offres d'inscription depuis l'API...");
    this.http
      .get<any>(`${environment.candidatureServiceUrl}/offres-inscription/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (response) => {
          console.log('✅ Réponse API offres:', response);
          const offres = Array.isArray(response)
            ? response
            : response?.results || response?.data || [];
          console.log('📋 Offres extraites:', offres);

          const unique = new Map<number, string>();

          for (const offre of offres) {
            if (!isPublicOffer(offre) || offre?.statut !== 'ouvert') {
              continue;
            }

            const id = Number(offre?.id);
            if (!Number.isFinite(id) || id <= 0) {
              console.warn('⚠️ ID invalide dans offre:', offre);
              continue;
            }

            const nom = (offre?.titre || offre?.nom || 'Master').toString();
            unique.set(id, nom);
          }

          this.masterOptions = Array.from(unique.entries()).map(([id, nom]) => ({ id, nom }));
          console.log('✅ Master options finales:', this.masterOptions);
        },
        error: (err) => {
          console.error('❌ Erreur chargement offres:', err);
          this.masterOptions = [];
        },
      });
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }
    if (!this.formData.master_id || !this.formData.objet || !this.formData.motif.trim()) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    this.isSubmitting = true;
    const token = this.authService.getAccessToken();

    const payload = new FormData();
    payload.append('master_id', String(Number(this.formData.master_id)));
    payload.append('objet', this.formData.objet);
    payload.append('motif', this.formData.motif.trim());
    if (this.reclamationType) {
      payload.append('type', this.reclamationType);
    }
    if (this.justificatifFile) {
      payload.append('justificatif', this.justificatifFile, this.justificatifFile.name);
    }

    this.http
      .post(`${environment.reclamationsServiceUrl}/creer/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          alert('Reclamation envoyee avec succes.');
          this.router.navigate(['/candidat/dashboard'], {
            queryParams: { view: 'reclamations' },
          });
        },
        error: () => {
          this.isSubmitting = false;
          alert("Erreur lors de l'envoi de la reclamation.");
        },
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }

    if (!this.isAllowedUploadFile(file)) {
      alert('Fichier non autorisé ou trop volumineux (max 5 Mo).');
      return;
    }

    this.justificatifFile = file;
    this.selectedFileName = file.name;
  }

  clearSelectedFile(): void {
    this.justificatifFile = null;
    this.selectedFileName = '';
  }

  isAllowedUploadFile(file: File): boolean {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      return false;
    }
    return true;
  }

  cancel(): void {
    this.router.navigate(['/candidat/dashboard'], {
      queryParams: { view: 'reclamations' },
    });
  }
}
