import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

interface OffreIngenieurForm {
  id: number;
  titre: string;
  places: number;
  date_ouverture: string;
  date_limite: string;
  statut: 'ouvert' | 'ferme';
  document_officiel_pdf_url?: string | null;
}

@Component({
  selector: 'app-edit-offre-ingenieur',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-offre-ingenieur.html',
  styleUrl: './edit-offre-ingenieur.css',
})
export class EditOffreIngenieurComponent implements OnInit {
  offreId: number | null = null;
  isCreateMode = false;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  offreForm: OffreIngenieurForm = {
    id: 0,
    titre: '',
    places: 0,
    date_ouverture: '',
    date_limite: '',
    statut: 'ouvert',
    document_officiel_pdf_url: null,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    if (!rawId) {
      this.isCreateMode = true;
      const today = new Date().toISOString().split('T')[0];
      this.offreForm = {
        id: 0,
        titre: '',
        places: 0,
        date_ouverture: today,
        date_limite: '',
        statut: 'ouvert',
        document_officiel_pdf_url: null,
      };
      return;
    }

    const id = Number(rawId);
    if (!id || Number.isNaN(id)) {
      this.errorMessage = 'Identifiant offre invalide.';
      return;
    }

    this.offreId = id;
    this.loadOffre();
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard'], {
      queryParams: { view: 'parcours-ingenieurs' },
    });
  }

  loadOffre(): void {
    if (!this.offreId) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .get<any[]>('http://localhost:8003/api/candidatures/concours/?type_concours=ingenieur')
      .subscribe({
        next: (concours) => {
          const item = (concours || []).find((c) => Number(c.id) === this.offreId);
          if (!item) {
            this.errorMessage = 'Offre introuvable.';
            this.isLoading = false;
            return;
          }

          this.offreForm = {
            id: Number(item.id),
            titre: item.nom || '',
            places: Number(item.places_disponibles ?? 0),
            date_ouverture: item.date_ouverture || '',
            date_limite: item.date_cloture || '',
            statut: item.actif ? 'ouvert' : 'ferme',
            document_officiel_pdf_url: item.document_officiel_pdf_url || null,
          };

          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = "Erreur lors du chargement de l'offre.";
          this.isLoading = false;
        },
      });
  }

  saveOffre(): void {
    if (this.isSaving) {
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.errorMessage = 'Session invalide. Veuillez vous reconnecter.';
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const normalizedTitre = (this.offreForm.titre || '').trim();
    const normalizedDateLimite = (this.offreForm.date_limite || '').trim();

    if (!normalizedTitre || !normalizedDateLimite) {
      this.errorMessage = 'Champs obligatoires manquants: nom du parcours et date limite.';
      this.isSaving = false;
      return;
    }

    if (!this.offreForm.date_ouverture) {
      this.offreForm.date_ouverture = new Date().toISOString().split('T')[0];
    }

    const payload = {
      nom: normalizedTitre,
      specialite: normalizedTitre,
      description: normalizedTitre,
      type_concours: 'ingenieur',
      places_disponibles: this.offreForm.places,
      date_ouverture: this.offreForm.date_ouverture,
      date_cloture: normalizedDateLimite,
      actif: this.offreForm.statut === 'ouvert',
    };

    if (this.isCreateMode) {
      this.http
        .post('http://localhost:8003/api/candidatures/concours/admin/', payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: (created: any) => {
            this.successMessage = 'Offre ingénieur ajoutée avec succès.';
            this.isSaving = false;
            const newId = Number(created?.id);
            if (newId) {
              this.router.navigate(['/admin/offres-ingenieur', newId, 'edit']);
            }
          },
          error: (error) => {
            this.errorMessage =
              error?.error?.error || "Erreur lors de l'ajout de l'offre ingénieur.";
            this.isSaving = false;
          },
        });
      return;
    }

    if (!this.offreId) {
      this.errorMessage = 'Identifiant offre invalide.';
      this.isSaving = false;
      return;
    }

    this.http
      .patch(`http://localhost:8003/api/candidatures/concours/${this.offreId}/admin/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.successMessage = 'Offre ingénieur modifiée avec succès.';
          this.isSaving = false;
        },
        error: (error) => {
          this.errorMessage =
            error?.error?.error || "Erreur lors de la modification de l'offre ingénieur.";
          this.isSaving = false;
        },
      });
  }
}
