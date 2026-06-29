import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

interface Specialite {
  nom: string;
  abreviation: string;
}

interface ParcoursRow {
  code_parcours: string;
  nom_parcours: string;
  type_formation: string;
  specialites: Specialite[];
  nombre_specialites: number;
  places: number;
  date_limite: string;
  type_label: string;
  color: string;
}

const PARCOURS_META: Record<string, { places: number; date_limite: string; type_label: string; color: string }> = {
  MPGL:  { places: 35,  date_limite: '22 juillet 2026',  type_label: 'Professionnel', color: 'blue'   },
  MPDS:  { places: 35,  date_limite: '22 juillet 2026',  type_label: 'Professionnel', color: 'teal'   },
  MP3I:  { places: 25,  date_limite: '20 juillet 2026',  type_label: 'Professionnel', color: 'amber'  },
  MRGL:  { places: 111, date_limite: '22 juillet 2026',  type_label: 'Recherche',     color: 'purple' },
  MRMI:  { places: 29,  date_limite: '20 juillet 2026',  type_label: 'Recherche',     color: 'indigo' },
};

@Component({
  selector: 'app-parcours-master',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pm-page">

      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="pm-header">
        <div class="pm-header-left">
          <h2 class="pm-title">Parcours Mastère — Offres 2025‑2026</h2>
          <p class="pm-subtitle">{{ rows.length }} parcours officiels · Inscriptions ouvertes</p>
        </div>
        <div class="pm-header-actions">
          <button type="button" class="btn-primary" (click)="ajouterParcours()">
            <i class="fas fa-plus"></i> Ajouter un parcours
          </button>
          <button class="pm-btn-refresh" (click)="load()" title="Actualiser">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 10a6 6 0 1 0 1-3.2"/><path d="M4 4v3h3"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- ── Loading ───────────────────────────────────────── -->
      <div *ngIf="loading" class="pm-loading">
        <div class="pm-spinner"></div>
        <span>Chargement des parcours…</span>
      </div>

      <!-- ── Error ────────────────────────────────────────── -->
      <div *ngIf="error && !loading" class="pm-error">
        <svg viewBox="0 0 20 20" fill="none" stroke="#dc2626" stroke-width="2" width="20" height="20">
          <circle cx="10" cy="10" r="9"/><line x1="10" y1="6" x2="10" y2="10"/><line x1="10" y1="14" x2="10.01" y2="14"/>
        </svg>
        {{ error }}
        <button (click)="load()">Réessayer</button>
      </div>

      <!-- ── Table ─────────────────────────────────────────── -->
      <div *ngIf="!loading && rows.length > 0" class="pm-table-wrap">
        <table class="pm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom du parcours</th>
              <th>Type</th>
              <th style="text-align:center">Places</th>
              <th>Date limite</th>
              <th style="text-align:center">Spécialités éligibles</th>
              <th style="text-align:center">Statut</th>
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let r of rows">
              <tr class="pm-row" [class.pm-row-expanded]="isExpanded(r.code_parcours)">
                <td>
                  <span class="pm-code" [class]="'pm-code-' + r.color">{{ r.code_parcours }}</span>
                </td>
                <td class="pm-nom">{{ r.nom_parcours }}</td>
                <td>
                  <span class="pm-type" [class]="r.type_label === 'Recherche' ? 'pm-type-recherche' : 'pm-type-pro'">
                    {{ r.type_label }}
                  </span>
                </td>
                <td style="text-align:center">
                  <strong>{{ r.places }}</strong>
                </td>
                <td class="pm-date">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="13" height="13">
                    <rect x="1" y="2" width="14" height="13" rx="2"/>
                    <line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/>
                    <line x1="1" y1="7" x2="15" y2="7"/>
                  </svg>
                  {{ r.date_limite }}
                </td>
                <td style="text-align:center">
                  <button class="pm-btn-spec" (click)="toggle(r.code_parcours)">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="12" height="12">
                      <path d="M4 6l4 4 4-4" *ngIf="!isExpanded(r.code_parcours)"/>
                      <path d="M4 10l4-4 4 4" *ngIf="isExpanded(r.code_parcours)"/>
                    </svg>
                    {{ r.nombre_specialites }} diplôme(s)
                  </button>
                </td>
                <td style="text-align:center">
                  <span class="pm-badge-ouvert">OUVERT</span>
                </td>
                <td style="text-align:center">
                  <button class="pm-btn-view" (click)="toggle(r.code_parcours)" title="Voir les spécialités">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">
                      <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                    </svg>
                  </button>
                </td>
              </tr>

              <!-- Expanded specialités row -->
              <tr *ngIf="isExpanded(r.code_parcours)" class="pm-spec-row">
                <td colspan="8">
                  <div class="pm-spec-panel">
                    <div class="pm-spec-title">
                      Diplômes / Licences éligibles pour
                      <strong>{{ r.nom_parcours }}</strong>
                    </div>
                    <div class="pm-spec-grid">
                      <div class="pm-spec-item" *ngFor="let s of r.specialites">
                        <span class="pm-spec-abrev" [class]="'pm-code-' + r.color">{{ s.abreviation }}</span>
                        <span class="pm-spec-nom">{{ s.nom }}</span>
                      </div>
                    </div>
                    <p *ngIf="!r.specialites || r.specialites.length === 0" class="pm-spec-empty">
                      Aucune spécialité définie.
                    </p>
                  </div>
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>

      <!-- ── Empty ──────────────────────────────────────────── -->
      <div *ngIf="!loading && rows.length === 0 && !error" class="pm-empty">
        <svg viewBox="0 0 64 64" fill="none" stroke="#94a3b8" stroke-width="2" width="48" height="48">
          <rect x="8" y="12" width="48" height="40" rx="4"/>
          <line x1="20" y1="26" x2="44" y2="26"/>
          <line x1="20" y1="34" x2="36" y2="34"/>
        </svg>
        <p>Aucun parcours master trouvé. Vérifiez que le script de peuplement a été exécuté.</p>
      </div>

    </div>
  `,
  styles: [`
    .pm-page {
      padding: 1.5rem 2rem;
      font-family: 'Inter', 'Segoe UI', sans-serif;
    }

    /* Header */
    .pm-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .pm-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.2rem;
    }
    .pm-subtitle {
      font-size: 0.82rem;
      color: #64748b;
      margin: 0;
    }
    .pm-header-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 1.1rem;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.12s, box-shadow 0.12s;
      box-shadow: 0 2px 5px rgba(37, 99, 235, 0.25);
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.32);
    }
    .btn-primary i { font-size: 0.78rem; }
    .pm-btn-refresh {
      background: #f1f5f9;
      border: none;
      border-radius: 8px;
      padding: 0.45rem;
      cursor: pointer;
      color: #64748b;
      display: flex;
      align-items: center;
      transition: background 0.15s;
    }
    .pm-btn-refresh svg { width: 17px; height: 17px; }
    .pm-btn-refresh:hover { background: #e2e8f0; color: #1e293b; }

    /* Loading */
    .pm-loading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 2.5rem;
      color: #64748b;
      font-size: 0.9rem;
    }
    .pm-spinner {
      width: 22px;
      height: 22px;
      border: 2.5px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Error */
    .pm-error {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 1rem 1.25rem;
      background: #fef2f2;
      border-radius: 10px;
      color: #dc2626;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .pm-error button {
      margin-left: auto;
      padding: 0.3rem 0.9rem;
      border: 1.5px solid #dc2626;
      border-radius: 6px;
      background: transparent;
      color: #dc2626;
      font-size: 0.78rem;
      cursor: pointer;
    }
    .pm-error button:hover { background: #dc2626; color: #fff; }

    /* Table */
    .pm-table-wrap {
      background: #fff;
      border-radius: 14px;
      border: 1.5px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .pm-table {
      width: 100%;
      border-collapse: collapse;
    }
    .pm-table thead tr {
      background: #f8fafc;
      border-bottom: 1.5px solid #e2e8f0;
    }
    .pm-table th {
      padding: 0.75rem 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      text-align: left;
      white-space: nowrap;
    }
    .pm-table td {
      padding: 0.85rem 1rem;
      font-size: 0.85rem;
      color: #1e293b;
      vertical-align: middle;
      border-bottom: 1px solid #f1f5f9;
    }
    .pm-row:last-child td { border-bottom: none; }
    .pm-row:hover td { background: #f8fafc; }
    .pm-row-expanded td { background: #f8fafc; }

    /* Code badges */
    .pm-code {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      white-space: nowrap;
    }
    .pm-code-blue   { background: #dbeafe; color: #1e40af; }
    .pm-code-teal   { background: #ccfbf1; color: #0f766e; }
    .pm-code-amber  { background: #fef3c7; color: #b45309; }
    .pm-code-purple { background: #ede9fe; color: #6d28d9; }
    .pm-code-indigo { background: #e0e7ff; color: #3730a3; }

    .pm-nom {
      font-weight: 600;
      max-width: 340px;
    }

    /* Type badge */
    .pm-type {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.22rem 0.6rem;
      border-radius: 999px;
      white-space: nowrap;
    }
    .pm-type-pro      { background: #dbeafe; color: #1e40af; }
    .pm-type-recherche{ background: #f3e8ff; color: #7c3aed; }

    /* Date */
    .pm-date {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.82rem;
      color: #475569;
      white-space: nowrap;
    }

    /* Statut OUVERT */
    .pm-badge-ouvert {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #047857;
      background: #d1fae5;
      border: 1px solid #6ee7b7;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
    }

    /* Specialités button */
    .pm-btn-spec {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.3rem 0.7rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      background: transparent;
      font-size: 0.77rem;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .pm-btn-spec:hover { border-color: #94a3b8; background: #f1f5f9; color: #1e293b; }

    /* View button */
    .pm-btn-view {
      background: none;
      border: none;
      padding: 0.3rem;
      cursor: pointer;
      color: #3b82f6;
      border-radius: 6px;
      transition: background 0.15s;
    }
    .pm-btn-view:hover { background: #eff6ff; }

    /* Specialités expanded panel */
    .pm-spec-row td {
      background: #f8fafc !important;
      border-bottom: 1.5px solid #e2e8f0 !important;
      padding: 0 !important;
    }
    .pm-spec-panel {
      padding: 1rem 1.25rem 1.25rem;
      border-top: 1.5px dashed #e2e8f0;
    }
    .pm-spec-title {
      font-size: 0.8rem;
      color: #64748b;
      margin-bottom: 0.75rem;
    }
    .pm-spec-title strong { color: #0f172a; }
    .pm-spec-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.45rem;
    }
    .pm-spec-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.45rem 0.65rem;
    }
    .pm-spec-abrev {
      flex-shrink: 0;
      font-size: 0.62rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.6;
    }
    .pm-spec-nom {
      font-size: 0.78rem;
      color: #334155;
      line-height: 1.4;
    }
    .pm-spec-empty {
      font-size: 0.8rem;
      color: #94a3b8;
      font-style: italic;
      margin: 0;
    }

    /* Empty state */
    .pm-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 3rem;
      color: #94a3b8;
      font-size: 0.875rem;
      text-align: center;
    }
  `],
})
export class ParcoursMasterComponent implements OnInit {
  rows: ParcoursRow[] = [];
  loading = false;
  error = '';
  private expanded = new Set<string>();

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('access_token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  constructor(private http: HttpClient, private router: Router) {}

  ajouterParcours() {
    this.router.navigate(['/admin/parcours-master/new']);
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';
    this.http
      .get<any[]>(`${environment.apiUrl}/candidatures/all-parcours/?type_formation=master`, {
        headers: this.headers,
      })
      .subscribe({
        next: (data) => {
          this.rows = (data || []).map((p) => {
            const meta = PARCOURS_META[p.code_parcours] ?? {
              places: 0,
              date_limite: '—',
              type_label: p.type_formation === 'master' ? 'Master' : 'Ingénieur',
              color: 'blue',
            };
            return {
              ...p,
              ...meta,
              specialites: Array.isArray(p.specialites) ? p.specialites : [],
              nombre_specialites: p.nombre_specialites ?? (Array.isArray(p.specialites) ? p.specialites.length : 0),
            } as ParcoursRow;
          });
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.error || 'Erreur lors du chargement des parcours.';
          this.loading = false;
        },
      });
  }

  toggle(code: string) {
    if (this.expanded.has(code)) {
      this.expanded.delete(code);
    } else {
      this.expanded.add(code);
    }
  }

  isExpanded(code: string): boolean {
    return this.expanded.has(code);
  }
}
