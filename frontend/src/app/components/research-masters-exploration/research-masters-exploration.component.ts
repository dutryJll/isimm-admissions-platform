import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';

interface CriteriaRow {
  critere: string;
  coefficient: string;
  details: string;
}

interface MasterExploreItem {
  code: 'mrgl' | 'mrmi';
  titre: string;
  inscription: string;
  resultatsPreliminaires: string;
  depotNumerique: string;
  resultatsFinaux: string;
  capacite: string[];
  resumeScore: string;
  criteres: CriteriaRow[];
}

@Component({
  selector: 'app-research-masters-exploration',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTableModule],
  templateUrl: './research-masters-exploration.component.html',
  styleUrl: './research-masters-exploration.component.css',
})
export class ResearchMastersExplorationComponent {
  recherche = '';
  selectedMasterCode: MasterExploreItem['code'] | null = null;
  displayedColumns: string[] = ['critere', 'coefficient', 'details'];

  readonly masters: MasterExploreItem[] = [
    {
      code: 'mrgl',
      titre: 'Mastère Recherche en Génie Logiciel (MRGL)',
      inscription: "Jusqu'au 22 juillet 2025",
      resultatsPreliminaires: '28 juillet 2025',
      depotNumerique: 'Du 28 au 31 juillet 2025',
      resultatsFinaux: '08 août 2025',
      capacite: [
        '49 places (Licence: 19, Maîtrise: 30)',
        '62 places (Licence/Info Gestion: 60, Maîtrise/Info Gestion: 02)',
      ],
      resumeScore:
        'Classement par score automatique avec bonus non-redoublement, session principale, langue et année de diplôme.',
      criteres: [
        {
          critere: 'Moyenne générale cumulée',
          coefficient: '70%',
          details: 'Moyenne des années L1, L2 et L3.',
        },
        {
          critere: 'Bonus non redoublement',
          coefficient: '15%',
          details: 'Valorise un parcours sans redoublement.',
        },
        {
          critere: 'Session principale',
          coefficient: '10%',
          details: 'Bonus attribué selon le nombre de validations en session principale.',
        },
        {
          critere: 'Compétences linguistiques',
          coefficient: '5%',
          details: 'Prise en compte des certifications et niveaux déclarés.',
        },
      ],
    },
    {
      code: 'mrmi',
      titre: 'Mastère Recherche en Micro-électronique et Instrumentation (MRMI)',
      inscription: "Jusqu'au 20 juillet 2025",
      resultatsPreliminaires: '28 juillet 2025',
      depotNumerique: 'Du 28 au 31 juillet 2025',
      resultatsFinaux: '08 août 2025',
      capacite: ['23 places (Internes: 15, Externes: 08)', '03 places pour M2'],
      resumeScore:
        'Score basé sur moyenne pondérée et malus (redoublement, session de contrôle), avec conditions d équivalence pour M2.',
      criteres: [
        {
          critere: 'Moyenne pondérée',
          coefficient: '65%',
          details: 'Pondération des unités fondamentales en électronique et instrumentation.',
        },
        {
          critere: 'Historique académique',
          coefficient: '20%',
          details: 'Malus appliqué en cas de redoublement ou de sessions de contrôle répétées.',
        },
        {
          critere: 'Projet / PFE',
          coefficient: '10%',
          details: 'Évalue la qualité méthodologique et l innovation technique.',
        },
        {
          critere: 'Adéquation profil',
          coefficient: '5%',
          details: 'Compatibilité du diplôme d origine avec les attendus du parcours.',
        },
      ],
    },
  ];

  get mastersFiltres(): MasterExploreItem[] {
    const query = this.recherche.trim().toLowerCase();
    if (!query) {
      return this.masters;
    }

    return this.masters.filter(
      (item) =>
        item.titre.toLowerCase().includes(query) || item.resumeScore.toLowerCase().includes(query),
    );
  }

  get masterSelectionne(): MasterExploreItem | null {
    if (!this.selectedMasterCode) {
      return null;
    }
    return this.masters.find((item) => item.code === this.selectedMasterCode) || null;
  }

  afficherDetails(code: MasterExploreItem['code']): void {
    this.selectedMasterCode = code;
  }

  retourListe(): void {
    this.selectedMasterCode = null;
  }
}
