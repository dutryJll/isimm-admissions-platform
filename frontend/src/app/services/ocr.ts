import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LotOcrResultat {
  candidature_id: number;
  candidat_nom: string;
  numero?: string;
  master: string;
  success: boolean;
  statut: 'ok' | 'anomalie' | 'erreur';
  score_extrait?: number | null;
  score_declare?: number | null;
  ecart?: number | null;
  confiance?: number | null;
  moteur?: string;
  alerte?: string | null;
  nb_anomalies: number;
  message?: string;
  error?: string;
  fichier?: string;
}

export interface LotOcrResponse {
  success: boolean;
  message: string;
  total: number;
  nb_analysees: number;
  nb_conformes: number;
  nb_anomalies: number;
  nb_erreurs: number;
  resultats: LotOcrResultat[];
}

// v4 §7 — Résultat d'extraction spécialité + type de diplôme (relevé de notes)
export interface OcrExtractResult {
  statut?: string;
  message?: string;
  specialite_detectee: string | null;
  type_diplome_detecte: string | null;
  specialite_declaree?: string;
  type_diplome_declare?: string;
  correspondance_specialite: boolean;
  correspondance_type: boolean;
  alerte: boolean;
  texte_brut?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OcrService {
  // ✅ Utilise l'environment au lieu de URLs codées en dur
  private apiUrl = `${environment.candidatureServiceUrl}/ocr`;
  private candidatureApiUrl = environment.candidatureServiceUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  // Analyser un document spécifique
  analyserDocument(documentId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/analyser/`,
      { document_id: documentId },
      { headers: this.getHeaders() },
    );
  }

  // Analyser tous les documents d'un candidat
  analyserDossierComplet(candidatureId: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/analyser-dossier/`,
      { candidature_id: candidatureId },
      { headers: this.getHeaders() },
    );
  }

  // Lister les dossiers déposés en attente d'analyse OCR
  listerDossiersOcr(): Observable<any> {
    return this.http.get(`${this.candidatureApiUrl}/dossiers-ocr/`, {
      headers: this.getHeaders(),
    });
  }

  // Lancer l'analyse OCR en lot (une seule transaction serveur)
  analyserLot(candidatureIds: number[]): Observable<LotOcrResponse> {
    return this.http.post<LotOcrResponse>(
      `${this.candidatureApiUrl}/ocr/analyser-lot/`,
      { candidature_ids: candidatureIds },
      { headers: this.getHeaders() },
    );
  }

  // v4 §7 — Extraire spécialité + type de diplôme d'un relevé et comparer à la déclaration
  extraireReleve(
    fichier: File,
    specialiteDeclaree: string,
    typeDiplomeDeclare: string,
  ): Observable<OcrExtractResult> {
    const fd = new FormData();
    fd.append('fichier', fichier);
    fd.append('specialite_declaree', specialiteDeclaree || '');
    fd.append('type_diplome_declare', typeDiplomeDeclare || '');
    return this.http.post<OcrExtractResult>(
      `${this.candidatureApiUrl}/candidatures/ocr/extract/`,
      fd,
      { headers: this.getHeaders() },
    );
  }

  // v7 §7.4 — Exporter le rapport de conformité OCR (résultats du lot) en Excel ou PDF
  exporterRapportLot(resultats: LotOcrResultat[], format: 'excel' | 'pdf'): Observable<Blob> {
    return this.http.post(
      `${this.candidatureApiUrl}/candidatures/export-ocr-${format}/`,
      { resultats },
      { headers: this.getHeaders(), responseType: 'blob' },
    );
  }

  // Générer rapport final
  genererRapport(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/rapport/${candidatureId}/`, {
      headers: this.getHeaders(),
    });
  }

  // Exporter rapport PDF
  exporterRapportPDF(candidatureId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/rapport/${candidatureId}/pdf/`, {
      headers: this.getHeaders(),
      responseType: 'blob',
    });
  }
}
