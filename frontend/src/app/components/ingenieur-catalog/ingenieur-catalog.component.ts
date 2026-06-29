import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-ingenieur-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ingenieur-catalog.component.html',
  styleUrl: './ingenieur-catalog.component.css',
})
export class IngenieurCatalogComponent {}
