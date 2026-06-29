import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';
import { OffreRichContentService } from '../../services/offre-rich-content.service';
import { isPublicOffer, PublicOfferLike } from '../../shared/public-offer';

interface OfferItem extends PublicOfferLike {
  id: number;
  titre?: string;
  specialite?: string;
  type?: string;
  document_officiel_pdf_url?: string | null;
}

interface OffreMasterPublicDetail {
  id: number;
  titre: string;
  description: string;
  type_formation?: string;
  date_debut_visibilite?: string | null;
  date_fin_visibilite?: string | null;
  date_limite_preinscription?: string | null;
  date_limite_depot_dossier?: string | null;
  capacites_detaillees?: Array<{
    categorie?: string;
    origine?: string;
    quota?: number;
    diplome?: string;
  }>;
  statut_public?: 'ouvert' | 'ferme';
}

interface DetailTable {
  headers: string[];
  rows: string[][];
}

interface FormationDetail {
  code: string;
  title: string;
  intro: string;
  annee?: string;
  description?: string;
  sourceLabel?: string;
  tableTitle?: string;
  table?: DetailTable;
  scoreTableTitle?: string;
  scoreTable?: DetailTable;
  importantDates?: string[];
}

interface TimelineStep {
  title: string;
  subtitle: string;
  state: 'done' | 'current' | 'pending';
}

interface RequiredDocumentItem {
  label: string;
  icon: string;
  type: string;
}

const FORMATION_DETAILS: Record<string, FormationDetail> = {
  mpgl: {
    code: 'MPGL',
    title: 'Mastere Professionnel en Genie Logiciel (MPGL)',
    intro:
      'Avis d ouverture des candidatures pour l inscription en premiere annee du mastere professionnel Genie Logiciel a ISIMM.',
    annee: '2025-2026',
    tableTitle: 'Tableau des capacites d accueil et calendrier',
    table: {
      headers: [
        'Capacite totale',
        'Etablissement d origine',
        'Capacite',
        'Type de diplome',
        'Dates importantes',
      ],
      rows: [
        [
          '35',
          'ISIMM',
          '30',
          'Licence en Sciences de l Informatique',
          'Inscription sur le site web (formulaire en ligne).',
        ],
        [
          '',
          'Autres etablissements',
          '05',
          'Licence en Sciences de l Informatique ou Informatique de Gestion (uniquement)',
          "Du jour de la publication jusqu'au 22 juillet 2025.",
        ],
        ['', '', '', '', 'Annonce de la liste des etudiants preselectionnes: 28 juillet 2025.'],
        ['', '', '', '', 'Depot des dossiers numeriques (pre-admis): du 28 au 31 juillet 2025.'],
        ['', '', '', '', 'Annonce de la liste finale des admis: 08 aout 2025.'],
      ],
    },
  },
  mpds: {
    code: 'MPDS',
    title: 'Mastere Professionnel en sciences de donnees (DS)',
    intro:
      'Voici la traduction complete des documents fournis concernant le Mastere Professionnel en Sciences des Donnees a ISIMM pour l annee universitaire 2025-2026.',
    annee: '2025-2026',
    description:
      'Avis de Candidature : Mastere Professionnel en Sciences des Donnees. La direction de l Institut Superieur de l Informatique et des Mathematiques de Monastir annonce l ouverture des candidatures pour l inscription en premiere annee.',
    tableTitle: 'Tableau des capacites d accueil et calendrier',
    table: {
      headers: [
        'Capacite totale',
        'Etablissement d origine',
        'Capacite',
        'Type de diplome',
        'Dates importantes',
      ],
      rows: [
        [
          '35',
          'ISIMM',
          '10',
          'Licence en Mathematiques Appliquees (ou equivalent)',
          'Inscription en ligne :',
        ],
        [
          '',
          '',
          '19',
          'Licence en Sciences de l Informatique (ou equivalent)',
          "Du jour de la publication jusqu'au 22 juillet 2025.",
        ],
        [
          '',
          'Autres Etablissements',
          '02',
          'Licence en Mathematiques Appliquees (ou equivalent)',
          'Resultats de preselection : Le 28 juillet 2025.',
        ],
        [
          '',
          '',
          '04',
          'Licence en Sciences de l Informatique (ou equivalent)',
          'Depot des dossiers numeriques : Du 28 au 31 juillet 2025.',
        ],
        ['', '', '', '', 'Liste finale des admis : Le 08 aout 2025.'],
      ],
    },
  },
  mp3i: {
    code: 'MP3I',
    title: 'Mastere Professionnel en Ingenierie en Instrumentation Industrielle (3I)',
    intro:
      'Avis d ouverture des candidatures pour le mastere professionnel Genie des Instruments Industriels a ISIMM.',
    annee: '2025-2026',
    tableTitle: 'Tableau des capacites d accueil et calendrier',
    table: {
      headers: [
        'Capacite totale',
        'Etablissement d origine',
        'Capacite',
        'Type de diplome',
        'Dates importantes',
      ],
      rows: [
        [
          '25',
          'ISIMM',
          '08',
          'Licence en Electronique, Electrotechnique et Automatique (MIM)',
          'Inscription sur le site web (formulaire en ligne).',
        ],
        [
          '',
          '',
          '06',
          'Licence en Electronique, Electrotechnique et Automatique (SE)',
          "Du jour de la publication jusqu'au 20 juillet 2025.",
        ],
        [
          '',
          '',
          '06',
          'Licence en Technologies de l Information et de la Communication (TIC)',
          'Proclamation de la liste des etudiants preselectionnes: 28 juillet 2025.',
        ],
        [
          '',
          'Autres etablissements',
          '05',
          'Licence en Mesures et Instrumentation | Licence en EEA | Licence en Genie Electrique',
          'Depot des dossiers de candidature numeriques: du 28 au 31 juillet 2025.',
        ],
        ['', '', '', '', 'Proclamation de la liste finale des etudiants admis: 08 aout 2025.'],
      ],
    },
  },
  mrgl: {
    code: 'MRGL',
    title: 'Mastere Recherche en Genie Logiciel (MRGL)',
    intro:
      'Avis de candidature pour le mastere de recherche en Sciences de l Informatique: Genie Logiciel.',
    annee: '2025-2026',
    tableTitle: 'Capacite d accueil (Nombre de places)',
    importantDates: [
      "Inscription en ligne: du jour de publication jusqu'au 22 juillet 2025.",
      'Annonce des resultats preliminaires: 28 juillet 2025.',
      'Depot des dossiers numeriques (pre-admis): du 28 au 31 juillet 2025.',
      'Liste finale des admis: 08 aout 2025.',
    ],
    table: {
      headers: ['Etablissement d origine', 'Type de diplome', 'Capacite'],
      rows: [
        ['ISIMM (Internes)', 'Licence en Informatique', '19'],
        ['', 'Maitrise en Informatique', '30'],
        [
          'Autres etablissements (Externes)',
          'Licence en Informatique ou Informatique de Gestion',
          '60',
        ],
        ['', 'Maitrise en Informatique ou Informatique de Gestion', '02'],
      ],
    },
  },
  mrmi: {
    code: 'MRMI',
    title: 'Mastere Recherche en Micro-electronique et Instrumentation (MRMI)',
    intro:
      'Avis de candidature pour le mastere de recherche en Microelectronique et Instrumentation a ISIMM.',
    annee: '2025-2026',
    tableTitle: 'Capacite d accueil et diplomes requis',
    table: {
      headers: ['Annee', 'Etablissement d origine', 'Type de diplome requis', 'Places', 'Total'],
      rows: [
        [
          '1ere annee',
          'ISIMM (Internes)',
          'Licence en EEA, MIM (Electronique, Systemes Embarques, Metrologie) ou TIC',
          '15',
          '23',
        ],
        [
          '',
          'Autres (Externes)',
          'Licence en Electronique, Automatique ou Mesures et Instrumentation',
          '08',
          '',
        ],
        [
          '2eme annee',
          'ISIMM ou autres',
          'Reussite en 1ere annee du cycle ingenieur (Electronique/Instrumentation) ou equivalent',
          '03',
          '03',
        ],
      ],
    },
  },
  ing_info_gl: {
    code: 'ING_INFO_GL',
    title: 'Cycle Ingenieur en Informatique (Genie Logiciel)',
    intro:
      'Concours specifique d acces au cycle ingenieur en Informatique - Genie Logiciel a ISIMM.',
    annee: '2025-2026',
    description:
      'Eligibilite: etudiants reussis en 2eme annee preparatoire integree ISIMM ou etudiants brillants en 3eme annee licence scientifique/technique sans redoublement.',
    tableTitle: 'Nombre de places disponibles',
    table: {
      headers: [
        'Specialite',
        'Places pour les internes (Prepa ISIMM)',
        'Places pour les externes (Licence scientifique)',
      ],
      rows: [['Genie Logiciel (Informatique)', '52', '13']],
    },
  },
};

@Component({
  selector: 'app-preinscription-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './preinscription-detail.component.html',
  styleUrl: './preinscription-detail.component.css',
})
export class PreinscriptionDetailComponent implements OnInit {
  private readonly candidatureApiBase = environment.candidatureServiceUrl;

  detail: FormationDetail | null = null;
  code = '';
  pdfUrl: string | null = null;
  isLoadingOffer = false;
  hasSyncedContent = false;
  syncedOfferId: number | null = null;

  readonly candidatureSteps: TimelineStep[] = [
    {
      title: 'Inscription',
      subtitle: 'Creation de compte et validation de la preinscription.',
      state: 'done',
    },
    {
      title: 'Depot',
      subtitle: 'Soumission du dossier numerique et verification automatique.',
      state: 'current',
    },
    {
      title: 'Selection',
      subtitle: 'Classement, deliberation de commission et resultat final.',
      state: 'pending',
    },
  ];

  private readonly requiredDocsByTrack: Record<string, RequiredDocumentItem[]> = {
    default: [
      { label: 'Carte d identite nationale (CIN)', icon: 'badge', type: 'PDF / Image' },
      { label: 'Diplome principal ou attestation', icon: 'workspace_premium', type: 'PDF' },
      { label: 'Releves de notes (toutes annees)', icon: 'table_chart', type: 'PDF' },
      { label: 'Curriculum Vitae', icon: 'description', type: 'PDF' },
    ],
    mrmi: [
      { label: 'CIN / Passeport', icon: 'badge', type: 'PDF / Image' },
      { label: 'Diplome en Electronique / Instrumentation', icon: 'memory', type: 'PDF' },
      { label: 'Releves L1-L2-L3 ou equivalent', icon: 'insights', type: 'PDF' },
      { label: 'CV technique', icon: 'article', type: 'PDF' },
    ],
    ing_info_gl: [
      { label: 'CIN / Passeport', icon: 'badge', type: 'PDF / Image' },
      { label: 'Attestation de reussite (prepa/licence)', icon: 'school', type: 'PDF' },
      { label: 'Releves de notes details', icon: 'leaderboard', type: 'PDF' },
      { label: 'Lettre de motivation', icon: 'mail', type: 'PDF' },
    ],
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private offreRichContentService: OffreRichContentService,
  ) {}

  ngOnInit(): void {
    const codeParam = (this.route.snapshot.paramMap.get('code') || '').toLowerCase();
    const offerId = Number(this.route.snapshot.queryParamMap.get('offerId'));
    this.code = codeParam;
    this.detail = FORMATION_DETAILS[codeParam] || null;

    if (this.detail) {
      this.loadOfficialPdfForCode(this.detail.code);
    }

    if (Number.isFinite(offerId) && offerId > 0) {
      this.loadRealtimePublicOffer(offerId, codeParam);
    }
  }

  get requiredDocuments(): RequiredDocumentItem[] {
    const key = this.normalizeTrackCode(this.detail?.code || this.code);
    return this.requiredDocsByTrack[key] || this.requiredDocsByTrack['default'];
  }

  isEtablissementColumn(header: string): boolean {
    const normalized = this.normalizeHeader(header);
    return normalized.includes('etablissement') || normalized.includes('origine');
  }

  getPlacesColumnIndex(headers: string[]): number {
    const explicitPlaces = headers.findIndex((header) => {
      const normalized = this.normalizeHeader(header);
      return normalized.includes('places');
    });
    if (explicitPlaces >= 0) {
      return explicitPlaces;
    }

    const capaciteColumn = headers.findIndex((header) => {
      const normalized = this.normalizeHeader(header);
      return normalized.includes('capacite') && !normalized.includes('total');
    });
    if (capaciteColumn >= 0) {
      return capaciteColumn;
    }

    return headers.findIndex((header) => this.normalizeHeader(header).includes('capacite'));
  }

  getPlaceProgress(row: string[], headers: string[]): { valueLabel: string; percent: number } {
    const placesIndex = this.getPlacesColumnIndex(headers);
    if (placesIndex < 0) {
      return { valueLabel: '-', percent: 0 };
    }

    const valueLabel = row[placesIndex] || '-';
    const places = this.extractNumber(valueLabel);
    if (places === null) {
      return { valueLabel, percent: 0 };
    }

    const totalIndex = headers.findIndex((header) => {
      const normalized = this.normalizeHeader(header);
      return normalized.includes('total');
    });

    let denominator: number | null = null;
    if (totalIndex >= 0) {
      denominator = this.extractNumber(row[totalIndex]);
    }

    if (!denominator || denominator <= 0) {
      const tableRows = this.detail?.table?.rows || [];
      const maxObserved = tableRows
        .map((currentRow) => this.extractNumber(currentRow[placesIndex]))
        .filter((value): value is number => value !== null)
        .reduce((max, current) => Math.max(max, current), 0);
      denominator = maxObserved > 0 ? maxObserved : places;
    }

    const percent = Math.max(0, Math.min(100, Math.round((places / denominator) * 100)));
    return { valueLabel, percent };
  }

  private normalizeTrackCode(value: string): string {
    const normalized = (value || '').toLowerCase().trim();
    if (normalized.includes('mrmi')) {
      return 'mrmi';
    }
    if (normalized.includes('ing')) {
      return 'ing_info_gl';
    }
    return normalized;
  }

  private normalizeHeader(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private extractNumber(value: string | undefined): number | null {
    if (!value) {
      return null;
    }
    const match = String(value).match(/\d+(?:[.,]\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[0].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private loadRealtimePublicOffer(offerId: number, codeParam: string): void {
    this.http
      .get<OffreMasterPublicDetail>(`${this.candidatureApiBase}/offres-master/${offerId}/public/`)
      .subscribe({
        next: (offer) => {
          const rows = Array.isArray(offer.capacites_detaillees)
            ? offer.capacites_detaillees.map((row) => [
                row?.categorie || '-',
                row?.origine || '-',
                String(row?.quota ?? '-'),
                row?.diplome || '-',
              ])
            : [];

          const dates = [
            this.formatDateLine(
              'Visibilite',
              offer.date_debut_visibilite,
              offer.date_fin_visibilite,
            ),
            offer.date_limite_preinscription
              ? `Date limite preinscription: ${offer.date_limite_preinscription}`
              : '',
            offer.date_limite_depot_dossier
              ? `Date limite depot dossier: ${offer.date_limite_depot_dossier}`
              : '',
            offer.statut_public
              ? `Statut: ${offer.statut_public === 'ouvert' ? 'Ouverte' : 'Fermee'}`
              : '',
          ].filter((line) => !!line);

          this.hasSyncedContent = true;
          this.syncedOfferId = offerId;
          this.detail = {
            code: codeParam || String(offerId),
            title: offer.titre,
            intro: offer.description || 'Offre publiee par la commission.',
            description: offer.description || '',
            sourceLabel: 'Version commission publiee (temps reel)',
            tableTitle: 'Capacite & diplomes',
            table: {
              headers: ['Categorie', 'Etablissement', 'Quota', 'Diplome requis'],
              rows,
            },
            importantDates: dates,
          };
        },
        error: () => {
          this.loadSyncedContent(offerId, codeParam);
        },
      });
  }

  private loadSyncedContent(offerId: number, codeParam: string): void {
    this.offreRichContentService.getOffreRichContent(offerId).subscribe({
      next: (custom) => {
        if (!custom) {
          return;
        }

        this.hasSyncedContent = true;
        this.syncedOfferId = offerId;
        this.detail = {
          code: codeParam || String(offerId),
          title: custom.title,
          intro: custom.openingTitle,
          description: custom.openingBody,
          sourceLabel: 'Contenu synchronisé depuis l espace responsable',
          tableTitle: custom.tableTitle,
          table: {
            headers: custom.tableHeaders,
            rows: custom.tableRows,
          },
          scoreTableTitle: custom.scoreTitle || 'Calcul du score',
          scoreTable: {
            headers: custom.scoreTableHeaders || ['Composantes', 'Mode de Calcul'],
            rows:
              custom.scoreTableRows && custom.scoreTableRows.length > 0
                ? custom.scoreTableRows
                : [
                    ['Score', custom.scoreFormula || ''],
                    ['Moyenne Générale (M.G)', custom.moyenneFormula || ''],
                    [
                      'Bonus (B.N.R / B.S.P)',
                      [...(custom.bnrRules || []), ...(custom.bspRules || [])].join(' '),
                    ],
                  ],
          },
          importantDates: [custom.etape1, custom.etape2, ...custom.evaluationNotes],
        };
      },
      error: () => {
        this.hasSyncedContent = false;
        this.syncedOfferId = null;
      },
    });
  }

  private loadOfficialPdfForCode(code: string): void {
    this.isLoadingOffer = true;

    this.http.get<OfferItem[]>(`${this.candidatureApiBase}/offres-inscription/`).subscribe({
      next: (offers) => {
        const match = this.findOfferByCode(
          code,
          (offers || []).filter((offer) => isPublicOffer(offer) && offer.statut === 'ouvert'),
        );
        this.pdfUrl = match?.document_officiel_pdf_url || null;
        this.isLoadingOffer = false;
      },
      error: () => {
        this.pdfUrl = null;
        this.isLoadingOffer = false;
      },
    });
  }

  private formatDateLine(label: string, start?: string | null, end?: string | null): string {
    if (!start && !end) {
      return '';
    }
    if (start && end) {
      return `${label}: du ${start} au ${end}`;
    }
    return `${label}: ${start || end}`;
  }

  private findOfferByCode(code: string, offers: OfferItem[]): OfferItem | undefined {
    const normalizedCode = code.toLowerCase();
    const rules: Record<string, string[]> = {
      mpgl: ['ingenierie logicielle', 'mpgl'],
      mpds: ['science des donnees', 'donnees', 'mpds', 'data'],
      mp3i: ['instrumentation', 'genie des instruments', '3i'],
      mrgl: ['recherche', 'genie logiciel', 'mrgl'],
      mrmi: ['micro', 'instrumentation', 'mrmi'],
      ing_info_gl: ['cycle ingenieur', 'genie logiciel', 'informatique', 'concours'],
    };

    const expected = rules[normalizedCode] || [];

    return offers.find((offer) => {
      const haystack =
        `${offer.titre || ''} ${offer.specialite || ''} ${offer.type || ''}`.toLowerCase();
      return expected.every((token) => haystack.includes(token));
    });
  }
}
