import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

interface MasterForm {
  id: number;
  nom: string;
  type: 'recherche' | 'professionnel';
  specialite: string;
  description: string;
  places: number;
  date_limite: string;
  statut: 'ouvert' | 'ferme';
}

@Component({
  selector: 'app-edit-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-master.html',
  styleUrl: './edit-master.css',
})
export class EditMasterComponent implements OnInit {
  masterId: number | null = null;
  isCreateMode = false;
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  masterForm: MasterForm = {
    id: 0,
    nom: '',
    type: 'recherche',
    specialite: '',
    description: '',
    places: 0,
    date_limite: '',
    statut: 'ouvert',
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
      this.masterForm = {
        id: 0,
        nom: '',
        type: 'recherche',
        specialite: '',
        description: '',
        places: 0,
        date_limite: '',
        statut: 'ouvert',
      };
      return;
    }

    const id = Number(rawId);
    if (!id || Number.isNaN(id)) {
      this.errorMessage = 'Identifiant master invalide.';
      return;
    }

    this.masterId = id;
    this.loadMaster();
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard'], { queryParams: { view: 'parcours-master' } });
  }

  loadMaster(): void {
    if (!this.masterId) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .get<
        any[] | { results?: any[]; warning?: string }
      >('http://localhost:8003/api/candidatures/masters/')
      .subscribe({
        next: (response) => {
          const masters = Array.isArray(response)
            ? response
            : Array.isArray(response?.results)
              ? response.results
              : [];

          const item = masters.find((m) => Number(m.id) === this.masterId);
          if (!item) {
            this.errorMessage =
              (typeof response === 'object' && !Array.isArray(response) && response?.warning) ||
              'Master introuvable.';
            this.isLoading = false;
            return;
          }

          this.masterForm = {
            id: Number(item.id),
            nom: item.nom || '',
            type: item.type_master === 'professionnel' ? 'professionnel' : 'recherche',
            specialite: item.specialite || '',
            description: item.description || '',
            places: Number(item.places_disponibles ?? 0),
            date_limite: item.date_limite_candidature || '',
            statut: item.statut === 'ferme' ? 'ferme' : 'ouvert',
          };
          this.isLoading = false;
        },
        error: () => {
          this.errorMessage = 'Erreur lors du chargement du master.';
          this.isLoading = false;
        },
      });
  }

  saveMaster(): void {
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

    const normalizedNom = (this.masterForm.nom || '').trim();
    const normalizedType = (this.masterForm.type || '').trim() as 'recherche' | 'professionnel';
    const normalizedDate = (this.masterForm.date_limite || '').trim();

    if (!normalizedNom || !normalizedType || !normalizedDate) {
      this.errorMessage =
        'Champs obligatoires manquants: nom, type, date limite. Vérifiez le formulaire.';
      this.isSaving = false;
      return;
    }

    // Le backend exige specialite/description même si ces champs sont masqués dans l'UI.
    const autoSpecialite = normalizedNom;
    const autoDescription = normalizedNom;

    const payload = {
      nom: normalizedNom,
      type_master: normalizedType,
      specialite: autoSpecialite,
      description: autoDescription,
      places_disponibles: this.masterForm.places,
      date_limite_candidature: normalizedDate,
      actif: this.masterForm.statut === 'ouvert',
    };

    if (this.isCreateMode) {
      this.http
        .post('http://localhost:8003/api/candidatures/masters/admin/', payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: (created: any) => {
            this.successMessage = 'Master ajoute avec succes.';
            this.isSaving = false;
            const newId = Number(created?.id);
            if (newId) {
              this.router.navigate(['/admin/masters', newId, 'edit']);
            }
          },
          error: (error) => {
            this.errorMessage = error?.error?.error || "Erreur lors de l'ajout du master.";
            this.isSaving = false;
          },
        });
      return;
    }

    if (!this.masterId) {
      this.errorMessage = 'Identifiant master invalide.';
      this.isSaving = false;
      return;
    }

    this.http
      .patch(`http://localhost:8003/api/candidatures/masters/${this.masterId}/`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.successMessage = 'Master modifie avec succes.';
          this.isSaving = false;
        },
        error: (error) => {
          this.errorMessage = error?.error?.error || 'Erreur lors de la modification du master.';
          this.isSaving = false;
        },
      });
  }
}
