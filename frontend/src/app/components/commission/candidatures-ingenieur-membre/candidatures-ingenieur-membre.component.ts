import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidaturesIngenieurComponent } from '../candidatures-ingenieur/candidatures-ingenieur.component';

@Component({
  selector: 'app-candidatures-ingenieur-membre',
  standalone: true,
  imports: [CommonModule, CandidaturesIngenieurComponent],
  templateUrl: './candidatures-ingenieur-membre.component.html',
  styleUrl: './candidatures-ingenieur-membre.component.css',
})
export class CandidaturesIngenieurMembreComponent {}
