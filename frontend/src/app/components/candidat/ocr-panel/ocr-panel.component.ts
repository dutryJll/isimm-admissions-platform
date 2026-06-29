import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrService } from '../../../services/ocr';

@Component({
  selector: 'app-ocr-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocr-panel.component.html',
  styleUrl: './ocr-panel.component.css',
})
export class OcrPanelComponent implements OnInit {
  @Input() pieceId: number | null = null;
  @Input() scoreDeclaration: number | null = null;

  selectedFile: File | null = null;
  selectedFileName = '';
  ocrEnCours = false;
  ocrResult: any = null;

  constructor(private ocrService: OcrService) {}

  ngOnInit(): void {}

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileName = file.name;
    }
  }

  analyserOCR(): void {
    if (!this.pieceId) {
      alert('Veuillez spécifier le ID de la pièce');
      return;
    }

    this.ocrEnCours = true;

    // ✅ Appel API : analyserDocument(documentId)
    this.ocrService.analyserDocument(this.pieceId).subscribe({
      next: (result: any) => {
        this.ocrEnCours = false;
        this.ocrResult = result;

        if (result.statut === 'conforme') {
          console.log('✅ Concordance vérifiée');
        } else if (result.statut === 'incoherence') {
          console.log('⚠️ Dossier Suspect');
        }

        console.log('📊 Résultats OCR:', result);
      },
      error: (err: any) => {
        this.ocrEnCours = false;
        const msg = err?.error?.message || 'Erreur lors de l\'analyse OCR';
        console.error('Erreur OCR:', msg, err);
      },
    });
  }

  togglePreview(): void {
    if (this.ocrResult) {
      const elem = document.querySelector('.ocr-preview-content');
      if (elem) {
        elem.classList.toggle('hidden');
      }
    }
  }

  reset(): void {
    this.selectedFile = null;
    this.selectedFileName = '';
    this.ocrResult = null;
  }
}
