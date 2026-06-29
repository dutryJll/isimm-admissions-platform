import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-master-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './master-catalog.component.html',
  styleUrl: './master-catalog.component.css',
})
export class MasterCatalogComponent {}
