import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-selection-process',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selection-process.component.html',
  styleUrls: ['./selection-process.component.css'],
})
export class SelectionProcessComponent implements OnInit {
  // Changement de rôle pour tester les vues séparées
  isResponsable: boolean = true;
  activeKebab: number | null = null;
  modalRecoursOuvert: boolean = false;
  candidatSelectionne: any = {};

  // Mock Data Réclamations
  listReclamations = [
    {
      idCandidature: '2026-ING-GL-053',
      nomPrenom: 'Yassine Ben Ali',
      specialite: 'Génie Logiciel',
      score: '16.45',
      statusRecours: "En attente d'examen",
      statusColorBg: '#fef3c7',
      statusColorText: '#d97706',
      texteRecours:
        'Je réclame une réévaluation de mon score. Ma moyenne de la 2ème année a été saisie à 12.50 au lieu de 15.20 par erreur dans le système automatique.',
    },
    {
      idCandidature: '2026-DS-018',
      nomPrenom: 'Yasmine Tounsi',
      specialite: 'Data Science',
      score: '15.87',
      statusRecours: 'À traiter',
      statusColorBg: '#e0f2fe',
      statusColorText: '#0369a1',
      texteRecours:
        'La pièce jointe du relevé de notes a été jugée illisible alors que le PDF original est net. Je demande une nouvelle vérification.',
    },
    {
      idCandidature: '2026-ING-031',
      nomPrenom: 'Ahmed Ben Salah',
      specialite: 'Génie Informatique',
      score: '14.10',
      statusRecours: 'En attente d’examen',
      statusColorBg: '#fef3c7',
      statusColorText: '#d97706',
      texteRecours:
        'Le calcul de ma moyenne générale L2 ne tient pas compte de l’unité de rattrapage validée en session de contrôle.',
    },
    {
      idCandidature: '2026-GL-009',
      nomPrenom: 'Sarra Mansouri',
      specialite: 'Génie Logiciel',
      score: '13.92',
      statusRecours: 'Traité',
      statusColorBg: '#dcfce7',
      statusColorText: '#15803d',
      texteRecours:
        'Le diplôme a été correctement pris en compte après relecture manuelle par l’équipe d’audit.',
    },
  ];

  // Mock Data Inscriptions
  listInscriptions = [
    {
      idCandidature: '2026-ING-TI-012',
      nomPrenom: 'Amine Trabelsi',
      numInscUniv: 'UNI-2026-1001',
      statutFinal: 'Inscrit',
      bgColor: '#dcfce7',
      textColor: '#15803d',
    },
    {
      idCandidature: '2026-GL-021',
      nomPrenom: 'Yasmine Tounsi',
      numInscUniv: 'UNI-2026-1002',
      statutFinal: 'En attente',
      bgColor: '#fef3c7',
      textColor: '#d97706',
    },
    {
      idCandidature: '2026-DS-018',
      nomPrenom: 'Ahmed Ben Ali',
      numInscUniv: 'UNI-2026-1003',
      statutFinal: 'Inscrit',
      bgColor: '#dcfce7',
      textColor: '#15803d',
    },
    {
      idCandidature: '2026-ING-031',
      nomPrenom: 'Sarra Mansouri',
      numInscUniv: 'UNI-2026-1004',
      statutFinal: 'Liste d’attente LA',
      bgColor: '#e0f2fe',
      textColor: '#0369a1',
    },
    {
      idCandidature: '2026-GL-015',
      nomPrenom: 'Wiem Gharbi',
      numInscUniv: 'UNI-2026-1005',
      statutFinal: 'Refusé',
      bgColor: '#fee2e2',
      textColor: '#dc2626',
    },
    {
      idCandidature: '2026-DS-027',
      nomPrenom: 'Meriem Jemai',
      numInscUniv: 'UNI-2026-1006',
      statutFinal: 'Inscrit',
      bgColor: '#dcfce7',
      textColor: '#15803d',
    },
    {
      idCandidature: '2026-ING-044',
      nomPrenom: 'Oussama Bouzid',
      numInscUniv: 'UNI-2026-1007',
      statutFinal: 'En attente',
      bgColor: '#fef3c7',
      textColor: '#d97706',
    },
    {
      idCandidature: '2026-GL-032',
      nomPrenom: 'Asma Mansouri',
      numInscUniv: 'UNI-2026-1008',
      statutFinal: 'Inscrit',
      bgColor: '#dcfce7',
      textColor: '#15803d',
    },
    {
      idCandidature: '2026-DS-019',
      nomPrenom: 'Nour Brahmi',
      numInscUniv: 'UNI-2026-1009',
      statutFinal: 'Refusé',
      bgColor: '#fee2e2',
      textColor: '#dc2626',
    },
    {
      idCandidature: '2026-ING-052',
      nomPrenom: 'Fares Khelifi',
      numInscUniv: 'UNI-2026-1010',
      statutFinal: 'Liste d’attente LA',
      bgColor: '#e0f2fe',
      textColor: '#0369a1',
    },
  ];

  constructor() {}

  ngOnInit(): void {}

  private onDocumentClickBound: any = null;

  ngAfterViewInit(): void {
    this.onDocumentClickBound = () => (this.activeKebab = null);
    document.addEventListener('click', this.onDocumentClickBound);
  }

  ngOnDestroy(): void {
    if (this.onDocumentClickBound) document.removeEventListener('click', this.onDocumentClickBound);
  }

  toggleKebab(index: number, event: Event) {
    event.stopPropagation();
    this.activeKebab = this.activeKebab === index ? null : index;
  }

  ouvrirModalRecours(rec: any) {
    this.candidatSelectionne = rec;
    this.modalRecoursOuvert = true;
    this.activeKebab = null;
  }

  fermerModalRecours() {
    this.modalRecoursOuvert = false;
  }

  traiterRecours(index: number, action: string) {
    if (action === 'Accepter') {
      alert("Recours Accepté ! Le candidat passe à l'état Sélectionné et réintègre le classement.");
      this.listReclamations[index].statusRecours = 'Accepté';
      this.listReclamations[index].statusColorBg = '#dcfce7';
      this.listReclamations[index].statusColorText = '#15803d';
    } else {
      const motif = prompt('Saisir le Motif du refus du recours :');
      if (motif) {
        this.listReclamations[index].statusRecours = 'Refusé';
        this.listReclamations[index].statusColorBg = '#ffeeee';
        this.listReclamations[index].statusColorText = '#dc2626';
      }
    }
    this.activeKebab = null;
  }

  validerInscriptionDefinitive(ins: any) {
    const conf = confirm(
      "Voulez-vous valider définitivement l'inscription administrative de ce candidat ?",
    );
    if (conf) {
      ins.statutFinal = 'Inscrite';
      ins.bgColor = '#dcfce7';
      ins.textColor = '#15803d';
    }
  }
}
