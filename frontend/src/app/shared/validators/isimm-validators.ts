/**
 * ISIMM — Validators Reactive Forms (ultra-stricts)
 * ─────────────────────────────────────────────────────────────────────────
 *  Patterns CIN tunisienne, téléphone +216, notes 0-20, fichiers PDF/JPG/PNG ≤ 5 MB.
 *  Messages d'erreur en français.
 *
 *  Usage :
 *    import { IsimmValidators, IsimmAsyncValidators } from './shared/validators/isimm-validators';
 *
 *    this.form = fb.group({
 *      cin:       ['', [Validators.required, IsimmValidators.cin], [IsimmAsyncValidators.cinUnique(http)]],
 *      telephone: ['', [Validators.required, IsimmValidators.telephoneTunisien]],
 *      email:     ['', [Validators.required, Validators.email]],
 *      moyenne_l1:[null, [Validators.required, ...IsimmValidators.note()]],
 *    });
 */

import {
  AbstractControl,
  AsyncValidatorFn,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

// ─────────────────────────────────────────────────────────────────────────
// Patterns canoniques
// ─────────────────────────────────────────────────────────────────────────
export const ISIMM_PATTERNS = {
  /** CIN tunisienne : exactement 8 chiffres. */
  CIN: /^\d{8}$/,
  /** Téléphone tunisien : +216 / 00216 / nu, 1er chiffre 2/4/5/9, 8 chiffres au total. */
  TEL_TN: /^(\+216|00216)?[2459]\d{7}$/,
  /** Note décimale 0-20 (2 décimales max). */
  NOTE_20: /^(\d{1,2})(\.\d{1,2})?$/,
  /** Mention bac alphanumérique simple (optionnel). */
  MENTION_BAC: /^[A-Za-zÀ-ÿ\s\-]{1,50}$/,
};

export const ISIMM_FILE_LIMITS = {
  MAX_BYTES: 5 * 1024 * 1024, // 5 MB
  MIN_BYTES: 1,
  ALLOWED_MIME: ['application/pdf', 'image/jpeg', 'image/png'] as const,
  ALLOWED_EXT: ['.pdf', '.jpg', '.jpeg', '.png'] as const,
};

// ─────────────────────────────────────────────────────────────────────────
// Validators synchrones
// ─────────────────────────────────────────────────────────────────────────
export class IsimmValidators {
  /** CIN tunisienne : 8 chiffres. */
  static cin(control: AbstractControl): ValidationErrors | null {
    const v = (control.value ?? '').toString().trim();
    if (!v) return null;
    return ISIMM_PATTERNS.CIN.test(v) ? null : { cinInvalide: 'CIN invalide : 8 chiffres exactement requis.' };
  }

  /** Téléphone tunisien : +216 / 00216 / nu, 8 chiffres, 1er chiffre 2/4/5/9. */
  static telephoneTunisien(control: AbstractControl): ValidationErrors | null {
    const v = (control.value ?? '').toString().replace(/\s+/g, '');
    if (!v) return null;
    return ISIMM_PATTERNS.TEL_TN.test(v)
      ? null
      : { telephoneInvalide: 'Téléphone invalide : format tunisien attendu (+216, 00216 ou 8 chiffres).' };
  }

  /** Note : pack [min(0), max(20), pattern]. */
  static note(): ValidatorFn[] {
    return [
      Validators.min(0),
      Validators.max(20),
      Validators.pattern(ISIMM_PATTERNS.NOTE_20),
    ];
  }

  /** Nombre de redoublements 0-5. */
  static redoublement(): ValidatorFn[] {
    return [Validators.min(0), Validators.max(5)];
  }

  /** Score calculé 0-40 (Bac+Licence+Examen+bonus). */
  static score(): ValidatorFn[] {
    return [Validators.min(0), Validators.max(40)];
  }

  /**
   * Fichier (PDF / JPG / PNG, > 0 octet, ≤ 5 MB).
   * À utiliser dans le handler (change) :
   *   const err = IsimmValidators.fichier(file); if (err) control.setErrors(err);
   */
  static fichier(file: File | null): ValidationErrors | null {
    if (!file) {
      return { fichierManquant: 'Aucun fichier sélectionné.' };
    }
    if (file.size === 0) {
      return { fichierVide: 'Le fichier est vide (0 octet).' };
    }
    if (file.size > ISIMM_FILE_LIMITS.MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return { fichierTropGrand: `Fichier ${mb} MB — taille max autorisée : 5 MB.` };
    }
    const mime = (file.type || '').toLowerCase();
    if (!ISIMM_FILE_LIMITS.ALLOWED_MIME.includes(mime as any)) {
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (!ISIMM_FILE_LIMITS.ALLOWED_EXT.includes(ext as any)) {
        return { typeFichierInvalide: 'Type de fichier non autorisé. Formats acceptés : PDF, JPG, PNG.' };
      }
    }
    return null;
  }

  /**
   * Match entre 2 champs (ex. password / confirmPassword).
   *   formGroup: [{ validators: IsimmValidators.matchFields('password', 'confirmPassword') }]
   */
  static matchFields(field1: string, field2: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const a = group.get(field1)?.value;
      const b = group.get(field2)?.value;
      if (!a || !b) return null;
      return a === b ? null : { champsDifferents: `${field1} et ${field2} doivent correspondre.` };
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Async Validators (unicité en base)
// ─────────────────────────────────────────────────────────────────────────
export class IsimmAsyncValidators {
  /**
   * Vérifie l'unicité d'un CIN via GET /api/auth/candidats/?cin=XXXX.
   * Debounce 350 ms pour éviter de spammer l'API à chaque touche.
   */
  static cinUnique(
    http: HttpClient,
    endpoint = '/api/auth/candidats/',
    excludeId: number | null = null,
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const cin = (control.value ?? '').toString().trim();
      if (!cin || !ISIMM_PATTERNS.CIN.test(cin)) return of(null);

      return timer(350).pipe(
        switchMap(() =>
          http.get<any>(`${endpoint}?cin=${encodeURIComponent(cin)}`).pipe(
            map((res) => {
              const list = Array.isArray(res) ? res : (res?.results ?? []);
              const conflict = list.find((u: any) =>
                excludeId ? Number(u.id) !== excludeId : true,
              );
              return conflict
                ? { cinExistant: 'Ce CIN est déjà enregistré.' }
                : null;
            }),
            catchError(() => of(null)),
          ),
        ),
      );
    };
  }

  /**
   * Vérifie l'unicité d'un email via GET /api/auth/users/?email=...
   */
  static emailUnique(
    http: HttpClient,
    endpoint = '/api/auth/users/',
    excludeId: number | null = null,
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const email = (control.value ?? '').toString().trim().toLowerCase();
      if (!email) return of(null);

      return timer(350).pipe(
        switchMap(() =>
          http.get<any>(`${endpoint}?email=${encodeURIComponent(email)}`).pipe(
            map((res) => {
              const list = Array.isArray(res) ? res : (res?.results ?? []);
              const conflict = list.find((u: any) =>
                excludeId ? Number(u.id) !== excludeId : true,
              );
              return conflict ? { emailExistant: 'Cet email est déjà utilisé.' } : null;
            }),
            catchError(() => of(null)),
          ),
        ),
      );
    };
  }

  /**
   * Vérifie qu'un candidat n'a pas déjà postulé au même master :
   *   GET /api/candidatures/can-reapply/?master_id=X
   *   → { can_reapply: true | false }
   */
  static peutCandidater(
    http: HttpClient,
    masterIdGetter: () => number | null,
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const masterId = masterIdGetter();
      if (!masterId || !control.value) return of(null);
      return timer(350).pipe(
        switchMap(() =>
          http
            .get<any>(`/api/candidatures/can-reapply/?master_id=${masterId}`)
            .pipe(
              map((res) =>
                res?.can_reapply === false
                  ? { doublonCandidature: 'Vous avez déjà postulé à ce master.' }
                  : null,
              ),
              catchError(() => of(null)),
            ),
        ),
      );
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers UI : extraire message d'erreur lisible
// ─────────────────────────────────────────────────────────────────────────
export function premierMessageErreur(control: AbstractControl | null): string {
  if (!control || !control.errors) return '';
  const errs = control.errors;
  if (errs['required']) return 'Ce champ est obligatoire.';
  if (errs['email']) return 'Format d\'email invalide.';
  if (errs['min']) return `Valeur minimale : ${errs['min'].min}.`;
  if (errs['max']) return `Valeur maximale : ${errs['max'].max}.`;
  if (errs['pattern']) return 'Format invalide.';

  // Erreurs custom ISIMM (toutes ont un message string en valeur)
  for (const key of Object.keys(errs)) {
    const v = errs[key];
    if (typeof v === 'string') return v;
  }
  return 'Valeur invalide.';
}

// ─────────────────────────────────────────────────────────────────────────
// Pipe-friendly : nettoyer espaces sur les inputs texte
// ─────────────────────────────────────────────────────────────────────────
export function trimWhitespace(value: string | null | undefined): string {
  return (value ?? '').toString().replace(/\s+/g, ' ').trim();
}
