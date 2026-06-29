import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListeSelection } from '../liste-selection/liste-selection';

@Component({
  selector: 'app-selection-responsable',
  standalone: true,
  imports: [CommonModule, ListeSelection],
  templateUrl: './selection-responsable.component.html',
  styleUrl: './selection-responsable.component.css',
})
export class SelectionResponsableComponent {}
