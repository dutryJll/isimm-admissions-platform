import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface MyActionsResponse {
  role: string;
  actions: Array<{
    action_no: number;
    action_name: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.authServiceUrl;
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private enabledActions = new Set<string>();
  private actionsLoaded = false;

  // Persistance de l'état candidature entre les refreshs de page
  private hasCandidatureSubject = new BehaviorSubject<boolean>(
    localStorage.getItem('has_candidature') === '1',
  );
  public hasCandidature$ = this.hasCandidatureSubject.asObservable();

  get hasCandidatureValue(): boolean {
    return this.hasCandidatureSubject.value;
  }

  setHasCandidature(value: boolean): void {
    localStorage.setItem('has_candidature', value ? '1' : '0');
    this.hasCandidatureSubject.next(value);
  }

  get currentUserValue(): any {
    return this.currentUserSubject.value;
  }

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    const storedUser = this.getCurrentUser();
    if (storedUser) {
      this.currentUserSubject.next(storedUser);
    }

    // Nettoyage defensif au chargement si le token est expire.
    if (!this.getAccessToken()) {
      localStorage.removeItem('current_user');
      this.currentUserSubject.next(null);
    }
  }

  login(email: string, password: string): Observable<any> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = (password || '').trim();

    return this.http
      .post(`${this.apiUrl}/login/`, {
        email: normalizedEmail,
        password: normalizedPassword,
      })
      .pipe(
        tap((response: any) => {

          if (response.access && response.user) {
            localStorage.setItem('access_token', response.access);
            localStorage.setItem('refresh_token', response.refresh);
            localStorage.setItem('current_user', JSON.stringify(response.user));

            this.currentUserSubject.next(response.user);

          }
        }),
        catchError((error: any) => {
          if (error?.status === 0) {
            console.error(`âŒ Service Auth indisponible: ${this.apiUrl}`);
          }
          console.error('âŒ Erreur login:', error);
          return throwError(() => error);
        }),
      );
  }

  register(userData: any): Observable<any> {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    return this.http.post(`${this.apiUrl}/register/`, userData);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('has_candidature');
    this.enabledActions.clear();
    this.actionsLoaded = false;
    this.hasCandidatureSubject.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): any {
    const userStr = localStorage.getItem('current_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        console.error('âŒ Erreur parsing user:', e);
        return null;
      }
    }
    return null;
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return null;
    }

    if (this.isTokenExpired(token)) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('current_user');
      this.currentUserSubject.next(null);
      return null;
    }

    return token;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) {
        return true;
      }

      const payloadJson = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson);
      const exp = Number(payload?.exp);
      if (!exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      return exp <= now;
    } catch {
      return true;
    }
  }

  refreshToken(): Observable<any> {
    const refresh = localStorage.getItem('refresh_token');
    return this.http.post(`${this.apiUrl}/refresh/`, { refresh }).pipe(
      tap((response: any) => {
        if (response.access) {
          localStorage.setItem('access_token', response.access);
        }
      }),
    );
  }

  verifyPassword(email: string, password: string): Observable<any> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedPassword = (password || '').trim();

    return this.http
      .post(`${this.apiUrl}/login/`, {
        email: normalizedEmail,
        password: normalizedPassword,
      })
      .pipe(
        tap((response: any) => {
        }),
        catchError((error: any) => {
          console.error('âŒ Mot de passe incorrect');
          return throwError(() => error);
        }),
      );
  }

  getMyEnabledActions(forceReload: boolean = false): Observable<string[]> {
    if (this.actionsLoaded && !forceReload) {
      return of(Array.from(this.enabledActions));
    }

    const token = this.getAccessToken();
    if (!token) {
      this.actionsLoaded = false;
      return throwError(() => new Error('No access token'));
    }

    return this.http
      .get<MyActionsResponse>(`${this.apiUrl}/my-actions/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        map((response) => (response.actions || []).map((item) => item.action_name || '')),
        tap((actionNames) => {
          this.enabledActions = new Set(
            actionNames.filter((name) => !!name).map((name) => this.normalizeActionName(name)),
          );
          this.actionsLoaded = true;
        }),
        catchError((error: any) => {
          this.actionsLoaded = false;
          // Important: ne pas vider enabledActions ici.
          // On relaie l'erreur pour que les guards/components appliquent le fallback permissif.
          return throwError(() => error);
        }),
      );
  }

  hasMyAction(actionNames: string | string[]): boolean {
    const names = Array.isArray(actionNames) ? actionNames : [actionNames];
    if (!names.length) {
      return false;
    }

    return names.some((name) => this.enabledActions.has(this.normalizeActionName(name)));
  }

  private normalizeActionName(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
