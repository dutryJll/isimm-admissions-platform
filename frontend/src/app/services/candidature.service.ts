import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MasterScoreCoefficients {
  master_id: number;
  master_nom: string;
  coeff_bac: number;
  coeff_licence: number;
  coeff_examen: number;
  bonus_mention: number;
}

@Injectable({
  providedIn: 'root',
})
export class CandidatureService {
  private apiUrl = environment.candidatureServiceUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(includeJsonContentType: boolean = true): HttpHeaders {
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const activeCommissionId = localStorage.getItem('active_commission_id');
    if (activeCommissionId && activeCommissionId !== 'null') {
      headers['X-Active-Commission-Id'] = activeCommissionId;
    }

    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return new HttpHeaders(headers);
  }

  // Créer une candidature
  createCandidature(data: any): Observable<any> {
    const endpoint = `${this.apiUrl}/create/`;
    return this.http.post(endpoint, data, { headers: this.getHeaders() });
  }

  // Récupérer mes candidatures
  getMesCandidatures(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes-candidatures/`, { headers: this.getHeaders() });
  }

  // Récupérer une candidature spécifique
  getCandidature(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes-candidatures/`, { headers: this.getHeaders() });
  }

  // Mettre à jour une candidature
  updateCandidature(id: number, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/modifier/`, data, { headers: this.getHeaders() });
  }

  // Mettre à jour le statut d'une candidature
  updateStatus(candidatureId: number, newStatus: string, motifRejet?: string): Observable<any> {
    const headers = this.getHeaders();
    const payload = {
      nouveau_statut: newStatus,
      raison: motifRejet || '',
    };

    return this.http
      .post(`${this.apiUrl}/${candidatureId}/statut/changer/`, payload, {
        headers,
      })
      .pipe(
        catchError(() =>
          this.http
            .patch(
              `${this.apiUrl}/${candidatureId}/update-status/`,
              {
                statut: newStatus,
                motif_rejet: motifRejet || '',
              },
              { headers },
            )
            .pipe(
              catchError(() =>
                this.http.patch(
                  `${this.apiUrl}/${candidatureId}/`,
                  { statut: newStatus },
                  { headers },
                ),
              ),
            ),
        ),
      );
  }

  // Récupérer les métriques en temps réel pour le candidat (score, classement, total)
  getCandidateLiveMetrics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/candidate-live-metrics/`, { headers: this.getHeaders() });
  }

  // Récupérer les coefficients de calcul d'un master.
  getMasterCoefficients(masterId: number): Observable<MasterScoreCoefficients> {
    return this.http.get<MasterScoreCoefficients>(
      `${this.apiUrl}/masters/${masterId}/coefficients/`,
      {
        headers: this.getHeaders(),
      },
    );
  }

  // Récupérer tous les masters ouverts
  getMastersOuverts(): Observable<any> {
    return this.http.get(`${this.apiUrl}/masters/`, { headers: this.getHeaders() });
  }

  // POUR ADMIN/COMMISSION : Récupérer toutes les candidatures
  getAllCandidatures(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes-candidatures/`, { headers: this.getHeaders() });
  }

  // POUR COMMISSION : récupérer la liste classée des candidatures masters
  getCandidaturesCommissionClassees(masterId?: number | string): Observable<any> {
    let params = new HttpParams().set('type', 'masters');
    if (
      masterId !== undefined &&
      masterId !== null &&
      `${masterId}`.trim() !== '' &&
      `${masterId}` !== 'all'
    ) {
      params = params.set('master_id', `${masterId}`);
    }

    return this.http.get(`${this.apiUrl}/responsable/candidatures/`, {
      headers: this.getHeaders(),
      params,
    });
  }

  // POUR COMMISSION : récupérer les candidatures Cycle Ingénieur (filtrées par spécialité côté backend)
  getCandidaturesIngenieurCommission(): Observable<any> {
    const params = new HttpParams().set('type', 'ingenieur');
    return this.http.get(`${this.apiUrl}/responsable/candidatures/`, {
      headers: this.getHeaders(),
      params,
    });
  }

  // POUR COMMISSION : télécharger l'attestation PDF individuelle d'une candidature
  genererAttestation(candidatureId: number, force = false): Observable<Blob> {
    const params = force ? new HttpParams().set('force', '1') : new HttpParams();
    return this.http.get(`${this.apiUrl}/${candidatureId}/generer-pdf/`, {
      headers: this.getHeaders(false),
      params,
      responseType: 'blob',
    });
  }

  // POUR COMMISSION : OCR sur un PDF de relevé de notes (pdf2image + PaddleOCR)
  analyserOcrCandidature(
    candidatureId: number,
    fichier?: File,
    updateScore = false,
  ): Observable<any> {
    const formData = new FormData();
    if (fichier) {
      formData.append('fichier', fichier, fichier.name);
    }
    if (updateScore) {
      formData.append('update_score', '1');
    }
    return this.http.post(
      `${this.apiUrl}/${candidatureId}/analyser-ocr/`,
      formData,
      { headers: this.getHeaders(false) },
    );
  }

  // POUR COMMISSION / CANDIDAT : lister les fichiers réels déposés par le candidat
  // (scan filesystem côté Django)
  getFichiersDeposes(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/list-fichiers-deposes/`, {
      headers: this.getHeaders(),
    });
  }

  // POUR RESPONSABLE/COMMISSION : analyse OCR par lot sur plusieurs candidatures
  analyserOcrLot(candidatureIds: number[]): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/analyser-ocr-lot/`,
      { candidature_ids: candidatureIds },
      { headers: this.getHeaders() },
    );
  }

  // Export du rapport de conformité OCR au format Excel
  exportRapportOcrExcel(candidatureIds: number[]): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/rapport-conformite-ocr/excel/`,
      { candidature_ids: candidatureIds },
      { headers: this.getHeaders(), responseType: 'blob' },
    );
  }

  // Export du rapport de conformité OCR au format PDF
  exportRapportOcrPdf(candidatureIds: number[]): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/rapport-conformite-ocr/pdf/`,
      { candidature_ids: candidatureIds },
      { headers: this.getHeaders(), responseType: 'blob' },
    );
  }

  // POUR COMMISSION : lister les avis d'une candidature (responsable + membres)
  getAvisCandidature(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/avis/list/`, {
      headers: this.getHeaders(),
    });
  }

  // POUR MEMBRE COMMISSION : soumettre/mettre à jour son avis sur une candidature
  soumettreAvisMembre(
    candidatureId: number,
    payload: { avis: boolean; argument?: string; commission_id?: number },
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/${candidatureId}/avis/`, payload, {
      headers: this.getHeaders(),
    });
  }

  // POUR COMMISSION : spécialités de diplômes admissibles pour un master donné
  // Source : SpecialiteParcoursMapping (seedé via migration 0025 / seed_specialites_parcours)
  // Le composant extrait res.specialites depuis la réponse.
  getSpecialitesAdmissibles(masterId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/masters/${masterId}/specialites-admissibles/`,
      { headers: this.getHeaders() },
    );
  }

  // POUR COMMISSION : générer le PDF officiel de sélection (LISTE PRINCIPALE + ATTENTE)
  // Appel direct sans sélection de checkboxes — cible toute la promotion du master
  genererListeOfficielle(
    masterId: number,
    etape: 'PRESELECTION' | 'SELECTION' = 'SELECTION',
    annee: string = '2025-2026',
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('parcoursId', masterId.toString())
      .set('etape', etape)
      .set('annee', annee);
    return this.http.get(`${this.apiUrl}/documents/generer-pdf/`, {
      headers: this.getHeaders(false),
      params,
      responseType: 'blob',
    });
  }

  // POUR COMMISSION : accepter ou refuser une candidature
  deciderCandidatureCommission(
    candidatureId: number,
    decision: 'accepter' | 'refuser',
    motifRejet?: string,
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${candidatureId}/commission-decision/`,
      { decision, motif_rejet: motifRejet || '' },
      { headers: this.getHeaders() },
    );
  }

  // Déposer ou ajuster le dossier numérique pour une candidature présélectionnée
  deposerDossierNumerique(candidatureId: number, payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${candidatureId}/deposer-dossier/`, payload, {
      headers: this.getHeaders(),
    });
  }

  deposerDossierNumeriqueWithProgress(
    candidatureId: number,
    payload: any,
  ): Observable<HttpEvent<any>> {
    return this.http.post<any>(`${this.apiUrl}/${candidatureId}/deposer-dossier/`, payload, {
      headers: this.getHeaders(),
      observe: 'events',
      reportProgress: true,
    });
  }

  // Calculer le score réel du wizard via le backend (pour preview en temps réel)
  calculateWizardScore(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/preview-score/`, payload, {
      headers: this.getHeaders(),
    });
  }

  // Créer une réclamation
  createReclamation(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reclamations/`, data, { headers: this.getHeaders() });
  }

  // Récupérer mes réclamations
  getMesReclamations(): Observable<any> {
    return this.http.get(`${this.apiUrl}/reclamations/mes-reclamations/`, {
      headers: this.getHeaders(),
    });
  }

  // POUR COMMISSION : Récupérer toutes les réclamations
  getAllReclamations(): Observable<any> {
    return this.http.get(`${this.apiUrl}/reclamations/`, { headers: this.getHeaders() });
  }

  // Traiter une réclamation (accepter/rejeter)
  traiterReclamation(id: number, decision: string, motif?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/reclamations/${id}/traiter/`,
      { decision, motif },
      { headers: this.getHeaders() },
    );
  }

  // Get specialites for a specific master
  getSpecialitesForMaster(masterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/masters/${masterId}/specialites/`, {
      headers: this.getHeaders(),
    });
  }

  // Get available offers with specialites (dynamic filtering)
  getAvailableOffersWithSpecialites(): Observable<any> {
    return this.http.get(`${this.apiUrl}/offers-available/`, {
      headers: this.getHeaders(),
    });
  }

  // Check if candidate can reapply to a master
  getCanReapply(masterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/masters/${masterId}/can-reapply/`, {
      headers: this.getHeaders(),
    });
  }

  // Get specialites by parcours code (MPDS, MPGL, MP3I, MRGL, MRMI, ING_APPLI)
  getSpecialitesParParcours(parcoursCode: string): Observable<any> {
    let params = new HttpParams().set('parcours_code', parcoursCode);
    return this.http.get(`${this.apiUrl}/specialites/by-parcours/`, {
      headers: this.getHeaders(),
      params,
    });
  }

  // Get all parcours (Masters and Ingénieur)
  getAllParcours(typeFormation?: 'master' | 'ingenieur'): Observable<any> {
    let params = new HttpParams();
    if (typeFormation) {
      params = params.set('type_formation', typeFormation);
    }
    return this.http.get(`${this.apiUrl}/all-parcours/`, {
      headers: this.getHeaders(),
      params,
    });
  }

  // Get specialites for preselection section
  getSpecialitesForPreselection(masterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/masters/${masterId}/specialites-preselection/`, {
      headers: this.getHeaders(),
    });
  }

  // Get specialites for dossier section
  getSpecialitesForDossier(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/specialites-dossier/`, {
      headers: this.getHeaders(),
    });
  }

  // Commission: consulter le dossier complet d'une candidature
  getCommissionDossier(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/dossier/commission-dossier/${candidatureId}/`, {
      headers: this.getHeaders(),
    });
  }

  // Get specialites for inscription section
  getSpecialitesForInscription(masterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/masters/${masterId}/specialites-inscription/`, {
      headers: this.getHeaders(),
    });
  }

  // Submit avis (opinion) for a candidature
  submitAvis(
    candidatureId: number,
    data: { avis: boolean; argument: string; commission_id?: number },
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/${candidatureId}/avis/`, data, {
      headers: this.getHeaders(),
    });
  }

  // Get statistics for avis on a candidature
  getAvisStatistiques(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/avis/statistiques/`, {
      headers: this.getHeaders(),
    });
  }

  // List all avis for a candidature
  listAvis(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/avis/list/`, {
      headers: this.getHeaders(),
    });
  }

  // Get specific avis details
  getAvisDetail(candidatureId: number, avisId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/avis/${avisId}/`, {
      headers: this.getHeaders(),
    });
  }

  // Update avis
  updateAvis(
    candidatureId: number,
    avisId: number,
    data: { avis: boolean; argument: string },
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/${candidatureId}/avis/${avisId}/update/`, data, {
      headers: this.getHeaders(),
    });
  }

  // Delete avis
  deleteAvis(candidatureId: number, avisId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${candidatureId}/avis/${avisId}/delete/`, {
      headers: this.getHeaders(),
    });
  }

  // Filter avis by commission with optional parameters
  filterAvisByCommission(
    masterId: number,
    filters?: {
      commission_id?: number;
      member_id?: number;
      avis_type?: string;
      date_from?: string;
      date_to?: string;
    },
  ): Observable<any> {
    let params = new HttpParams();
    if (filters) {
      if (filters.commission_id) {
        params = params.set('commission_id', filters.commission_id.toString());
      }
      if (filters.member_id) {
        params = params.set('member_id', filters.member_id.toString());
      }
      if (filters.avis_type) {
        params = params.set('avis_type', filters.avis_type);
      }
      if (filters.date_from) {
        params = params.set('date_from', filters.date_from);
      }
      if (filters.date_to) {
        params = params.set('date_to', filters.date_to);
      }
    }
    return this.http.get(`${this.apiUrl}/masters/${masterId}/avis/filter/`, {
      headers: this.getHeaders(),
      params,
    });
  }

  // Get commission members for a master
  getCommissionMembers(masterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/masters/${masterId}/commission-members/`, {
      headers: this.getHeaders(),
    });
  }

  // Get commissions available for the authenticated user
  getMyCommissions(activeCommissionId?: number | null): Observable<any> {
    let headers = this.getHeaders();
    if (activeCommissionId !== undefined && activeCommissionId !== null) {
      headers = headers.set('X-Active-Commission-Id', String(activeCommissionId));
    }
    return this.http.get(`${this.apiUrl}/my-commissions/`, {
      headers,
    });
  }

  // Admin: Bulk delete avis
  bulkDeleteAvis(avisIds: number[]): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/avis/bulk-delete/`,
      { avis_ids: avisIds },
      { headers: this.getHeaders() },
    );
  }

  // Admin: Bulk update candidature status
  bulkUpdateCandidatureStatus(
    candidatureIds: number[],
    status: string,
    reason?: string,
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/candidatures/bulk-update-status/`,
      { candidature_ids: candidatureIds, status, reason: reason || '' },
      { headers: this.getHeaders() },
    );
  }

  // Admin: Assign candidatures to a member
  assignCandidaturesToMember(
    candidatureIds: number[],
    memberId: number,
    commissionId: number,
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/admin/candidatures/assign-to-member/`,
      { candidature_ids: candidatureIds, member_id: memberId, commission_id: commissionId },
      { headers: this.getHeaders() },
    );
  }

  // Admin: Get dashboard statistics
  getAdminDashboardStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admin/dashboard-stats/`, {
      headers: this.getHeaders(),
    });
  }

  // Configuration Appel / Offre Management
  getConfiguration(masterId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/configuration/${masterId}/`, {
      headers: this.getHeaders(),
    });
  }

  createConfiguration(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/configuration/`, data, {
      headers: this.getHeaders(),
    });
  }

  updateConfiguration(masterId: number, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/configuration/${masterId}/`, data, {
      headers: this.getHeaders(),
    });
  }

  uploadConfigurationDocument(masterId: number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('document_pdf', file);

    const headers = new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    });

    return this.http.post(`${this.apiUrl}/configuration/${masterId}/document-pdf/`, formData, {
      headers,
    });
  }

  // Get user's commissions (multi-commission support)
  getUserCommissions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/me/commissions/`, {
      headers: this.getHeaders(),
    });
  }

  // Get avis list for a candidature
  getAvisList(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/avis/list/`, {
      headers: this.getHeaders(),
    });
  }

  // Get avis statistics for a candidature
  getAvisStats(candidatureId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${candidatureId}/avis/statistiques/`, {
      headers: this.getHeaders(),
    });
  }

  // Responsable: set final decision for a candidature
  setDecisionResponsable(
    candidatureId: number,
    decision: 'valide' | 'rejete' | 'en_attente',
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${candidatureId}/decision-responsable/`,
      { decision },
      { headers: this.getHeaders() },
    );
  }

  // Responsable: envoyer un appel à avis aux membres d'une commission
  sendAppelAvis(commissionId: number, message?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/commissions/${commissionId}/appel-avis/`,
      { message: message || '' },
      { headers: this.getHeaders() },
    );
  }

  // Member: submit one global avis for the active preselection list
  submitGlobalAvis(
    commissionId: number,
    data: { statut: 'favorable' | 'defavorable'; commentaire?: string; is_global?: boolean },
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/commissions/${commissionId}/avis-global/`, data, {
      headers: this.getHeaders(),
    });
  }

  // Responsable: get collégial summary table for global avis responses
  getCommissionGlobalAvisSummary(commissionId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/commissions/${commissionId}/avis-global/`, {
      headers: this.getHeaders(),
    });
  }

  // Valider la présélection d'une candidature (avec notification)
  validerPreselection(candidatureId: number, recommandation?: string, commentaire?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${candidatureId}/valider-preselection/`,
      { recommandation: recommandation || '', commentaire: commentaire || '' },
      { headers: this.getHeaders() },
    );
  }

  // Exporter résultats OCR en Excel
  exportOcrExcel(resultats: any[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/export-ocr-excel/`, { resultats }, {
      headers: this.getHeaders(),
      responseType: 'blob',
    });
  }

  // Exporter résultats OCR en PDF
  exportOcrPdf(resultats: any[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/export-ocr-pdf/`, { resultats }, {
      headers: this.getHeaders(),
      responseType: 'blob',
    });
  }

  // Workflow d'inscription en ligne
  saisirNumeroInscription(candidatureId: number, numeroInscription: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${candidatureId}/saisir-numero/`,
      { numero_inscription: numeroInscription },
      { headers: this.getHeaders() }
    );
  }

  verifierExcelInscriptions(fichier: File, masterId?: number): Observable<any> {
    const formData = new FormData();
    formData.append('fichier', fichier);
    if (masterId) {
      formData.append('master_id', masterId.toString());
    }
    return this.http.post(
      `${this.apiUrl}/verifier-excel-inscriptions/`,
      formData,
      { headers: this.getHeaders() }
    );
  }

  // v7 §6.5 — Compare la liste importée aux admis → « admis non inscrits »
  comparerInscritsAdmis(fichier: File, masterId?: number): Observable<any> {
    const formData = new FormData();
    formData.append('fichier', fichier);
    if (masterId) {
      formData.append('master_id', masterId.toString());
    }
    return this.http.post(
      `${this.apiUrl}/comparer-inscrits-admis/`,
      formData,
      { headers: this.getHeaders() }
    );
  }

  // Liste réelle des inscriptions saisies par les candidats (espace responsable)
  getInscriptionsSaisies(masterId?: number): Observable<any> {
    const query = masterId ? `?master_id=${masterId}` : '';
    return this.http.get(
      `${this.apiUrl}/inscriptions-saisies/${query}`,
      { headers: this.getHeaders() }
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // MULTI-COMMISSION SUPPORT
  // ──────────────────────────────────────────────────────────────────────

  mesCommissions(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/commissions/mes-commissions-membre/`,
      { headers: this.getHeaders() }
    );
  }

  getCandidaturesByCommission(commissionId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/par-commission/${commissionId}/`,
      { headers: this.getHeaders() }
    );
  }

  getDossiersByCommission(candidatureId: number, commissionId: number): Observable<any> {
    let params = new HttpParams().set('commission_id', commissionId.toString());
    return this.http.get(
      `${this.apiUrl}/${candidatureId}/dossier/`,
      { headers: this.getHeaders(), params }
    );
  }

  setSelectedCommission(commissionId: number): void {
    if (commissionId) {
      sessionStorage.setItem('selectedCommissionId', commissionId.toString());
      localStorage.setItem('active_commission_id', commissionId.toString());
    }
  }

  getSelectedCommission(): number | null {
    const stored = sessionStorage.getItem('selectedCommissionId');
    return stored ? parseInt(stored, 10) : null;
  }

  clearSelectedCommission(): void {
    sessionStorage.removeItem('selectedCommissionId');
    localStorage.removeItem('active_commission_id');
  }
}
