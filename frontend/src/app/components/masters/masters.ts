import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { isPublicOffer } from '../../shared/public-offer';

interface ReferentielMasters {
  metadata?: any;
  sections_masters?: Record<string, any>;
  documents_requis_pdf_unique?: string[];
  regles_importantes?: string[];
  [key: string]: any;
}

interface MasterOffer {
  id: number;
  titre?: string;
  master_nom: string;
  type: string;
  specialite: string;
  statut: string;
  capacite_total: number;
  capacite_interne: number;
  capacite_externe: number;
  document_officiel_pdf_url?: string | null;
  [key: string]: any;
}

@Component({
  selector: 'app-masters',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './masters.html',
  styleUrl: './masters.css',
})
export class MastersComponent implements OnInit {
  private readonly candidatureApiBase = environment.candidatureServiceUrl;
  referentielMasters: ReferentielMasters | null = null;
  isLoadingReferentiel = false;
  referentielMessage = '';

  // Map to store PDF URLs by formation code (mpgl, mpds, mrgl, mrmi, mp3i, ing_info_gl)
  masterPdfUrls: Map<string, string> = new Map();
  isLoadingOffers = false;

  mastersRecherche = [
    {
      id: 1,
      titre: 'Master Recherche - Sciences de l Informatique: Ingenierie Logicielle (MRGL)',
      description:
        'Master de recherche avec selection sur score selon l appel a candidatures 2025/2026.',
      duree: '2 ans',
      prerequis: 'Licence',
      debouches: 'Recherche, R&D',
    },
  ];

  mastersProfessionnels = [
    {
      id: 3,
      titre: 'Master Professionnel en Ingenierie Logicielle (MPGL)',
      description: 'Ouverture officielle 2025/2026 avec preselection puis depot dossier numerique.',
      duree: '2 ans',
      prerequis: 'Licence',
      debouches: 'Developpement logiciel, architecture, DevOps',
    },
    {
      id: 4,
      titre: 'Master Professionnel en Science des Donnees (MPDS)',
      description: 'Formation appliquee en data science avec quotas officiels 2025/2026.',
      duree: '2 ans',
      prerequis: 'Licence',
      debouches: 'Data analyst, data scientist, IA appliquee',
    },
    {
      id: 5,
      titre: 'Master Professionnel en Ingenierie en Instrumentation Industrielle (MP3I)',
      description:
        'Formation professionnelle en instrumentation industrielle avec capacites officielles.',
      duree: '2 ans',
      prerequis: 'Licence',
      debouches: 'Instrumentation, automatismes, industrie 4.0',
    },
  ];

  // âœ… NOUVEAU : Cycle IngÃ©nieur
  cycleIngenieur = [
    {
      id: 1,
      titre: 'Cycle IngÃ©nieur - GÃ©nie Informatique',
      description:
        "Formation d'ingÃ©nieur en informatique axÃ©e sur le dÃ©veloppement logiciel, l'intelligence artificielle et les systÃ¨mes distribuÃ©s.",
      duree: '3 ans',
      prerequis: 'Bac + Concours',
      specialites: '2 (Info, Ã‰lectrique)',
    },
    {
      id: 2,
      titre: 'Cycle IngÃ©nieur - GÃ©nie Ã‰lectrique',
      description:
        "Formation d'ingÃ©nieur en Ã©lectronique et systÃ¨mes embarquÃ©s avec spÃ©cialisation en automatisation et Ã©nergie.",
      duree: '3 ans',
      prerequis: 'Bac + Concours',
      specialites: '2 (Info, Ã‰lectrique)',
    },
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadReferentielMasters();
    this.loadMasterOffersWithPdfs();
  }

  loadReferentielMasters(): void {
    this.isLoadingReferentiel = true;
    this.referentielMessage = '';

    this.http
      .get<ReferentielMasters>(`${this.candidatureApiBase}/masters/reglement-reference/`)
      .subscribe({
        next: (data) => {
          this.referentielMasters = data;
          this.isLoadingReferentiel = false;
        },
        error: (err) => {
          console.error('Erreur chargement référentiel masters:', err);
          this.referentielMessage =
            'Impossible de charger les détails officiels des appels d inscription. Vérifiez que le service candidature est actif sur le port 8003.';
          this.isLoadingReferentiel = false;
        },
      });
  }

  loadMasterOffersWithPdfs(): void {
    this.isLoadingOffers = true;

    // Load public offers (visible to candidates)
    this.http.get<MasterOffer[]>(`${this.candidatureApiBase}/offres-inscription/`).subscribe({
      next: (offers) => {
        offers
          .filter((offer) => isPublicOffer(offer) && offer.statut === 'ouvert')
          .forEach((offer) => {
            if (!offer.document_officiel_pdf_url) {
              return;
            }

            const code = this.resolveOfferCode(offer);
            if (code) {
              this.masterPdfUrls.set(code, offer.document_officiel_pdf_url);
            }
          });
        this.isLoadingOffers = false;
      },
      error: (err) => {
        console.error('Erreur chargement offres:', err);
        this.isLoadingOffers = false;
      },
    });
  }

  private resolveOfferCode(offer: MasterOffer): string | null {
    const haystack =
      `${offer.titre || ''} ${offer.master_nom || ''} ${offer.specialite || ''} ${offer.type || ''}`.toLowerCase();

    if (haystack.includes('science') && haystack.includes('donnee')) return 'mpds';
    if (haystack.includes('micro') && haystack.includes('instrument')) return 'mrmi';
    if (haystack.includes('instrumentation') || haystack.includes('3i')) return 'mp3i';
    if (haystack.includes('recherche') && haystack.includes('genie logiciel')) return 'mrgl';
    if (haystack.includes('ingenieur') && haystack.includes('informatique')) return 'ing_info_gl';
    if (haystack.includes('ingenierie logicielle') || haystack.includes('mpgl')) return 'mpgl';

    return null;
  }

  getPdfUrlForCode(code: string): string | null {
    return this.masterPdfUrls.get(code) || null;
  }

  hasPdfForCodes(codes: string[]): boolean {
    return codes.some((code) => !!this.masterPdfUrls.get(code));
  }

  downloadOfficialDocument(code: string): void {
    const pdfUrl = this.masterPdfUrls.get(code);
    if (!pdfUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getSection(code: string): any {
    return this.referentielMasters?.sections_masters?.[code] || null;
  }

  getTotalPlaces(code: string): number | null {
    const total = this.getSection(code)?.capacites?.total;
    return typeof total === 'number' ? total : null;
  }

  goToResearchExploration(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    // Double fallback: try router.navigate first, then window.location as backup
    setTimeout(() => {
      const navigationSuccess = this.router.navigate(['/exploration-masters-recherche']);

      if (!navigationSuccess) {
        window.location.href = '/exploration-masters-recherche';
      }
    }, 50);
  }
}
