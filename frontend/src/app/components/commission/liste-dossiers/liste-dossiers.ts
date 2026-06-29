import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Dossier {
  id: number;
  candidatName: string;
  statut: string;
}

@Component({
  selector: 'app-liste-dossiers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './liste-dossiers.html',
  styleUrl: './liste-dossiers.css',
})
export class ListeDossiersComponent implements OnInit {
  dossiers: Dossier[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadDossiers();
  }

  loadDossiers(): void {
    // TODO: fetch from API
    this.dossiers = [
      { id: 1, candidatName: 'Ahmed Ben Ali', statut: 'en_attente' },
      { id: 2, candidatName: 'Fatma Trabelsi', statut: 'valide' },
    ];
  }

  voirDossier(id: number): void {
    this.router.navigate(['/consultation-dossier', id]);
  }
}
