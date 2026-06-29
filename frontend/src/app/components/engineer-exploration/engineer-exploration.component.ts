import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-engineer-exploration',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './engineer-exploration.component.html',
  styleUrl: './engineer-exploration.component.css',
})
export class EngineerExplorationComponent {
  concoursInfo = {
    titre: 'Concours Cycle d\'Ingénieur en Sciences Appliquées et Technologie',
    annee: 'Annee universitaire 2025-2026',
    autorite:
      'Concours sur dossiers ouvert par le Ministere de l Enseignement Superieur et de la Recherche Scientifique.',
  };

  eligibilite = [
    'Categorie 1: Etudiants admis en 2eme annee du cycle preparatoire integre en informatique a l ISIMM (2024-2025).',
    'Categorie 2: Etudiants excellents en 3eme annee Licence scientifique/technique (2024-2025), sans redoublement.',
  ];

  capaciteGl = {
    specialite: 'Genie Logiciel (Informatique)',
    internes: '52 places (Prepa ISIMM)',
    externes: '13 places (Licence scientifique)',
  };

  scoreInterne = [
    'Formule: Score = M2 + B1 + B2',
    'M2: Moyenne de la 2eme annee.',
    'B1: 2 pts (session principale) ou 1.5 pts (rattrapage).',
    'B2: 2 pts (session principale) ou 1.5 pts (rattrapage).',
    'En cas de redoublement, les bonus baissent selon la session (1 ou 0 pt).',
  ];

  scoreLicence = [
    'Formule: Score = 0.5 x (2M1 + 2M2 + M3) + 50 x (1 - R1) + 50 x (1 - R2).',
    'M1, M2: Moyennes de L1 et L2 en session principale.',
    'M3: Moyenne du S1 en 3eme annee (session principale).',
    'R1, R2: Facteurs bases sur le rang de l etudiant.',
  ];

  dossier = [
    'Fiche de candidature (www.isimm.rnu.tn), signee.',
    'Annexe externe signee par le directeur de l etablissement d origine.',
    'Copie certifiee conforme du releve de notes du Baccalaureat.',
    'Copies certifiees conformes des releves de notes universitaires.',
    'Copie CIN (ou passeport pour etudiants etrangers).',
    'Justificatifs en cas de reorientation ou retrait d inscription.',
  ];

  envoi = {
    mode: 'Envoi obligatoire par courrier rapide.',
    adresse: 'ISIMM - Route de la Corniche - BP 223 - 5000 Monastir.',
    dateLimite: 'Vendredi 08 aout 2025 (cachet de la poste faisant foi).',
  };

  specialiteSecondaire = {
    titre: 'Ingenieur en Sciences Appliquees et Technologie: Electronique, Microelectronique',
    note: 'Cette specialite est mentionnee dans l avis. Les details complets (quotas et calcul fin) restent a confirmer depuis le document officiel de reference.',
  };
}
