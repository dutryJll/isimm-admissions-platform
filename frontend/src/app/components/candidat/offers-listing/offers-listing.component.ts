import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CandidatureService } from '../../../services/candidature.service';
import { ToastService } from '../../../services/toast.service';

interface Offer {
  id: number;
  master_nom: string;
  master_id: number;
  specialite: string;
  date_limite: string;
  type: string;
  already_applied: boolean;
  places_disponibles?: number;
  code_parcours?: string;
  specialites_eligibles?: Array<{ nom: string; abreviation: string }>;
  statut?: string;
}

interface CapaciteRow {
  etablissement: string;
  typesDiplome: string;
  places: number;
}

interface CalendrierRow {
  event: string;
  date: string;
}

interface ScoreDetail {
  composante: string;
  formule: string;
}

interface ProgramData {
  keys: string[];
  code: string;
  title: string;
  subtitle: string;
  colorClass: string;
  icon: string;
  totalPlaces: number;
  capacite: CapaciteRow[];
  calendrier: CalendrierRow[];
  dossier: string[];
  scoreFormula: string;
  scoreDetails: ScoreDetail[];
  remarques: string[];
}

const PROGRAMS_DATA: ProgramData[] = [
  {
    keys: ['mpgl', 'mp-gl', 'génie logiciel', 'genie logiciel'],
    code: 'MP-GL',
    title: 'Mastère Professionnel en Génie Logiciel',
    subtitle: 'Master Professionnel',
    colorClass: 'prog-blue',
    icon: 'laptop-code',
    totalPlaces: 35,
    capacite: [
      {
        etablissement: 'ISIMM',
        typesDiplome: "Licence en Sciences de l'Informatique",
        places: 30,
      },
      {
        etablissement: 'Autres établissements',
        typesDiplome:
          "Licence en Sciences de l'Informatique ou en Informatique de Gestion (uniquement)",
        places: 5,
      },
    ],
    calendrier: [
      { event: 'Inscription sur le site web', date: "Du jour de la publication jusqu'au 22 juillet 2026" },
      { event: 'Résultats présélection', date: '28 juillet 2026' },
      { event: 'Dépôt dossiers numériques', date: 'Du 28 au 31 juillet 2026' },
      { event: 'Liste des admis', date: '08 août 2026' },
    ],
    dossier: [
      'Le formulaire de candidature au Mastère en Informatique (joint à cet avis)',
      'La fiche de candidature imprimée depuis le site web et dûment signée',
      'Un Curriculum Vitae (CV) sur une seule page avec adresse postale, téléphone et e-mail',
      'Copies certifiées conformes de tous les diplômes universitaires obtenus, y compris le Baccalauréat',
      'Copies certifiées conformes des relevés de notes de toutes les années universitaires ainsi que du Baccalauréat',
      "Tout document justifiant un report d'inscription ou une réorientation, le cas échéant",
    ],
    scoreFormula: 'Score = M.G + B.N.R + B.S.P',
    scoreDetails: [
      {
        composante: 'Moyenne Générale (M.G)',
        formule: '(Moyenne L1 + Moyenne L2 + Moyenne L3) ÷ 3',
      },
      {
        composante: 'Bonus Non-Redoublement (B.N.R)',
        formule: '5 pts si 0 redoublement · 3 pts si 1 · 0 pt si 2+',
      },
      {
        composante: 'Bonus Session Principale (B.S.P)',
        formule: '3 pts si 0 rattrapage · 2 pts si 1 · 0 pt si 2+',
      },
    ],
    remarques: [
      "Les dossiers reçus après les délais ou incomplets ne seront pas examinés.",
      "Toute candidature contenant des données erronées sera annulée. Des poursuites judiciaires seront engagées en cas de falsification.",
      "Les candidats non retenus peuvent déposer un recours avant le 31 juillet 2026 via e-mail.",
      "La présentation des documents originaux est obligatoire lors de l'inscription administrative.",
    ],
  },
  {
    keys: ['mpds', 'mp-ds', 'sciences des données', 'data science', 'données'],
    code: 'MP-DS',
    title: 'Mastère Professionnel en Sciences des Données',
    subtitle: 'Master Professionnel',
    colorClass: 'prog-teal',
    icon: 'chart-bar',
    totalPlaces: 35,
    capacite: [
      { etablissement: 'ISIMM', typesDiplome: 'Licence en Mathématiques Appliquées (ou équivalent)', places: 10 },
      { etablissement: 'ISIMM', typesDiplome: "Licence en Sciences de l'Informatique (ou équivalent)", places: 19 },
      { etablissement: 'Autres établissements', typesDiplome: 'Licence en Mathématiques Appliquées (ou équivalent)', places: 2 },
      { etablissement: 'Autres établissements', typesDiplome: "Licence en Sciences de l'Informatique (ou équivalent)", places: 4 },
    ],
    calendrier: [
      { event: 'Inscription en ligne', date: "Du jour de la publication jusqu'au 22 juillet 2026" },
      { event: 'Résultats présélection', date: '28 juillet 2026' },
      { event: 'Dépôt dossiers numériques', date: 'Du 28 au 31 juillet 2026' },
      { event: 'Liste finale des admis', date: '08 août 2026' },
    ],
    dossier: [
      'Formulaire de candidature au Mastère en Informatique (joint à l\'annonce)',
      'Fiche de candidature imprimée et signée depuis le site',
      'CV d\'une page avec adresse, téléphone et e-mail obligatoires',
      'Copie certifiée conforme de la CIN ou du passeport',
      'Copies certifiées conformes de tous les diplômes (y compris le Baccalauréat)',
      'Copies certifiées conformes des relevés de notes de toutes les années et du Baccalauréat',
      'Justificatifs de retrait d\'inscription ou de réorientation (si applicable)',
    ],
    scoreFormula: 'Score = M.G + B.N.R + B.S.P',
    scoreDetails: [
      { composante: 'Moyenne Générale (M.G)', formule: '(Moyenne L1 + Moyenne L2 + Moyenne L3) ÷ 3' },
      { composante: 'Bonus Non-Redoublement (B.N.R)', formule: '5 pts si 0 redoublement · 0 pt sinon' },
      { composante: 'Bonus Session Principale (B.S.P)', formule: '3 pts si 0 rattrapage · 0 pt sinon' },
    ],
    remarques: [
      "Tout dossier incomplet ou reçu après les délais sera automatiquement rejeté.",
      "Toute fausse déclaration entraîne l'annulation et des poursuites judiciaires.",
      "Les recours peuvent être déposés avec justificatifs avant le 31 juillet 2026.",
      "Les documents originaux sont obligatoires lors de l'inscription administrative finale.",
    ],
  },
  {
    keys: ['mp3i', 'mp-3i', 'instrumentation', 'génie des instruments', 'genie des instruments'],
    code: 'MP-3I',
    title: 'Mastère Professionnel en Génie des Instruments Industriels',
    subtitle: 'Master Professionnel',
    colorClass: 'prog-amber',
    icon: 'cog',
    totalPlaces: 25,
    capacite: [
      { etablissement: 'ISIMM', typesDiplome: 'Licence en EEA (MIM)', places: 8 },
      { etablissement: 'ISIMM', typesDiplome: 'Licence en EEA (SE)', places: 6 },
      { etablissement: 'ISIMM', typesDiplome: "Licence en Technologies de l'Information et de la Communication (TIC)", places: 6 },
      {
        etablissement: 'Autres établissements',
        typesDiplome: "Licence en Mesures et Instrumentation · Licence EEA · Licence Génie Électrique",
        places: 5,
      },
    ],
    calendrier: [
      { event: 'Inscription sur le site web', date: "Du jour de la publication jusqu'au 20 juillet 2026" },
      { event: 'Résultats présélection', date: '28 juillet 2026' },
      { event: 'Dépôt dossiers numériques', date: 'Du 28 au 31 juillet 2026' },
      { event: 'Liste finale des admis', date: '08 août 2026' },
    ],
    dossier: [
      'Formulaire de candidature imprimé depuis le site, signé avec photo d\'identité',
      'CV d\'une page incluant l\'adresse postale, le téléphone et l\'e-mail',
      'Copie de la Carte d\'Identité Nationale',
      'Copies certifiées conformes de tous les diplômes (Baccalauréat inclus)',
      'Copies certifiées conformes des relevés de notes de toutes les années et du Baccalauréat',
      'Justificatifs certifiés de tout report d\'inscription ou réorientation',
    ],
    scoreFormula: 'Score = M.P + M.R + M.C',
    scoreDetails: [
      {
        composante: 'Moyenne Pondérée (M.P)',
        formule: '(2 × Moy.Bac) + (1,5 × Moy.L1) + (1 × Moy.L2) + (0,5 × Moy.L3)',
      },
      { composante: 'Malus Redoublement (M.R)', formule: '-1 point par redoublement' },
      { composante: 'Malus Session de Contrôle (M.C)', formule: '-1 point par réussite en session de contrôle (L1, L2, L3)' },
    ],
    remarques: [
      "Les dossiers hors délais ou incomplets ne seront pas examinés.",
      "Toute donnée erronée entraîne l'annulation et des poursuites judiciaires en cas de falsification.",
      "Les recours justifiés peuvent être déposés avant le 31 juillet 2026 par e-mail.",
      "Les documents originaux sont obligatoires lors de l'inscription administrative finale.",
    ],
  },
  {
    keys: ['mrgl', 'mr-gl', 'recherche génie logiciel', 'mastère recherche informatique'],
    code: 'MR-GL',
    title: 'Mastère de Recherche en Sciences de l\'Informatique — Génie Logiciel',
    subtitle: 'Master Recherche',
    colorClass: 'prog-purple',
    icon: 'microscope',
    totalPlaces: 111,
    capacite: [
      { etablissement: 'ISIMM (Internes)', typesDiplome: 'Licence en Informatique', places: 19 },
      { etablissement: 'ISIMM (Internes)', typesDiplome: 'Maîtrise en Informatique', places: 30 },
      { etablissement: 'Autres établissements (Externes)', typesDiplome: 'Licence en Informatique ou Informatique de Gestion', places: 60 },
      { etablissement: 'Autres établissements (Externes)', typesDiplome: 'Maîtrise en Informatique ou Informatique de Gestion', places: 2 },
    ],
    calendrier: [
      { event: 'Inscription en ligne', date: "Du jour de la publication jusqu'au 22 juillet 2026" },
      { event: 'Annonce des résultats préliminaires', date: '28 juillet 2026' },
      { event: 'Dépôt dossiers numériques (pré-admis)', date: 'Du 28 au 31 juillet 2026' },
      { event: 'Liste finale des admis', date: '08 août 2026' },
    ],
    dossier: [
      'Demande de candidature au Mastère (jointe à l\'avis)',
      'Formulaire de candidature imprimé depuis le site (signé)',
      'CV d\'une seule page incluant adresse, téléphone et e-mail',
      'Copie de la Carte d\'Identité Nationale (CIN)',
      'Copies conformes de tous les diplômes (y compris le Baccalauréat)',
      'Copies conformes de tous les relevés de notes',
      'Justificatifs de retrait d\'inscription ou de réorientation (si applicable)',
    ],
    scoreFormula: 'Score (Licence) = 1,5×M1 + 2×M2 + M3 + B_NR + B_SP + (M_Bac + N_Math_Bac − 20)/2 + B_L + B_AD',
    scoreDetails: [
      { composante: 'B_NR (Bonus Non-Redoublement)', formule: '5 pts si 0 redoublement · 1,5 pts si 1 · 0 pt sinon' },
      { composante: 'B_SP (Bonus Session Principale)', formule: '3 pts si 0 session de contrôle · 1 pt si 1 · 0 pt sinon' },
      { composante: 'B_L (Bonus Langue)', formule: '1 pt si Français ≥ 12 ou Anglais ≥ 12 au Bac, ou Certification B2' },
      { composante: 'B_AD (Bonus Année Diplôme)', formule: '4 pts si diplôme 2026 ou 2023 · 2 pts si 2022/2021/2020' },
    ],
    remarques: [
      "Aucun dossier ne sera accepté après les délais ou s'il est incomplet.",
      "Toute fausse information entraîne l'annulation immédiate et des poursuites judiciaires pour falsification.",
      "Les candidats non retenus peuvent déposer une opposition justifiée par e-mail avant le 31 juillet 2026.",
      "La présentation des documents originaux est obligatoire lors de l'inscription administrative finale.",
    ],
  },
  {
    keys: ['mrmi', 'mr-mi', 'microélectronique', 'micro-electronique', 'instrumentation recherche'],
    code: 'MR-MI',
    title: 'Mastère de Recherche en Microélectronique et Instrumentation',
    subtitle: 'Master Recherche',
    colorClass: 'prog-indigo',
    icon: 'microchip',
    totalPlaces: 26,
    capacite: [
      {
        etablissement: 'ISIMM (1ère Année)',
        typesDiplome: 'Licence EEA, MIM ou TIC (Réseaux et IoT)',
        places: 15,
      },
      {
        etablissement: 'Autres (1ère Année)',
        typesDiplome: 'Licence en Électronique, Automatique ou Mesures et Instrumentation',
        places: 8,
      },
      {
        etablissement: 'ISIMM ou Autres (2ème Année)',
        typesDiplome: 'Réussite en 1ère année du cycle ingénieur (Électronique/Instrumentation) ou équivalent',
        places: 3,
      },
    ],
    calendrier: [
      { event: 'Inscription en ligne (Étape 1)', date: "Du jour de l'annonce jusqu'au 20 juillet 2026" },
      { event: 'Résultats préliminaires', date: '28 juillet 2026' },
      { event: 'Dépôt numérique (Étape 2)', date: 'Du 28 au 31 juillet 2026' },
      { event: 'Résultats finaux', date: '08 août 2026' },
    ],
    dossier: [
      'Formulaire de candidature rempli en ligne et signé',
      'CV d\'une page (Adresse, Tél, E-mail obligatoires)',
      'Copie de la CIN',
      'Copies de tous les diplômes (y compris le Bac)',
      'Copies des relevés de notes (cursus universitaire et Bac)',
    ],
    scoreFormula: 'Score (M1) = M.P + M.R + M.C',
    scoreDetails: [
      {
        composante: 'Moyenne Pondérée (M.P)',
        formule: '(0,5×Moy.Bac) + (1×Moy.L1) + (1,5×Moy.L2) + (2×Moy.L3 — S5 uniquement)',
      },
      { composante: 'Malus Redoublement (M.R)', formule: '-4 pts par redoublement (1 seul toléré)' },
      { composante: 'Malus Session Contrôle (M.C)', formule: '-1 pt (L1) · -1,5 pt (L2) · -2 pts (L3)' },
    ],
    remarques: [
      "Possible de postuler en M1 avec attestation de réussite de L3.",
      "Aucun dossier hors délais ne sera examiné.",
      "Toute donnée fausse ou document falsifié entraîne l'annulation immédiate et des poursuites judiciaires.",
    ],
  },
  {
    keys: ['ingenieur', 'cycle ingénieur', 'cycle_ingenieur', 'génie logiciel ingénieur', 'ing gl', 'ing_gl'],
    code: 'ING-GL',
    title: "Ingénieur en Sciences Appliquées et Technologie — Informatique, Génie Logiciel",
    subtitle: 'Cycle Ingénieur',
    colorClass: 'prog-red',
    icon: 'code',
    totalPlaces: 65,
    capacite: [
      { etablissement: 'Internes (Prépa ISIMM)', typesDiplome: "Étudiants ayant réussi la 2ème année du cycle préparatoire intégré en informatique à l'ISIMM", places: 52 },
      { etablissement: 'Externes (Licence Scientifique)', typesDiplome: 'Étudiants brillants inscrits en 3ème année de Licence (LMD) — spécialités scientifiques et techniques, sans redoublement', places: 13 },
    ],
    calendrier: [
      { event: 'Retrait des fiches de candidature', date: 'Disponible sur www.isimm.rnu.tn' },
      { event: 'Date limite de dépôt du dossier', date: 'Vendredi 8 août 2026 (cachet de la poste)' },
    ],
    dossier: [
      'Fiche de candidature retirée sur www.isimm.rnu.tn, remplie et signée',
      'Annexe (pour les externes) signée par le directeur de l\'établissement d\'origine',
      'Copie certifiée conforme du relevé de notes du Baccalauréat',
      'Copies certifiées conformes de tous les relevés de notes universitaires',
      'Copie de la CIN (ou passeport pour les étrangers)',
      "Justificatifs en cas de réorientation ou retrait d'inscription",
    ],
    scoreFormula: 'Internes: Score = M2 + B1 + B2 | Externes: Score = 0,5×(2M1 + 2M2 + M3) + 50×(1−R1) + 50×(1−R2)',
    scoreDetails: [
      { composante: 'M2 (Internes)', formule: 'Moyenne de la 2ème année préparatoire' },
      { composante: 'B1, B2 (Internes)', formule: '2 pts si session principale · 1,5 pts si rattrapage' },
      { composante: 'M1, M2 (Externes)', formule: 'Moyennes 1ère et 2ème année en session principale' },
      { composante: 'R1, R2 (Externes)', formule: 'Facteur basé sur le rang parmi les étudiants' },
    ],
    remarques: [
      "Le dossier doit être envoyé par courrier rapide à : ISIMM — Route de la Corniche — BP 223 — 5000 Monastir.",
      "Date limite : le vendredi 8 août 2026 (le cachet de la poste faisant foi).",
      "Catégorie 2 : candidats sans aucun redoublement durant leur cursus universitaire.",
    ],
  },
];

@Component({
  selector: 'app-offers-listing',
  standalone: true,
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule],
  templateUrl: './offers-listing.component.html',
  styleUrls: ['./offers-listing.component.css'],
})
export class OffersListingComponent implements OnInit {
  offers: Offer[] = [];
  filteredOffers: Offer[] = [];
  isLoading = false;
  errorMessage = '';
  filterType = 'all';

  selectedProgramData: ProgramData | null = null;
  selectedOffer: Offer | null = null;
  showModal = false;
  activeModalTab: 'programme' | 'dossier' | 'score' = 'programme';
  expandedSpecialitesIds = new Set<number>();

  constructor(
    private candidatureService: CandidatureService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadAvailableOffers();
  }

  private readonly FALLBACK_OFFERS: Offer[] = [
    { id: 1, master_id: 1, master_nom: 'Master Professionnel Genie Logiciel (MPGL)',                                  specialite: 'MPGL',   date_limite: '2026-07-22', type: 'master',         already_applied: false, places_disponibles: 35,  code_parcours: 'MPGL',   specialites_eligibles: [], statut: 'ouvert' },
    { id: 2, master_id: 2, master_nom: 'Mastere Professionnel en sciences de donnees (MPDS)',                         specialite: 'MPDS',   date_limite: '2026-07-22', type: 'master',         already_applied: false, places_disponibles: 35,  code_parcours: 'MPDS',   specialites_eligibles: [], statut: 'ouvert' },
    { id: 3, master_id: 3, master_nom: 'Mastere Professionnel en Ingenieries en Instrumentation industrielle (MP3I)', specialite: 'MP3I',   date_limite: '2026-07-20', type: 'master',         already_applied: false, places_disponibles: 25,  code_parcours: 'MP3I',   specialites_eligibles: [], statut: 'ouvert' },
    { id: 4, master_id: 4, master_nom: 'Mastere Recherche en Genie logiciel (MRGL)',                                  specialite: 'MRGL',   date_limite: '2026-07-22', type: 'master',         already_applied: false, places_disponibles: 111, code_parcours: 'MRGL',   specialites_eligibles: [], statut: 'ouvert' },
    { id: 5, master_id: 5, master_nom: 'Mastere Recherche en micro-electronique et instrumentation (MRMI)',           specialite: 'MRMI',   date_limite: '2026-07-20', type: 'master',         already_applied: false, places_disponibles: 29,  code_parcours: 'MRMI',   specialites_eligibles: [], statut: 'ouvert' },
    { id: 6, master_id: 6, master_nom: 'Ingenieur en sciences Appliquees et Technologie - Genie Logiciel',            specialite: 'ING_GL', date_limite: '2026-08-08', type: 'cycle_ingenieur', already_applied: false, places_disponibles: 65,  code_parcours: 'ING_GL', specialites_eligibles: [], statut: 'ouvert' },
  ];

  loadAvailableOffers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.candidatureService.getAvailableOffersWithSpecialites().subscribe({
      next: (response: any) => {
        const raw: any[] = response.offers && Array.isArray(response.offers)
          ? response.offers
          : Array.isArray(response) ? response : [];

        const mapped: Offer[] = raw.map((item: any): Offer => ({
          id: item.id ?? 0,
          master_id: item.master_id ?? item.id ?? 0,
          master_nom: item.master_nom ?? item.nom ?? item.titre ?? '',
          specialite: item.specialite ?? item.code_parcours ?? '',
          date_limite: item.date_limite ?? item.date_limite_preinscription ?? item.deadline ?? '',
          type: item.type ?? item.type_master ?? 'master',
          already_applied: item.already_applied ?? item.candidat_deja_applique ?? false,
          places_disponibles: item.places_disponibles ?? item.capacite_total ?? item.places ?? 0,
          code_parcours: item.code_parcours ?? item.specialite ?? '',
          specialites_eligibles: Array.isArray(item.specialites_eligibles) ? item.specialites_eligibles : [],
          statut: item.statut ?? 'ouvert',
        }));

        // Si l'API retourne des données → les utiliser, sinon fallback local
        this.offers = mapped.length > 0 ? mapped : [...this.FALLBACK_OFFERS];
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        // L'API est indisponible : afficher quand même les 6 parcours officiels
        this.offers = [...this.FALLBACK_OFFERS];
        this.applyFilters();
        this.isLoading = false;
      },
    });
  }

  toggleSpecialites(offerId: number, event: Event): void {
    event.stopPropagation();
    if (this.expandedSpecialitesIds.has(offerId)) {
      this.expandedSpecialitesIds.delete(offerId);
    } else {
      this.expandedSpecialitesIds.add(offerId);
    }
  }

  isSpecialitesExpanded(offerId: number): boolean {
    return this.expandedSpecialitesIds.has(offerId);
  }

  applyFilters(): void {
    this.filteredOffers = this.offers.filter((offer) => {
      if (this.filterType === 'all') return true;
      if (this.filterType === 'master') return offer.type !== 'cycle_ingenieur';
      if (this.filterType === 'ingenieur') return offer.type === 'cycle_ingenieur';
      return true;
    });
  }

  onFilterChange(type: string): void {
    this.filterType = type;
    this.applyFilters();
  }

  getProgramData(offer: Offer): ProgramData | undefined {
    const searchStr = (offer.master_nom + ' ' + offer.specialite + ' ' + offer.type).toLowerCase();
    return PROGRAMS_DATA.find((p) =>
      p.keys.some((k) => searchStr.includes(k.toLowerCase())),
    );
  }

  getColorClass(offer: Offer): string {
    const prog = this.getProgramData(offer);
    return prog?.colorClass ?? (offer.type === 'cycle_ingenieur' ? 'prog-red' : 'prog-blue');
  }

  getCode(offer: Offer): string {
    const prog = this.getProgramData(offer);
    return prog?.code ?? (offer.type === 'cycle_ingenieur' ? 'ING' : 'MASTER');
  }

  openDetails(offer: Offer): void {
    this.selectedOffer = offer;
    this.selectedProgramData = this.getProgramData(offer) ?? this.buildFallbackData(offer);
    this.activeModalTab = 'programme';
    this.showModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedOffer = null;
    this.selectedProgramData = null;
    document.body.style.overflow = '';
  }

  setTab(tab: 'programme' | 'dossier' | 'score'): void {
    this.activeModalTab = tab;
  }

  applyNow(offer: Offer): void {
    const type = offer.type === 'cycle_ingenieur' ? 'ingenieur' : 'master';
    window.location.href = `/candidature?type=${encodeURIComponent(type)}`;
  }

  daysRemaining(deadlineStr: string): number {
    if (!deadlineStr) return -1;
    return Math.floor((new Date(deadlineStr).getTime() - Date.now()) / 86400000);
  }

  daysLabel(deadlineStr: string): string {
    const d = this.daysRemaining(deadlineStr);
    if (d < 0) return 'Délai dépassé';
    if (d === 0) return "Aujourd'hui !";
    if (d === 1) return '1 jour restant';
    return `${d} jours restants`;
  }

  isUrgent(deadlineStr: string): boolean {
    const d = this.daysRemaining(deadlineStr);
    return d >= 0 && d <= 7;
  }

  private buildFallbackData(offer: Offer): ProgramData {
    return {
      keys: [],
      code: offer.type === 'cycle_ingenieur' ? 'ING' : 'MASTER',
      title: offer.master_nom,
      subtitle: offer.type === 'cycle_ingenieur' ? 'Cycle Ingénieur' : 'Master',
      colorClass: offer.type === 'cycle_ingenieur' ? 'prog-red' : 'prog-blue',
      icon: 'graduation-cap',
      totalPlaces: 0,
      capacite: [],
      calendrier: offer.date_limite
        ? [{ event: "Date limite d'inscription", date: offer.date_limite }]
        : [],
      dossier: [],
      scoreFormula: 'Consulter le site www.isimm.rnu.tn',
      scoreDetails: [],
      remarques: [],
    };
  }
}
