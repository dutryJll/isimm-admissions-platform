import { Pipe, PipeTransform, Inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  constructor(@Inject(TranslationService) private translationService: TranslationService) {}

  transform(key: string): string {
    return this.translationService.translate(key);
  }
}
