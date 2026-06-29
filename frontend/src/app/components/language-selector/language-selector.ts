import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.css',
})
export class LanguageSelectorComponent {
  constructor(public translationService: TranslationService) {}

  get currentLanguage(): string {
    return this.translationService.getCurrentLanguage();
  }

  setLanguage(lang: 'fr' | 'en'): void {
    this.translationService.setLanguage(lang);
  }
}
