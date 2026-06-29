import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidaturesMasterComponent } from '../candidatures-master/candidatures-master.component';

@Component({
  selector: 'app-candidatures-master-responsable',
  standalone: true,
  imports: [CommonModule, CandidaturesMasterComponent],
  templateUrl: './candidatures-master-responsable.component.html',
  styleUrl: './candidatures-master-responsable.component.css',
})
export class CandidaturesMasterResponsableComponent {}
