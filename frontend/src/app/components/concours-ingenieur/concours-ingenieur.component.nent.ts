import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-concours-ingenieur',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './concours-ingenieur.component.html',
  styleUrl: './concours-ingenieur.component.css',
})
export class ConcoursIngenieurComponent {
  specialites = [
    {
      id: 'informatique',
      nom: 'Génie Informatique',
      icon: '💻',
      description: 'Développement logiciel, Intelligence Artificielle, Réseaux',
      matieres: ['Algorithmique', 'Bases de données', 'Programmation', 'Réseaux'],
      debouches: 'Ingénieur développement, Architecte logiciel, Data Engineer',
    },
    {
      id: 'electrique',
      nom: 'Génie Électrique',
      icon: '⚡',
      description: 'Électronique, Systèmes embarqués, Automatisation',
      matieres: ['Électronique', 'Automatique', 'Électrotechnique', 'Systèmes embarqués'],
      debouches: 'Ingénieur électronique, Ingénieur automatisation, Chef de projet',
    },
    {
      id: 'mecanique',
      nom: 'Génie Mécanique',
      icon: '⚙️',
      description: 'Conception mécanique, Fabrication, Maintenance industrielle',
      matieres: ['Mécanique des fluides', 'Résistance des matériaux', 'CAO/DAO', 'Thermodynamique'],
      debouches: 'Ingénieur conception, Ingénieur production, Responsable maintenance',
    },
  ];

  processus = [
    {
      etape: 1,
      titre: 'Candidature en ligne',
      description: 'Remplissez le formulaire de candidature et soumettez votre dossier',
    },
    {
      etape: 2,
      titre: 'Étude du dossier',
      description: 'La commission examine votre dossier académique',
    },
    {
      etape: 3,
      titre: 'Présélection',
      description: 'Les candidats présélectionnés sont convoqués pour un entretien',
    },
    {
      etape: 4,
      titre: 'Entretien',
      description: 'Entretien avec le jury pour évaluer votre motivation et vos compétences',
    },
    {
      etape: 5,
      titre: 'Résultats finaux',
      description: 'Publication des résultats et inscription des admis',
    },
  ];

  criteres = [
    { nom: 'Moyenne Bac', poids: '50%', description: 'Note du baccalauréat' },
    { nom: 'Dossier académique', poids: '30%', description: 'Relevés de notes et diplômes' },
    { nom: 'Entretien', poids: '20%', description: "Performance lors de l'entretien" },
  ];
}
