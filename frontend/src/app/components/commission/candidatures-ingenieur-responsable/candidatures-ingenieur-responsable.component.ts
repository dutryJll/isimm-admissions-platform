import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidaturesIngenieurComponent } from '../candidatures-ingenieur/candidatures-ingenieur.component';

@Component({
  selector: 'app-candidatures-ingenieur-responsable',
  standalone: true,
  imports: [CommonModule, CandidaturesIngenieurComponent],
  templateUrl: './candidatures-ingenieur-responsable.component.html',
  styleUrl: './candidatures-ingenieur-responsable.component.css',
})
export class CandidaturesIngenieurResponsableComponent {}
