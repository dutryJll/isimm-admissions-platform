import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';

interface ProfessionalCriteriaRow {
  critere: string;
  coefficient: string;
  details: string;
}

interface ProfessionalMasterItem {
  code: 'mpgl' | 'mpds' | 'mp3i';
  titre: string;
  avis: string;
  capaciteTotale: string;
  repartition: string[];
  criteres: ProfessionalCriteriaRow[];
}

@Component({
  selector: 'app-professional-masters-exploration',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTableModule],
  templateUrl: './professional-masters-exploration.component.html',
  styleUrl: './professional-masters-exploration.component.css',
})
export class ProfessionalMastersExplorationComponent {
  recherche = '';
  displayedColumns: string[] = ['critere', 'coefficient', 'details'];

  calendrierCommun = {
    inscription: "Du jour de publication jusqu'au 22 juillet 2025",
    preselection: '28 juillet 2025',
    depot: 'Du 28 au 31 juillet 2025',
    resultatFinal: '08 août 2025',
    recours: 'Avant le 31 juillet 2025',
  };

  dossierNumerique = [
    'Formulaire de candidature au Mastère en Informatique.',
    'Fiche de candidature imprimée depuis le site et signée.',
    'CV sur une seule page avec adresse, téléphone et e-mail.',
    'Copie certifiée conforme des diplômes, y compris le Baccalauréat.',
    'Copies certifiées conformes des relevés de notes universitaires et du Bac.',
    'Justificatifs de réorientation ou report (si applicable).',
    'Tous les documents doivent être fusionnés en un seul PDF.',
  ];

  readonly masters: ProfessionalMasterItem[] = [
    {
      code: 'mpgl',
      titre: 'Mastère Professionnel en Génie Logiciel (MPGL)',
      avis: "Avis d'ouverture des candidatures pour l'année universitaire 2025-2026.",
      capaciteTotale: '35',
      repartition: [
        'ISIMM: 30 places (Licence en Sciences de l Informatique).',
        'Autres établissements: 05 places (Licence Info ou Info de Gestion uniquement).',
      ],
      criteres: [
        { critere: 'Moyenne générale (M.G)', coefficient: '70%', details: '(L1 + L2 + L3) / 3' },
        {
          critere: 'Bonus non redoublement (B.N.R)',
          coefficient: '20%',
          details: 'Aucun redoublement: 5, un: 3, deux et plus: 0.',
        },
        {
          critere: 'Bonus session principale (B.S.P)',
          coefficient: '10%',
          details: 'Aucun rattrapage: 3, un: 2, deux et plus: 0.',
        },
      ],
    },
    {
      code: 'mpds',
      titre: 'Mastère Professionnel en Sciences des Données (MPDS)',
      avis: "Avis d'ouverture des candidatures pour l'année universitaire 2025-2026.",
      capaciteTotale: '35',
      repartition: [
        'ISIMM: 10 (Math Appliquées) + 19 (Informatique).',
        'Autres établissements: 02 (Math Appliquées) + 04 (Informatique).',
      ],
      criteres: [
        {
          critere: 'Moyenne générale (M.G)',
          coefficient: '70%',
          details: '(Année 1 + Année 2 + Année 3) / 3',
        },
        {
          critere: 'Bonus non redoublement (B.N.R)',
          coefficient: '20%',
          details: 'Appliqué selon le parcours et l historique académique.',
        },
        {
          critere: 'Bonus session principale (B.S.P)',
          coefficient: '10%',
          details: 'Corrigé selon le nombre de validations en session principale.',
        },
      ],
    },
    {
      code: 'mp3i',
      titre: 'Mastère Professionnel en Génie des Instruments Industriels (MP3I)',
      avis: "Avis d'ouverture des candidatures pour l'année universitaire 2025-2026.",
      capaciteTotale: '25',
      repartition: [
        'ISIMM: 08 (MIM), 06 (SE), 06 (TIC).',
        'Autres établissements: 05 places sur spécialités compatibles.',
      ],
      criteres: [
        {
          critere: 'Moyenne pondérée (M.P)',
          coefficient: '80%',
          details: '(2 x Bac) + (1.5 x L1) + (1 x L2) + (0.5 x L3)',
        },
        {
          critere: 'Malus redoublement (M.R)',
          coefficient: '-10%',
          details: '-1 point par redoublement.',
        },
        {
          critere: 'Malus session de contrôle (M.C)',
          coefficient: '-10%',
          details: '-1 point par réussite en session de contrôle.',
        },
      ],
    },
  ];

  get mastersFiltres(): ProfessionalMasterItem[] {
    const query = this.recherche.trim().toLowerCase();
    if (!query) {
      return this.masters;
    }
    return this.masters.filter(
      (master) =>
        master.titre.toLowerCase().includes(query) || master.avis.toLowerCase().includes(query),
    );
  }

  remarquesImportantes = [
    'Tout dossier incomplet ou hors délai est rejeté.',
    'Toute donnée erronée annule la candidature et peut entraîner des poursuites.',
    'Les recours sont acceptés avant la date limite indiquée.',
    'Les originaux sont obligatoires lors de l inscription administrative finale.',
  ];
}
