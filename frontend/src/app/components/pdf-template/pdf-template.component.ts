import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pdf-template',
  standalone: true,
  templateUrl: './pdf-template.component.html',
  styleUrls: ['./pdf-template.component.css'],
})
export class PdfTemplateComponent {
  @Input() title: string | null = null;
  @Input() contentHtml: string | null = null; // optional: raw inner HTML to inject
}
