import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

// Backend API response structure
interface InscriptionsResponse {
  inscription_finalisee: Candidature[];
  inscription_incomplete: Candidature[];
  stats: {
    total_finalisee: number;
    total_incomplete: number;
    total: number;
  };
}

interface Candidature {
  id: number;
  cin: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  date_paiement?: string;
  date_limite_paiement?: string;
  statut_paiement?: 'on_time' | 'late' | 'not_paid';
  statut: string;
  selected?: boolean;
}

// Legacy interface for backward compatibility
interface Inscrit {
  id: number;
  prenom: string;
  nom: string;
  cin: string;
  email: string;
  telephone?: string;
  type: 'master' | 'ingenieur';
  master_id?: number;
  master_nom?: string;
  specialite?: string;
  score: number;
  rang: number;
  date_inscription: string;
  date_confirmation?: string;
  statut: 'en_attente' | 'confirme' | 'annule';
  selected?: boolean;
}

@Component({
  selector: 'app-gerer-inscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HttpClientModule],
  templateUrl: './gerer-inscriptions.html',
  styleUrl: './gerer-inscriptions.css',
})
export class GererInscriptionsComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // API data
  inscritsFinalises: Candidature[] = [];
  inscritsIncomplete: Candidature[] = [];
  inscritsFiltres: Candidature[] = [];
  inscrits: Inscrit[] = [];

  masters: any[] = [];

  // UI State
  recherche: string = '';
  filtreType: string = '';
  filtreMaster: string = '';
  filtreStatut: string = '';

  showModalAjouter: boolean = false;
  showModalDetails: boolean = false;
  inscritSelectionne: Candidature | Inscrit | null = null;

  // Tabs and import
  activeTab: 'finalisee' | 'incomplete' = 'finalisee';
  isImporting: boolean = false;
  importProgress: string = '';
  selectedMasterId: string = '1';

  nouveauInscrit: any = {
    prenom: '',
    nom: '',
    cin: '',
    email: '',
    type: '',
    master_id: '',
    specialite: '',
    score: null,
    rang: null,
    statut: 'en_attente',
  };

  private apiUrl: string;

  constructor(
    private router: Router,
    private http: HttpClient,
  ) {
    this.apiUrl = this.getApiUrl();
  }

  ngOnInit(): void {
    this.loadMasters();
    this.chargerInscriptions();
  }

  private getApiUrl(): string {
    return environment.candidatureServiceUrl;
  }

  /**
   * Appelle l'endpoint backend pour récupérer les listes finalisée et incomplete
   * GET /api/candidatures/inscriptions-administratives/?master_id=X
   */
  chargerInscriptions(): void {
    this.isImporting = true;
    this.importProgress = 'Chargement des inscriptions...';

    const masterId = this.selectedMasterId;

    this.http
      .get<InscriptionsResponse>(
        `${this.apiUrl}/inscriptions-administratives/?master_id=${masterId}`,
      )
      .subscribe({
        next: (response) => {
          this.inscritsFinalises = response.inscription_finalisee || [];
          this.inscritsIncomplete = response.inscription_incomplete || [];
          this.mettreAJourAffichage();
          this.isImporting = false;
          this.importProgress = '';
          console.log(
            '✅ Inscriptions chargées:',
            this.inscritsFinalises.length,
            'finalisées,',
            this.inscritsIncomplete.length,
            'incomplete',
          );
        },
        error: (err) => {
          this.isImporting = false;
          console.error('❌ Erreur chargement:', err);
          this.importProgress = `Erreur: ${err.status || 'Connexion'} - ${err.statusText || err.message}`;
          alert('Erreur lors du chargement des inscriptions: ' + this.importProgress);
        },
      });
  }

  /**
   * Met à jour l'affichage selon l'onglet actif
   */
  mettreAJourAffichage(): void {
    if (this.activeTab === 'finalisee') {
      this.inscritsFiltres = [...this.inscritsFinalises];
    } else {
      this.inscritsFiltres = [...this.inscritsIncomplete];
    }
    this.filtrerInscrits();
  }

  /**
   * Change l'onglet actif et met à jour l'affichage
   */
  changerOnglet(onglet: 'finalisee' | 'incomplete'): void {
    this.activeTab = onglet;
    this.mettreAJourAffichage();
  }

  /**
   * Déclenche le fichier d'import Excel
   */
  ouvrirImportExcel(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Gère le fichier Excel sélectionné et l'envoie au backend
   * POST /api/candidatures/importer-paiements/
   */
  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (!files || files.length === 0) return;

    const file = files[0];

    // Vérifier l'extension
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
      return;
    }

    this.isImporting = true;
    this.importProgress = `Upload en cours: ${file.name}...`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('master_id', this.selectedMasterId);

    this.http
      .post<{
        message: string;
        count: number;
        errors?: string[];
      }>(`${this.apiUrl}/importer-paiements/`, formData)
      .subscribe({
        next: (response) => {
          console.log('✅ Import réussi:', response.message);
          alert(
            `Import réussi! ${response.count} paiements importés.${response.errors?.length ? '\n\n' + response.errors.join('\n') : ''}`,
          );
          this.chargerInscriptions(); // Recharger la liste
          this.fileInput.nativeElement.value = '';
        },
        error: (err) => {
          console.error('❌ Erreur import:', err);
          alert(
            "Erreur lors de l'import: " +
              (err.error?.detail || err.error?.message || err.statusText || err.message),
          );
        },
        complete: () => {
          this.isImporting = false;
          this.importProgress = '';
        },
      });
  }

  /**
   * Exporte la liste actuelle en CSV
   */
  exporterCSV(): void {
    const masterId = this.selectedMasterId;

    this.http
      .get(`${this.apiUrl}/inscriptions-administratives/?master_id=${masterId}&export=csv`, {
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `inscriptions_${new Date().getTime()}.csv`;
          link.click();
          window.URL.revokeObjectURL(url);
          console.log('✅ Export réussi');
        },
        error: (err) => {
          console.error('❌ Erreur export:', err);
          alert("Erreur lors de l'export CSV");
        },
      });
  }

  loadMasters(): void {
    // TODO: Charger depuis une API si disponible
    this.masters = [
      { id: 1, nom: 'Master Recherche Génie Logiciel' },
      { id: 2, nom: 'Master Professionnel Data Science' },
      { id: 3, nom: 'Master Recherche Microélectronique' },
      { id: 4, nom: 'Master Professionnel Intelligence Artificielle' },
    ];
  }

  filtrerInscrits(): void {
    this.inscritsFiltres = this.inscritsFiltres.filter((i) => {
      const matchRecherche =
        !this.recherche ||
        (i.prenom && i.prenom.toLowerCase().includes(this.recherche.toLowerCase())) ||
        (i.nom && i.nom.toLowerCase().includes(this.recherche.toLowerCase())) ||
        (i.cin && i.cin.includes(this.recherche)) ||
        (i.email && i.email.toLowerCase().includes(this.recherche.toLowerCase()));

      return matchRecherche;
    });
  }

  countSelected(): number {
    return this.inscritsFiltres.filter((i) => i.selected).length;
  }

  toggleSelectAll(event: any): void {
    const checked = event.target.checked;
    this.inscritsFiltres.forEach((i) => (i.selected = checked));
  }

  voirDetails(inscrit: Candidature | Inscrit): void {
    this.inscritSelectionne = inscrit;
    this.showModalDetails = true;
  }

  fermerModal(): void {
    this.showModalAjouter = false;
    this.showModalDetails = false;
    this.inscritSelectionne = null;
  }

  getStatutPaiementLabel(statut: string | undefined | null | any): string {
    if (!statut) return '❓ Inconnu';
    const labels: any = {
      on_time: '✅ À temps',
      late: '⚠️ Retard',
      not_paid: '❌ Non payé',
    };
    return labels[statut] || '❓ Inconnu';
  }

  getStatutColor(statut: string | undefined | null | any): string {
    if (!statut) return '#6c757d';
    const colors: any = {
      on_time: '#28a745',
      late: '#ffc107',
      not_paid: '#dc3545',
    };
    return colors[statut] || '#6c757d';
  }

  // Legacy methods for backward compatibility (mock data)
  loadInscrits(): void {
    this.inscrits = [
      {
        id: 1,
        prenom: 'Ahmed',
        nom: 'Ben Ali',
        cin: '12345678',
        email: 'ahmed@example.com',
        telephone: '+216 98 765 432',
        type: 'master',
        master_id: 1,
        master_nom: 'Master Recherche Génie Logiciel',
        score: 17.5,
        rang: 1,
        date_inscription: '2026-03-01T10:30:00',
        date_confirmation: '2026-03-02',
        statut: 'confirme',
      },
    ];
  }

  filtrerInscritsByType(): Inscrit[] {
    return this.inscrits.filter((i) => !this.filtreType || i.type === this.filtreType);
  }

  countByType(type: string): number {
    return this.inscrits.filter((i) => i.type === type).length;
  }

  countByStatut(statut: string): number {
    return this.inscrits.filter((i) => i.statut === statut).length;
  }

  getStatutLabel(statut: string): string {
    const labels: any = {
      en_attente: 'En attente',
      confirme: 'Confirmé',
      annule: 'Annulé',
    };
    return labels[statut] || statut;
  }

  hasSelection(): boolean {
    return this.inscritsFiltres.some((i) => i.selected);
  }

  ouvrirModalAjouter(): void {
    this.showModalAjouter = true;
  }

  onTypeChange(): void {
    this.nouveauInscrit.master_id = '';
    this.nouveauInscrit.specialite = '';
  }

  isFormValid(): boolean {
    const base =
      this.nouveauInscrit.prenom &&
      this.nouveauInscrit.nom &&
      this.nouveauInscrit.cin &&
      this.nouveauInscrit.email &&
      this.nouveauInscrit.type &&
      this.nouveauInscrit.score;

    if (this.nouveauInscrit.type === 'master') {
      return base && this.nouveauInscrit.master_id;
    } else if (this.nouveauInscrit.type === 'ingenieur') {
      return base && this.nouveauInscrit.specialite;
    }

    return false;
  }

  ajouterInscrit(): void {
    if (!this.isFormValid()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    console.log('➕ Ajout inscription:', this.nouveauInscrit);

    const masterNom =
      this.nouveauInscrit.type === 'master'
        ? this.masters.find((m) => m.id == this.nouveauInscrit.master_id)?.nom
        : null;

    const nouvelInscrit: Inscrit = {
      id: this.inscrits.length + 1,
      ...this.nouveauInscrit,
      master_nom: masterNom,
      date_inscription: new Date().toISOString(),
    };

    this.inscrits.unshift(nouvelInscrit);

    alert('Inscription ajoutée avec succès !');
    this.fermerModal();
  }

  confirmerSelection(): void {
    const selection = this.inscritsFiltres.filter((i) => i.selected);
    if (confirm(`Confirmer ${selection.length} inscription(s) ?`)) {
      console.log('✅ Confirmations:', selection.length);
      alert(`${selection.length} inscription(s) confirmée(s)`);
    }
  }

  annulerSelection(): void {
    const selection = this.inscritsFiltres.filter((i) => i.selected);
    if (confirm(`Annuler ${selection.length} inscription(s) ?`)) {
      console.log('❌ Annulations:', selection.length);
      alert(`${selection.length} inscription(s) annulée(s)`);
    }
  }

  supprimerSelection(): void {
    const selection = this.inscritsFiltres.filter((i) => i.selected);
    if (confirm(`Supprimer définitivement ${selection.length} inscription(s) ?`)) {
      console.log('🗑️ Suppressions:', selection.length);
      alert(`${selection.length} inscription(s) supprimée(s)`);
    }
  }

  envoyerEmailSelection(): void {
    const selection = this.inscritsFiltres.filter((i) => i.selected);
    console.log('📧 Email à:', selection.length, 'inscrits');
    alert(`Email envoyé à ${selection.length} inscrit(s)`);
  }

  exporterExcel(): void {
    console.log('📊 Export Excel');
    alert('Export Excel en cours...');
  }
}
