import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidaturesMasterComponent } from '../candidatures-master/candidatures-master.component';

@Component({
  selector: 'app-candidatures-master-membre',
  standalone: true,
  imports: [CommonModule, CandidaturesMasterComponent],
  templateUrl: './candidatures-master-membre.component.html',
  styleUrl: './candidatures-master-membre.component.css',
})
export class CandidaturesMasterMembreComponent {}
