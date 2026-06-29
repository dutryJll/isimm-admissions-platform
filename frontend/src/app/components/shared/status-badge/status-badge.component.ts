import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export type BadgeTone = 'success' | 'warning' | 'info';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="status-pill" [ngClass]="tone">{{ label }}</span>`,
  styleUrl: './status-badge.component.css',
})
export class StatusBadgeComponent {
  @Input() label: string = '';
  @Input() tone: BadgeTone = 'info';
}
