import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { PdfExportService } from '../../../services/pdf-export.service';

interface Candidat {
  id: number;
  nom: string;
  email: string;
  score: number;
  specialite: string;
  dossier_valide: boolean;
  liste: 'attente' | 'principale';
}

@Component({
  selector: 'app-listes-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './listes-selection.component.html',
  styleUrl: './listes-selection.component.css',
})
export class ListesSelectionComponent implements OnInit {
  ongletActif: 'attente' | 'principale' = 'principale';
  specialiteSelectionnee: string = '';
  anneeSelectionnee: string = '2026';

  specialites = [
    'Master Génie Logiciel',
    'Master Data Science',
    'Master Microélectronique',
    'Master Réseaux et Télécommunications',
  ];

  candidats: Candidat[] = [
    // Liste Principale
    {
      id: 1,
      nom: 'Ahmed Ben Ali',
      email: 'ahmed@example.com',
      score: 18.5,
      specialite: 'Master Génie Logiciel',
      dossier_valide: true,
      liste: 'principale',
    },
    {
      id: 2,
      nom: 'Fatma Gharbi',
      email: 'fatma@example.com',
      score: 17.8,
      specialite: 'Master Data Science',
      dossier_valide: true,
      liste: 'principale',
    },
    {
      id: 3,
      nom: 'Mohamed Trabelsi',
      email: 'mohamed@example.com',
      score: 17.2,
      specialite: 'Master Génie Logiciel',
      dossier_valide: true,
      liste: 'principale',
    },
    {
      id: 4,
      nom: 'Salma Mansour',
      email: 'salma@example.com',
      score: 16.9,
      specialite: 'Master Data Science',
      dossier_valide: true,
      liste: 'principale',
    },
    {
      id: 5,
      nom: 'Youssef Hamdi',
      email: 'youssef@example.com',
      score: 16.5,
      specialite: 'Master Microélectronique',
      dossier_valide: true,
      liste: 'principale',
    },

    // Liste d'Attente
    {
      id: 6,
      nom: 'Nour Karim',
      email: 'nour@example.com',
      score: 15.8,
      specialite: 'Master Génie Logiciel',
      dossier_valide: true,
      liste: 'attente',
    },
    {
      id: 7,
      nom: 'Rania Slimi',
      email: 'rania@example.com',
      score: 15.5,
      specialite: 'Master Data Science',
      dossier_valide: true,
      liste: 'attente',
    },
    {
      id: 8,
      nom: 'Amine Fourati',
      email: 'amine@example.com',
      score: 15.2,
      specialite: 'Master Génie Logiciel',
      dossier_valide: true,
      liste: 'attente',
    },
    {
      id: 9,
      nom: 'Leila Bouaziz',
      email: 'leila@example.com',
      score: 14.9,
      specialite: 'Master Microélectronique',
      dossier_valide: true,
      liste: 'attente',
    },
    {
      id: 10,
      nom: 'Karim Mrad',
      email: 'karim@example.com',
      score: 14.5,
      specialite: 'Master Data Science',
      dossier_valide: true,
      liste: 'attente',
    },
  ];

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private pdfExport: PdfExportService,
  ) {}

  ngOnInit(): void {
    this.chargerListes();
  }

  chargerListes(): void {
    const token = this.authService.getAccessToken();

    let url = 'http://localhost:8003/api/listes/candidats/';
    const params: string[] = [];

    if (this.specialiteSelectionnee) {
      params.push(`specialite=${this.specialiteSelectionnee}`);
    }
    if (this.anneeSelectionnee) {
      params.push(`annee=${this.anneeSelectionnee}`);
    }

    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    this.http
      .get<Candidat[]>(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.candidats = data;
        },
        error: (error) => {
          console.error('Erreur chargement:', error);
        },
      });
  }

  getListeAttente(): Candidat[] {
    return this.candidats
      .filter((c) => c.liste === 'attente')
      .filter((c) => !this.specialiteSelectionnee || c.specialite === this.specialiteSelectionnee)
      .sort((a, b) => b.score - a.score);
  }

  getListePrincipale(): Candidat[] {
    return this.candidats
      .filter((c) => c.liste === 'principale')
      .filter((c) => !this.specialiteSelectionnee || c.specialite === this.specialiteSelectionnee)
      .sort((a, b) => b.score - a.score);
  }

  getMoyenneScore(liste: 'attente' | 'principale'): string {
    const candidats = liste === 'attente' ? this.getListeAttente() : this.getListePrincipale();
    if (candidats.length === 0) return '0.0';

    const total = candidats.reduce((sum, c) => sum + c.score, 0);
    return (total / candidats.length).toFixed(2);
  }

  getTauxAdmission(): string {
    const total = this.candidats.length;
    if (total === 0) return '0';

    const admis = this.getListePrincipale().length;
    return ((admis / total) * 100).toFixed(1);
  }

  getMention(score: number): string {
    if (score >= 18) return 'Excellent';
    if (score >= 16) return 'Très Bien';
    if (score >= 14) return 'Bien';
    if (score >= 12) return 'Assez Bien';
    return 'Passable';
  }

  getMentionClass(score: number): string {
    if (score >= 18) return 'excellent';
    if (score >= 16) return 'tres-bien';
    if (score >= 14) return 'bien';
    return 'assez-bien';
  }

  deplacerVers(destination: 'attente' | 'principale', candidat: Candidat): void {
    const action = destination === 'principale' ? 'la liste principale' : "la liste d'attente";

    if (confirm(`Déplacer ${candidat.nom} vers ${action} ?`)) {
      candidat.liste = destination;

      const token = this.authService.getAccessToken();

      this.http
        .post(
          `http://localhost:8003/api/listes/deplacer/`,
          {
            candidat_id: candidat.id,
            destination: destination,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .subscribe({
          next: () => {
            alert(`✅ Candidat déplacé vers ${action}`);
          },
          error: (error) => {
            console.error('Erreur:', error);
            alert('❌ Erreur lors du déplacement');
            candidat.liste = destination === 'principale' ? 'attente' : 'principale';
          },
        });
    }
  }

  genererListe(type: 'attente' | 'principale'): void {
    if (
      confirm(
        `Générer automatiquement la liste ${type === 'principale' ? 'principale' : "d'attente"} ?`,
      )
    ) {
      const token = this.authService.getAccessToken();

      this.http
        .post(
          `http://localhost:8003/api/listes/generer/`,
          {
            type: type,
            specialite: this.specialiteSelectionnee,
            annee: this.anneeSelectionnee,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .subscribe({
          next: () => {
            alert('✅ Liste générée automatiquement');
            this.chargerListes();
          },
          error: (error) => {
            console.error('Erreur:', error);
            alert('❌ Erreur lors de la génération');
          },
        });
    }
  }

  exporterListe(type: 'attente' | 'principale'): void {
    const token = this.authService.getAccessToken();

    this.http
      .get(
        `http://localhost:8003/api/listes/export/?type=${type}&specialite=${this.specialiteSelectionnee}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        },
      )
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `liste_${type}_${this.specialiteSelectionnee || 'toutes'}_${Date.now()}.xlsx`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Erreur export:', error);
          alert("❌ Erreur lors de l'export");
        },
      });
  }

  exporterTout(): void {
    const sectionId =
      this.ongletActif === 'attente' ? 'liste-attente-section' : 'liste-principale-section';
    const section = document.getElementById(sectionId);
    if (!section) {
      alert('❌ Section à exporter introuvable');
      return;
    }

    void this.pdfExport.generatePdfFromElement(section, {
      filename: `liste-selection-${this.ongletActif}.pdf`,
      embedQr: true,
      verificationUrl: `${window.location.origin}/verify-pv`,
    });
  }

  exporterListePdf(type: 'attente' | 'principale'): void {
    const section = document.getElementById(
      type === 'attente' ? 'liste-attente-section' : 'liste-principale-section',
    );
    if (!section) {
      alert('❌ Section à exporter introuvable');
      return;
    }

    void this.pdfExport.generatePdfFromElement(section, {
      filename: `liste-${type}.pdf`,
      embedQr: true,
      verificationUrl: `${window.location.origin}/verify-pv`,
    });
  }

  publierListe(): void {
    if (confirm('Publier la liste principale ? Les candidats seront notifiés par email.')) {
      const token = this.authService.getAccessToken();

      this.http
        .post(
          `http://localhost:8003/api/listes/publier/`,
          {
            specialite: this.specialiteSelectionnee,
            annee: this.anneeSelectionnee,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .subscribe({
          next: () => {
            alert('✅ Liste publiée ! Les candidats ont été notifiés.');
          },
          error: (error) => {
            console.error('Erreur:', error);
            alert('❌ Erreur lors de la publication');
          },
        });
    }
  }

  voirDetails(candidat: Candidat): void {
    alert(`Voir détails de ${candidat.nom}`);
  }

  retourDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
