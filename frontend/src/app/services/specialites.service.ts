import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface SpecialitesData {
  programs: { [key: string]: { full_name: string; type: string; specialties: string[] } };
  master_specialties_legacy: { [key: string]: string[] };
  ingenieur_specialties_legacy: { [key: string]: string[] };
}

@Injectable({
  providedIn: 'root',
})
export class SpecialitesService {
  private specialitesData = new BehaviorSubject<SpecialitesData | null>(null);
  private loaded = false;

  constructor(private http: HttpClient) {
    this.loadSpecialites();
  }

  private loadSpecialites(): void {
    if (this.loaded) return;
    this.http.get<SpecialitesData>('/assets/specialites.json').subscribe((data) => {
      this.specialitesData.next(data);
      this.loaded = true;
    });
  }

  /**
   * Get all program codes and names
   */
  getPrograms(): { code: string; name: string }[] {
    const data = this.specialitesData.value;
    if (!data) return [];
    return Object.keys(data.programs || {}).map((code) => ({
      code,
      name: data.programs[code]?.full_name || code,
    }));
  }

  /**
   * Get specialties for a specific program
   */
  getSpecialties(programCode: string): string[] {
    const data = this.specialitesData.value;
    if (!data) return [];
    return data.programs?.[programCode]?.specialties || [];
  }

  /**
   * Get legacy specialties (fallback)
   */
  getLegacyMasterSpecialties(masterCode: string): string[] {
    const data = this.specialitesData.value;
    if (!data) return [];
    return data.master_specialties_legacy?.[masterCode] || [];
  }

  getLegacyIngenieurSpecialties(ingenieurCode: string): string[] {
    const data = this.specialitesData.value;
    if (!data) return [];
    return data.ingenieur_specialties_legacy?.[ingenieurCode] || [];
  }

  /**
   * Get all unique specialties across all programs
   */
  getAllSpecialties(): string[] {
    const data = this.specialitesData.value;
    if (!data) return [];
    const set = new Set<string>();
    Object.values(data.programs || {}).forEach((prog) => {
      prog.specialties.forEach((s) => set.add(s));
    });
    return Array.from(set).sort();
  }

  /**
   * Observable for specialties data
   */
  getSpecialitesData(): Observable<SpecialitesData | null> {
    return this.specialitesData.asObservable();
  }
}
