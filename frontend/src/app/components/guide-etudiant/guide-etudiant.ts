import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';

interface Section {
  id: string;
  titre: string;
  contenu: string[];
}

@Component({
  selector: 'app-guide-etudiant',
  standalone: true,
  imports: [CommonModule, MatExpansionModule],
  templateUrl: './guide-etudiant.html',
  styleUrl: './guide-etudiant.css',
})
export class GuideEtudiantComponent {
  sections: Section[] = [
    {
      id: 'postuler',
      titre: 'Comment postuler ?',
      contenu: [
        'Créez votre compte sur la plateforme avec une adresse email valide.',
        'Consultez les offres disponibles dans la section "Explorer".',
        'Remplissez le formulaire de préinscription par étapes.',
        'Validez et téléchargez votre reçu de candidature.',
      ],
    },
    {
      id: 'documents',
      titre: 'Documents requis',
      contenu: [
        "Carte d'Identité Nationale (CIN) ou Passeport.",
        'Copie certifiée conforme du diplôme du Baccalauréat.',
        'Relevés de notes de toutes les années universitaires.',
        'Curriculum Vitae (CV) actualisé.',
      ],
    },
    {
      id: 'calendrier',
      titre: 'Calendrier des admissions',
      contenu: [
        'Ouverture des préinscriptions : Juin 2026',
        'Date limite de soumission : 22 Juillet 2026',
        'Affichage des résultats de présélection : 28 Juillet 2026',
        'Délibérations finales : Août 2026',
      ],
    },
  ];

  constructor(private router: Router) {}

  retourAccueil(): void {
    this.router.navigate(['/']);
  }
}
