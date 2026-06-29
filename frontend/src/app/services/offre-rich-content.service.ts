import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { OffreRichContent } from '../shared/offre-rich-content';
import { AuthService } from './auth.service';

interface OffreRichContentResponse {
  offerId: number;
  updatedAt: string;
  content: OffreRichContent | null;
}

@Injectable({ providedIn: 'root' })
export class OffreRichContentService {
  private readonly apiBase = environment.candidatureServiceUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  getOffreRichContent(offerId: number): Observable<OffreRichContent | null> {
    return this.http
      .get<OffreRichContentResponse>(
        `${this.apiBase}/offres-inscription/${offerId}/contenu-edite/`,
        {
          headers: this.buildHeaders(),
        },
      )
      .pipe(map((response) => response?.content || null));
  }

  saveOffreRichContent(content: OffreRichContent): Observable<OffreRichContent> {
    return this.http
      .put<OffreRichContentResponse>(
        `${this.apiBase}/offres-inscription/${content.offerId}/contenu-edite/`,
        content,
        {
          headers: this.buildHeaders(),
        },
      )
      .pipe(map((response) => response.content || content));
  }

  private buildHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
