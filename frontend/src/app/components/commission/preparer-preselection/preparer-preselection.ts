import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface Liste {
  nom: string;
  candidats: any[];
  date_creation: string;
  archivee: boolean;
}

@Component({
  selector: 'app-preparer-preselection',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './preparer-preselection.html',
  styleUrl: './preparer-preselection.css',
})
export class PreparerPreselection {
  listes: Liste[] = [];
  showModal = false;
  nouvelleListe: any = { nom: '', scoreMin: 0, nombreMax: 0, type: '' };

  ouvrirModal(): void {
    this.showModal = true;
  }

  countByType(liste: Liste, type: string): number {
    return liste.candidats.filter((c: any) => c.type_candidature === type).length;
  }

  calculateAverage(liste: Liste): number {
    if (!liste.candidats.length) return 0;
    const sum = liste.candidats.reduce((a: any, c: any) => a + (c.score || 0), 0);
    return +(sum / liste.candidats.length).toFixed(1);
  }

  consulterListe(liste: Liste): void {
    console.log('Consulter', liste);
  }

  modifierListe(liste: Liste): void {
    console.log('Modifier', liste);
  }

  toggleArchive(liste: Liste): void {
    liste.archivee = !liste.archivee;
  }

  fermerModal(): void {
    this.showModal = false;
  }

  creerListe(): void {
    console.log('Créer liste', this.nouvelleListe);
    this.fermerModal();
  }
}
