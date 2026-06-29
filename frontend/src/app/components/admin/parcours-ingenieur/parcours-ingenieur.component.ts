import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Parcours {
  id: number;
  nom: string;
  master_nom: string;
  type: string;
  type_display: string;
  capacite: number;
  date_limite: string;
  statut: string;
  statut_display: string;
}

@Component({
  selector: 'app-parcours-ingenieur',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="parcours-container">
      <h2>Gestion des Parcours Ingénieur</h2>

      <button class="btn btn-primary" (click)="openForm()">+ Ajouter un parcours</button>

      <div class="parcours-list" *ngIf="parcours && parcours.length > 0">
        <table class="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Master</th>
              <th>Capacité</th>
              <th>Date Limite</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of parcours">
              <td>{{ p.nom }}</td>
              <td>{{ p.master_nom }}</td>
              <td>{{ p.capacite }}</td>
              <td>{{ p.date_limite | date: 'dd/MM/yyyy' }}</td>
              <td>
                <span [ngClass]="'badge badge-' + getStatutClass(p.statut)">
                  {{ p.statut_display }}
                </span>
              </td>
              <td class="actions-cell">
                <div class="kebab-container">
                  <button class="kebab-btn" (click)="toggleActionMenu(p.id)" title="Actions">
                    <i class="fas fa-ellipsis-v"></i>
                  </button>
                  <ul class="kebab-menu" *ngIf="isActionMenuOpen(p.id)">
                    <li>
                      <button
                        class="menu-item"
                        (click)="toggleStatutParcours(p); toggleActionMenu(p.id)"
                      >
                        <i class="fas fa-toggle-on"></i>
                        <span>{{
                          p.statut === 'ouvert' ? 'Fermer le parcours' : 'Ouvrir le parcours'
                        }}</span>
                      </button>
                    </li>
                    <li>
                      <button class="menu-item" (click)="editParcours(p); toggleActionMenu(p.id)">
                        <i class="fas fa-edit"></i>
                        <span>Modifier</span>
                      </button>
                    </li>
                    <li>
                      <button
                        class="menu-item danger"
                        (click)="deleteParcours(p.id); toggleActionMenu(p.id)"
                      >
                        <i class="fas fa-trash"></i>
                        <span>Supprimer</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p *ngIf="!parcours || parcours.length === 0" class="text-muted">Aucun Parcours Ingénieur</p>

      <!-- Formulaire Modal -->
      <div class="modal" *ngIf="showForm">
        <div class="modal-content">
          <span class="close" (click)="closeForm()">&times;</span>
          <h3>{{ isEditing ? 'Modifier' : 'Créer' }} un Parcours Ingénieur</h3>

          <form [formGroup]="parcourForm" (ngSubmit)="saveParcours()">
            <div class="form-group">
              <label>Master</label>
              <select formControlName="master" class="form-control" required>
                <option value="">Sélectionner</option>
                <option *ngFor="let m of masters" [value]="m.id">{{ m.nom }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>Nom du Parcours</label>
              <input type="text" formControlName="nom" class="form-control" required />
            </div>

            <div class="form-group">
              <label>Capacité</label>
              <input type="number" formControlName="capacite" class="form-control" />
            </div>

            <div class="form-group">
              <label>Date Limite</label>
              <input type="date" formControlName="date_limite" class="form-control" />
            </div>

            <div class="form-group">
              <label>Statut</label>
              <select formControlName="statut" class="form-control">
                <option value="brouillon">Brouillon</option>
                <option value="ouvert">Ouvert</option>
                <option value="ferme">Fermé</option>
              </select>
            </div>

            <button type="submit" class="btn btn-success">Sauvegarder</button>
            <button type="button" class="btn btn-secondary" (click)="closeForm()">Annuler</button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .parcours-container {
        padding: 20px;
      }
      .btn {
        padding: 8px 12px;
        margin: 5px;
        border: none;
        cursor: pointer;
        border-radius: 4px;
      }
      .btn-primary {
        background-color: #007bff;
        color: white;
      }
      .btn-info {
        background-color: #17a2b8;
        color: white;
      }
      .btn-danger {
        background-color: #dc3545;
        color: white;
      }
      .btn-success {
        background-color: #28a745;
        color: white;
      }
      .btn-secondary {
        background-color: #6c757d;
        color: white;
      }
      .modal {
        display: block;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.4);
      }
      .modal-content {
        background-color: white;
        margin: 10% auto;
        padding: 20px;
        border: 1px solid #888;
        width: 500px;
        border-radius: 8px;
      }
      .close {
        color: #aaa;
        float: right;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-control {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      .badge-brouillon {
        background-color: #f8d7da;
        color: #721c24;
      }
      .badge-ouvert {
        background-color: #d4edda;
        color: #155724;
      }
      .badge-ferme {
        background-color: #f5f5f5;
        color: #6c757d;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      .table th,
      .table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      .table th {
        background-color: #f8f9fa;
      }

      .actions-cell {
        position: relative;
        overflow: visible;
      }

      .kebab-container {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .kebab-btn {
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.35rem 0.45rem;
        border-radius: 6px;
        transition: all 0.2s ease;
      }

      .kebab-btn:hover {
        background: #f1f5f9;
        color: #1e293b;
      }

      .kebab-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 0.4rem);
        min-width: 220px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
        list-style: none;
        padding: 0;
        margin: 0;
        z-index: 3000;
      }

      .kebab-menu li {
        margin: 0;
      }

      .menu-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.7rem 0.95rem;
        border: none;
        background: transparent;
        color: #334155;
        text-align: left;
        cursor: pointer;
      }

      .menu-item:hover {
        background: #f8fafc;
      }

      .menu-item.danger {
        color: #b91c1c;
      }
    `,
  ],
})
export class ParcoursIngenieurComponent implements OnInit {
  parcours: Parcours[] = [];
  masters: any[] = [];
  parcourForm!: FormGroup;
  showForm = false;
  isEditing = false;
  editingId: number | null = null;
  private actionMenuOpen: { [id: number]: boolean } = {};

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.loadParcours();
    this.loadMasters();
  }

  initForm() {
    this.parcourForm = this.fb.group({
      master: ['', Validators.required],
      nom: ['', Validators.required],
      type: ['ingenieur'],
      specialite: [''],
      capacite: [30, [Validators.required, Validators.min(1)]],
      date_limite: ['', Validators.required],
      statut: ['brouillon'],
    });
  }

  loadParcours() {
    this.http.get<any[]>(`${environment.apiUrl}/candidatures/parcours/?type=ingenieur`).subscribe({
      next: (data) => {
        this.parcours = data.filter((p) => p.type === 'ingenieur');
      },
      error: (error) => {
        console.error('Erreur chargement parcours ingénieur:', error);
      },
    });
  }

  loadMasters() {
    this.http.get<any[]>(`${environment.apiUrl}/candidatures/masters/`).subscribe({
      next: (data) => {
        this.masters = data;
      },
      error: (error) => {
        console.error('Erreur chargement masters:', error);
      },
    });
  }

  openForm() {
    this.isEditing = false;
    this.editingId = null;
    this.parcourForm.reset({ type: 'ingenieur', statut: 'brouillon', capacite: 30 });
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  editParcours(p: Parcours) {
    this.isEditing = true;
    this.editingId = p.id;
    this.parcourForm.patchValue(p);
    this.showForm = true;
  }

  saveParcours() {
    if (!this.parcourForm.valid) return;

    const data = this.parcourForm.value;
    const url =
      this.isEditing && this.editingId
        ? `${environment.apiUrl}/candidatures/parcours/${this.editingId}/`
        : `${environment.apiUrl}/candidatures/parcours/`;

    const method = this.isEditing ? 'patch' : 'post';

    this.http[method as 'post' | 'patch'](url, data).subscribe({
      next: () => {
        this.loadParcours();
        this.closeForm();
      },
      error: (error) => {
        console.error('Erreur sauvegarde parcours:', error);
      },
    });
  }

  deleteParcours(id: number) {
    if (confirm('Êtes-vous sûr de supprimer ce parcours?')) {
      this.http.delete(`${environment.apiUrl}/candidatures/parcours/${id}/`).subscribe({
        next: () => {
          this.loadParcours();
        },
        error: (error) => {
          console.error('Erreur suppression parcours:', error);
        },
      });
    }
  }

  toggleActionMenu(id: number): void {
    const wasOpen = !!this.actionMenuOpen[id];
    this.actionMenuOpen = {};
    this.actionMenuOpen[id] = !wasOpen;
  }

  isActionMenuOpen(id: number): boolean {
    return !!this.actionMenuOpen[id];
  }

  toggleStatutParcours(p: Parcours): void {
    const nextStatut = p.statut === 'ouvert' ? 'ferme' : 'ouvert';
    this.http
      .patch(`${environment.apiUrl}/candidatures/parcours/${p.id}/`, { statut: nextStatut })
      .subscribe({
        next: () => this.loadParcours(),
        error: (error) => console.error('Erreur changement statut parcours ingénieur:', error),
      });
  }

  getStatutClass(statut: string): string {
    return statut || 'brouillon';
  }
}
