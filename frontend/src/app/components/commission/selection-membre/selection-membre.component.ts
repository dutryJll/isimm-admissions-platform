import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ListeSelection } from '../liste-selection/liste-selection';

@Component({
  selector: 'app-selection-membre',
  standalone: true,
  imports: [CommonModule, ListeSelection],
  templateUrl: './selection-membre.component.html',
  styleUrl: './selection-membre.component.css',
})
export class SelectionMembreComponent {}
