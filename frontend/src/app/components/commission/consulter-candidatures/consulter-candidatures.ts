import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router'; // ✅ RouterLink supprimé
import { CandidatureService } from '../../../services/candidature.service';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Candidature {
  id: number;
  first_name: string;
  last_name: string;
  cin: string;
  email: string;
  type: string;
  type_candidature: string;
  voeux?: string[];
  specialite?: string;
  score?: number;
  statut: string;
  date_soumission: string;
  selected?: boolean;
  ocr_analyse?: {
    resultat: 'en_cours' | 'valide' | 'invalide';
    rapport?: {
      documents_valides: number;
      documents_invalides: number;
      anomalies: string[];
      confiance_globale: number;
    };
  };
}

type CommissionDecision = 'accepter' | 'refuser';

@Component({
  selector: 'app-consulter-candidatures',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ], // ✅ RouterLink supprimé
  templateUrl: './consulter-candidatures.html',
  styleUrl: './consulter-candidatures.css',
})
export class ConsulterCandidaturesComponent implements OnInit {
  candidatures: Candidature[] = [];
  candidaturesFiltrees: Candidature[] = [];
  displayedColumns: string[] = [
    'ranking',
    'candidate',
    'cin',
    'type',
    'speciality',
    'score',
    'status',
    'actions',
  ];
  selectedCandidature: Candidature | null = null;
  detailRequested: boolean = false;
  loading = false;
  requestedCandidatureId: number | null = null;

  filtres = {
    type: '',
    statut: '',
    recherche: '',
  };

  constructor(
    private candidatureService: CandidatureService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const rawId = params.get('id');
      const id = rawId ? Number(rawId) : NaN;

      if (rawId && !Number.isNaN(id)) {
        this.detailRequested = true;
        this.requestedCandidatureId = id;
      } else {
        this.detailRequested = false;
        this.requestedCandidatureId = null;
        this.selectedCandidature = null;
      }

      this.syncSelectedCandidature();
    });

    this.loadCandidatures();
  }

  loadCandidatures(): void {
    this.loading = true;
    this.candidatureService.getCandidaturesCommissionClassees().subscribe({
      next: (response: any) => {
        const rawList = Array.isArray(response) ? response : response?.results || [];
        this.candidatures = rawList.map((item: any) => this.mapApiCandidature(item));
        this.appliquerFiltres();
        this.loading = false;
        this.syncSelectedCandidature();
      },
      error: () => {
        this.loading = false;
        this.candidatures = [];
        this.candidaturesFiltrees = [];
      },
    });
  }

  private mapApiCandidature(item: any): Candidature {
    return {
      id: Number(item.id),
      first_name: item.candidat_nom || item.first_name || '-',
      last_name: item.last_name || '',
      cin: item.candidat_cin || item.cin || '-',
      email: item.candidat_email || item.email || '-',
      type: item.type_concours || item.type || (item.concours ? 'ingenieur' : 'master'),
      type_candidature: item.type_concours || item.type_candidature || 'master',
      voeux: Array.isArray(item.voeux) ? item.voeux : item.master_nom ? [item.master_nom] : [],
      specialite: item.specialite || item.master_nom || '-',
      score: Number(item.score || 0),
      statut: item.statut || 'soumis',
      date_soumission: item.date_soumission || '',
      selected: false,
    };
  }

  private syncSelectedCandidature(): void {
    if (!this.requestedCandidatureId) {
      return;
    }

    this.selectedCandidature =
      this.candidatures.find((item) => item.id === this.requestedCandidatureId) || null;
  }

  appliquerFiltres(): void {
    this.candidaturesFiltrees = [...this.candidatures]
      .filter((c) => {
        const matchType = !this.filtres.type || c.type === this.filtres.type;
        const matchStatut = !this.filtres.statut || c.statut === this.filtres.statut;
        const matchRecherche =
          !this.filtres.recherche ||
          c.first_name.toLowerCase().includes(this.filtres.recherche.toLowerCase()) ||
          c.last_name.toLowerCase().includes(this.filtres.recherche.toLowerCase()) ||
          c.cin.includes(this.filtres.recherche) ||
          c.email.toLowerCase().includes(this.filtres.recherche.toLowerCase());

        return matchType && matchStatut && matchRecherche;
      })
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  resetFiltres(): void {
    this.filtres = {
      type: '',
      statut: '',
      recherche: '',
    };
    this.candidaturesFiltrees = [...this.candidatures];
  }

  getFullName(candidature: Candidature): string {
    return [candidature.first_name, candidature.last_name].filter(Boolean).join(' ').trim();
  }

  countByType(type: string): number {
    return this.candidaturesFiltrees.filter((c) => c.type === type).length;
  }

  countByStatut(statut: string): number {
    return this.candidaturesFiltrees.filter((c) => c.statut === statut).length;
  }

  toggleSelectAll(event: any): void {
    const checked = event.target.checked;
    this.candidaturesFiltrees.forEach((c) => (c.selected = checked));
  }

  hasSelection(): boolean {
    return this.candidaturesFiltrees.some((c) => c.selected);
  }

  countSelected(): number {
    return this.candidaturesFiltrees.filter((c) => c.selected).length;
  }

  analyserDossier(candidature: Candidature): void {
    candidature.ocr_analyse = {
      resultat: 'en_cours',
      rapport: undefined,
    };

    setTimeout(() => {
      const problemes = Math.random() > 0.7;

      candidature.ocr_analyse = {
        resultat: problemes ? 'invalide' : 'valide',
        rapport: {
          documents_valides: problemes ? 3 : 4,
          documents_invalides: problemes ? 1 : 0,
          anomalies: problemes ? ['Tampon manquant'] : [],
          confiance_globale: problemes ? 75 : 98,
        },
      };

      if (problemes) {
        if (confirm('Anomalies détectées. Envoyer réclamation ?')) {
          this.envoyerReclamation(candidature);
        }
      } else {
        alert('✅ Dossier valide !');
        candidature.statut = 'validee';
      }
    }, 3000);
  }

  voirRapportOCR(candidature: Candidature): void {
    if (!candidature.ocr_analyse?.rapport) {
      alert('Aucun rapport disponible');
      return;
    }

    const r = candidature.ocr_analyse.rapport;
    alert(`
📊 RAPPORT OCR
━━━━━━━━━━━━━━
✅ Valides: ${r.documents_valides}
❌ Invalides: ${r.documents_invalides}
🎯 Confiance: ${r.confiance_globale}%
${r.anomalies.length > 0 ? '\n⚠️ ' + r.anomalies.join('\n⚠️ ') : '✅ Aucune anomalie'}
    `);
  }

  envoyerReclamation(candidature: Candidature): void {
    alert(`📧 Réclamation envoyée à ${candidature.first_name} ${candidature.last_name}`);
  }

  voirDetails(candidature: Candidature): void {
    this.router.navigate(['/commission/candidatures', candidature.id]);
  }

  retourListe(): void {
    this.router.navigate(['/commission/candidatures']);
  }

  voirDossier(candidature: Candidature): void {
    this.router.navigate(['/consultation-dossier', candidature.id]);
  }

  deciderCandidature(
    candidature: Candidature,
    decision: CommissionDecision,
    motifRejet: string = '',
  ): void {
    this.candidatureService
      .deciderCandidatureCommission(candidature.id, decision, motifRejet)
      .subscribe({
        next: (response) => {
          const updated = response?.candidature
            ? this.mapApiCandidature(response.candidature)
            : candidature;
          this.candidatures = this.candidatures.map((item) =>
            item.id === updated.id ? updated : item,
          );
          this.appliquerFiltres();
          this.syncSelectedCandidature();
        },
        error: (err) => {
          // MOD v5 §G — message clair si la justification est manquante côté serveur
          alert(err?.error?.error || 'Erreur lors de la décision.');
        },
      });
  }

  accepter(candidature: Candidature): void {
    this.deciderCandidature(candidature, 'accepter');
  }

  // MOD v5 §G — Rejet avec justification obligatoire (motif saisi par le responsable).
  refuser(candidature: Candidature): void {
    const motif = (window.prompt('Motif du rejet (obligatoire, au moins 10 caractères) :', '') || '').trim();
    if (motif.length < 10) {
      alert('Justification obligatoire pour un rejet (au moins 10 caractères).');
      return;
    }
    this.deciderCandidature(candidature, 'refuser', motif);
  }

  deposerDossier(candidature: Candidature): void {
    this.router.navigate(['/commission/dossier/deposer', candidature.id]);
  }

  exporterExcel(): void {
    const selected = this.candidaturesFiltrees.filter((c) => c.selected);
    alert(`Export Excel de ${selected.length} candidature(s)`);
  }

  imprimer(): void {
    window.print();
  }
}
