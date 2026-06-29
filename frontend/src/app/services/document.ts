import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  // ✅ Utilise l'environment (port 8003, pas 8004)
  private apiUrl = `${environment.candidatureServiceUrl}/documents`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  // Upload un document
  uploadDocument(candidatureId: number, typeDocument: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('candidature_id', candidatureId.toString());
    formData.append('type_document', typeDocument);
    formData.append('fichier', file);

    return this.http.post(`${this.apiUrl}/upload/`, formData, { headers: this.getHeaders() });
  }

  // Récupérer les documents d'une candidature
  getDocuments(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/candidature/${candidatureId}/`, {
      headers: this.getHeaders(),
    });
  }

  // Récupérer mes documents
  getMesDocuments(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes-documents/`, { headers: this.getHeaders() });
  }

  // Supprimer un document
  deleteDocument(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/`, { headers: this.getHeaders() });
  }

  // POUR COMMISSION : Valider/Invalider un document
  validateDocument(id: number, valide: boolean, commentaire?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${id}/valider/`,
      { valide, commentaire },
      { headers: this.getHeaders() },
    );
  }
}
