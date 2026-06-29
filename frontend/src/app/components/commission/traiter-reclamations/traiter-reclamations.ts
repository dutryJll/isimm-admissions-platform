import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SpecialitesService } from '../../../services/specialites.service';
import { CommissionStateService } from '../../../services/commission-state.service';

interface Reclamation {
  id: number;
  candidat_id: number;
  candidat_prenom: string;
  candidat_nom: string;
  candidat_email: string;
  master_id: number;
  master_nom: string;
  commissionCategory: 'ingenieur' | 'master-ds' | 'master-gl';
  objet: string;
  motif: string;
  date: string;
  statut: 'en_attente' | 'acceptee' | 'rejetee';
  reponse?: string;
  traite_par?: string;
  date_traitement?: string;
  pieces_jointes?: { nom: string; url: string }[];
}

@Component({
  selector: 'app-traiter-reclamations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './traiter-reclamations.html',
  styleUrl: './traiter-reclamations.css',
})
export class TraiterReclamationsComponent implements OnInit {
  reclamations: Reclamation[] = [];
  reclamationsFiltrees: Reclamation[] = [];
  masters: any[] = [];
  availableSpecialites: string[] = [];

  selectedSpecialite: string = '';

  recherche: string = '';
  filtreStatut: string = '';
  filtreMaster: string = '';

  showModalAccepter: boolean = false;
  showModalRejeter: boolean = false;
  reclamationSelectionnee: Reclamation | null = null;

  reponseTexte: string = '';
  motifRejet: string = '';
  prolongerDelai: boolean = false;
  nouvelleDeadline: string = '';
  private activeCommissionCategory: 'ingenieur' | 'master-ds' | 'master-gl' | null = null;

  constructor(
    private router: Router,
    private specialitesService: SpecialitesService,
    private commissionStateService: CommissionStateService,
  ) {}

  ngOnInit(): void {
    this.commissionStateService.activeCommissionId$.subscribe((commissionId) => {
      this.activeCommissionCategory = this.getCommissionCategoryFromId(commissionId);
      this.filtrerReclamations();
    });
    this.loadMasters();
    this.specialitesService.getSpecialitesData().subscribe((data) => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
    });
    this.loadReclamations();
  }

  loadMasters(): void {
    // Prefer using SpecialitesService program list when available
    const progs = this.specialitesService.getPrograms();
    if (progs && progs.length) {
      this.masters = progs.map((p) => ({ id: p.code, nom: p.name }));
      return;
    }
    // Fallback static list
    this.masters = [
      { id: 1, nom: 'Master Recherche Génie Logiciel' },
      { id: 2, nom: 'Master Professionnel Data Science' },
      { id: 3, nom: 'Master Recherche Microélectronique' },
      { id: 4, nom: 'Cycle Ingénieur Génie Logiciel' },
    ];
  }

  loadReclamations(): void {
    // TODO: Charger depuis l'API
    // this.commissionService.getAllReclamations().subscribe({...})

    // Données simulées (démo vidéo) — variées sur Master, statut, PJ et dates.
    // La majorité sont rattachées à la commission « master-gl » (responsable GL),
    // + quelques-unes DS/ingénieur pour la variété quand on change de commission.
    const GL = "Master Génie Logiciel et Systèmes d'Information";
    const BC = 'Master Business Computing';
    this.reclamations = [
      {
        id: 1,
        candidat_id: 232,
        candidat_prenom: 'Ahmed',
        candidat_nom: 'Ben Ali',
        candidat_email: 'ahmed.benali@demo.tn',
        master_id: 18,
        master_nom: GL,
        commissionCategory: 'master-gl',
        objet: 'Erreur dans le calcul du score',
        motif:
          'Le score affiché ne correspond pas à mes notes. Mes relevés montrent une moyenne de 16.5 mais le score calculé est de 15.2. Je demande une révision.',
        date: '2026-06-10T10:30:00',
        statut: 'en_attente',
        pieces_jointes: [{ nom: 'Releves_Notes.pdf', url: '/assets/docs/sample.pdf' }],
      },
      {
        id: 2,
        candidat_id: 215,
        candidat_prenom: 'Ranim',
        candidat_nom: 'Jellali',
        candidat_email: 'ranimjellali47@gmail.com',
        master_id: 18,
        master_nom: GL,
        commissionCategory: 'master-gl',
        objet: 'Contestation du score de présélection',
        motif:
          "Je conteste mon classement en présélection. Ma moyenne de licence est de 13.4 et je pense que mon dossier mérite un meilleur rang. Merci de revérifier.",
        date: '2026-06-12T09:05:00',
        statut: 'en_attente',
        pieces_jointes: [{ nom: 'Releve_Notes_Ranim.pdf', url: '/assets/docs/sample.pdf' }],
      },
      {
        id: 3,
        candidat_id: 238,
        candidat_prenom: 'Karim',
        candidat_nom: 'Bouazizi',
        candidat_email: 'karim.bouazizi@demo.tn',
        master_id: 18,
        master_nom: GL,
        commissionCategory: 'master-gl',
        objet: 'Demande de réexamen du dossier',
        motif:
          "Un de mes relevés de notes n'a pas été pris en compte lors de l'évaluation. Je demande un réexamen de mon dossier complet.",
        date: '2026-06-13T15:40:00',
        statut: 'en_attente',
      },
      {
        id: 4,
        candidat_id: 233,
        candidat_prenom: 'Mohamed',
        candidat_nom: 'Karoui',
        candidat_email: 'mohamed.karoui@demo.tn',
        master_id: 18,
        master_nom: GL,
        commissionCategory: 'master-gl',
        objet: 'Problème technique lors du dépôt',
        motif:
          "Le système a planté lors du dépôt de mes documents. Certains documents n'ont pas été uploadés correctement.",
        date: '2026-06-08T09:15:00',
        statut: 'acceptee',
        reponse:
          'Nous avons vérifié votre dossier et constaté effectivement un problème technique. Nous avons prolongé votre délai de dépôt de 7 jours. Vous pouvez maintenant re-déposer vos documents.',
        traite_par: 'Responsable Commission',
        date_traitement: '2026-06-09T11:00:00',
      },
      {
        id: 5,
        candidat_id: 237,
        candidat_prenom: 'Salma',
        candidat_nom: 'Mejri',
        candidat_email: 'salma.mejri@demo.tn',
        master_id: 20,
        master_nom: BC,
        commissionCategory: 'master-gl',
        objet: 'Erreur sur la spécialité affichée',
        motif:
          'Ma spécialité de licence affichée est incorrecte (Business Computing au lieu de Génie Logiciel). Merci de corriger.',
        date: '2026-06-07T13:20:00',
        statut: 'acceptee',
        reponse:
          'Correction effectuée : votre spécialité de diplôme a été mise à jour dans votre dossier. Aucune incidence sur votre score.',
        traite_par: 'Responsable Commission',
        date_traitement: '2026-06-08T08:45:00',
      },
      {
        id: 6,
        candidat_id: 2,
        candidat_prenom: 'Fatma',
        candidat_nom: 'Trabelsi',
        candidat_email: 'fatma.trabelsi@demo.tn',
        master_id: 19,
        master_nom: 'Master Big Data et Analyse de Données',
        commissionCategory: 'master-ds',
        objet: 'Document rejeté par erreur',
        motif:
          'Mon diplôme a été rejeté avec la mention "tampon manquant" alors que le tampon est clairement visible sur le document. Je demande une révision.',
        date: '2026-06-11T14:20:00',
        statut: 'en_attente',
        pieces_jointes: [{ nom: 'Diplome_Licence.pdf', url: '/assets/docs/sample.pdf' }],
      },
      {
        id: 7,
        candidat_id: 4,
        candidat_prenom: 'Sarra',
        candidat_nom: 'Mansouri',
        candidat_email: 'sarra.mansouri@demo.tn',
        master_id: 6,
        master_nom: 'Cycle Ingénieur Génie Logiciel',
        commissionCategory: 'ingenieur',
        objet: 'Contestation du rejet',
        motif:
          'Ma candidature a été rejetée sans motif clair. Je demande des explications détaillées.',
        date: '2026-06-05T16:45:00',
        statut: 'rejetee',
        reponse:
          "Après examen approfondi, votre candidature ne répond pas aux critères d'admission (moyenne générale inférieure à 12/20 sur les 3 années de licence, comme indiqué dans le règlement). Le rejet est maintenu.",
        traite_par: 'Responsable Commission',
        date_traitement: '2026-06-06T10:30:00',
      },
    ];

    this.filtrerReclamations();
    console.log('✅ Réclamations chargées:', this.reclamations.length);
  }

  filtrerReclamations(): void {
    this.reclamationsFiltrees = this.reclamations.filter((r) => {
      const matchCommission = this.matchesCommissionScope(r);
      const matchRecherche =
        !this.recherche ||
        r.candidat_prenom.toLowerCase().includes(this.recherche.toLowerCase()) ||
        r.candidat_nom.toLowerCase().includes(this.recherche.toLowerCase()) ||
        r.candidat_email.toLowerCase().includes(this.recherche.toLowerCase()) ||
        r.master_nom.toLowerCase().includes(this.recherche.toLowerCase()) ||
        r.objet.toLowerCase().includes(this.recherche.toLowerCase());

      const matchStatut = !this.filtreStatut || r.statut === this.filtreStatut;
      const matchMaster = !this.filtreMaster || r.master_id.toString() === this.filtreMaster;
      const matchSpecialite = !this.selectedSpecialite || r.master_nom === this.selectedSpecialite;

      return matchCommission && matchRecherche && matchStatut && matchMaster && matchSpecialite;
    });
  }

  private matchesCommissionScope(reclamation: Reclamation): boolean {
    const scope = this.activeCommissionCategory;
    if (!scope) {
      return true;
    }

    return reclamation.commissionCategory === scope;
  }

  private getCommissionCategoryFromId(
    commissionId: number | null,
  ): 'ingenieur' | 'master-ds' | 'master-gl' | null {
    if (commissionId === 1) return 'ingenieur';
    if (commissionId === 2) return 'master-ds';
    if (commissionId === 3) return 'master-gl';
    return null;
  }

  resetFiltres(): void {
    this.recherche = '';
    this.filtreStatut = '';
    this.filtreMaster = '';
    this.reclamationsFiltrees = [...this.reclamations];
  }

  countByStatut(statut: string): number {
    return this.reclamations.filter((r) => r.statut === statut).length;
  }

  getStatutLabel(statut: string): string {
    const labels: any = {
      en_attente: 'En attente',
      acceptee: 'Acceptée',
      rejetee: 'Rejetée',
    };
    return labels[statut] || statut;
  }

  ouvrirModalAccepter(reclamation: Reclamation): void {
    this.reclamationSelectionnee = reclamation;
    this.reponseTexte = '';
    this.prolongerDelai = false;
    this.nouvelleDeadline = '';
    this.showModalAccepter = true;
  }

  ouvrirModalRejeter(reclamation: Reclamation): void {
    this.reclamationSelectionnee = reclamation;
    this.motifRejet = '';
    this.showModalRejeter = true;
  }

  fermerModal(): void {
    this.showModalAccepter = false;
    this.showModalRejeter = false;
    this.reclamationSelectionnee = null;
    this.reponseTexte = '';
    this.motifRejet = '';
  }

  accepterReclamation(): void {
    if (!this.reponseTexte) {
      alert('Veuillez saisir une réponse');
      return;
    }

    console.log('✅ Acceptation réclamation:', {
      id: this.reclamationSelectionnee?.id,
      reponse: this.reponseTexte,
      prolongerDelai: this.prolongerDelai,
      nouvelleDeadline: this.nouvelleDeadline,
    });

    // TODO: Appeler l'API
    // this.commissionService.traiterReclamation(id, 'acceptee', this.reponseTexte).subscribe({...})

    // Simuler la mise à jour
    if (this.reclamationSelectionnee) {
      this.reclamationSelectionnee.statut = 'acceptee';
      this.reclamationSelectionnee.reponse = this.reponseTexte;
      this.reclamationSelectionnee.traite_par = 'Dr. Fatma Ben Ali'; // User actuel
      this.reclamationSelectionnee.date_traitement = new Date().toISOString();
    }

    alert('Réclamation acceptée avec succès !\nUn email a été envoyé au candidat.');
    this.fermerModal();
  }

  rejeterReclamation(): void {
    if (!this.motifRejet) {
      alert('Veuillez saisir un motif de rejet');
      return;
    }

    console.log('❌ Rejet réclamation:', {
      id: this.reclamationSelectionnee?.id,
      motif: this.motifRejet,
    });

    // TODO: Appeler l'API
    // this.commissionService.traiterReclamation(id, 'rejetee', this.motifRejet).subscribe({...})

    // Simuler la mise à jour
    if (this.reclamationSelectionnee) {
      this.reclamationSelectionnee.statut = 'rejetee';
      this.reclamationSelectionnee.reponse = this.motifRejet;
      this.reclamationSelectionnee.traite_par = 'Dr. Fatma Ben Ali';
      this.reclamationSelectionnee.date_traitement = new Date().toISOString();
    }

    alert('Réclamation rejetée.\nUn email a été envoyé au candidat.');
    this.fermerModal();
  }

  traiterReclamation(reclamation: Reclamation): void {
    this.ouvrirModalAccepter(reclamation);
  }

  voirDossier(reclamation: Reclamation): void {
    console.log('📁 Voir dossier:', reclamation.candidat_nom);
    this.router.navigate(['/consultation-dossier', reclamation.candidat_id], {
      queryParams: { source: 'reclamations', reclamation: reclamation.id },
    });
  }

  voirPiece(piece: any): void {
    console.log('📎 Voir pièce jointe:', piece.nom);
    window.open(piece.url, '_blank');
  }

  changerStatut(reclamation: Reclamation, newStatut: Reclamation['statut']): void {
    const idx = this.reclamations.findIndex((r) => r.id === reclamation.id);
    if (idx !== -1) {
      this.reclamations[idx] = { ...this.reclamations[idx], statut: newStatut };
    }
    this.filtrerReclamations();
  }
}
