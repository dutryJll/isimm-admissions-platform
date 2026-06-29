import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.css',
})
export class SkeletonLoaderComponent {
  @Input() variant: 'cards' | 'table' | 'list' = 'table';
  @Input() rows: number = 4;

  get placeholders(): number[] {
    return Array.from({ length: this.rows }, (_, index) => index);
  }
}
