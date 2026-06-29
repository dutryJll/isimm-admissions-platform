import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Parcours {
  id: number;
  nom: string;
  master_nom: string;
  type_display: string;
  specialite: string;
  capacite: number;
  statut_display: string;
}

interface ValeurCritere {
  id: number;
  parcours: number;
  critere: number;
  critere_code: string;
  critere_label: string;
  coefficient: number;
}

@Component({
  selector: 'app-responsable-parcours',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="responsable-parcours">
      <h2>Gestion des Parcours - Espace Responsable</h2>

      <div class="parcours-tabs">
        <div class="tab-nav">
          <button [class.active]="selectedTab === 'ouvert'" (click)="selectedTab = 'ouvert'">
            Parcours Ouverts
          </button>
          <button [class.active]="selectedTab === 'brouillon'" (click)="selectedTab = 'brouillon'">
            Brouillons
          </button>
          <button [class.active]="selectedTab === 'ferme'" (click)="selectedTab = 'ferme'">
            Fermés
          </button>
        </div>

        <!-- Parcours Ouverts -->
        <div class="tab-content" *ngIf="selectedTab === 'ouvert'">
          <h3>Parcours Ouverts aux Candidatures</h3>
          <div class="parcours-grid" *ngIf="filteredParcours('ouvert').length > 0">
            <div class="parcours-card" *ngFor="let p of filteredParcours('ouvert')">
              <h4>{{ p.nom }}</h4>
              <p><strong>Master:</strong> {{ p.master_nom }}</p>
              <p><strong>Type:</strong> {{ p.type_display }}</p>
              <p><strong>Capacité:</strong> {{ p.capacite }}</p>
              <button class="btn btn-primary" (click)="showCoefficients(p.id)">
                Voir Coefficients
              </button>
            </div>
          </div>
          <p *ngIf="filteredParcours('ouvert').length === 0" class="text-muted">
            Aucun parcours ouvert
          </p>
        </div>

        <!-- Parcours Brouillons -->
        <div class="tab-content" *ngIf="selectedTab === 'brouillon'">
          <h3>Parcours en Brouillon</h3>
          <div class="parcours-grid" *ngIf="filteredParcours('brouillon').length > 0">
            <div class="parcours-card" *ngFor="let p of filteredParcours('brouillon')">
              <h4>{{ p.nom }}</h4>
              <p><strong>Master:</strong> {{ p.master_nom }}</p>
              <p><strong>Type:</strong> {{ p.type_display }}</p>
              <p><strong>Capacité:</strong> {{ p.capacite }}</p>
              <button class="btn btn-warning" (click)="editCriteres(p.id)">
                Configurer Coefficients
              </button>
            </div>
          </div>
          <p *ngIf="filteredParcours('brouillon').length === 0" class="text-muted">
            Aucun brouillon
          </p>
        </div>

        <!-- Parcours Fermés -->
        <div class="tab-content" *ngIf="selectedTab === 'ferme'">
          <h3>Parcours Fermés</h3>
          <div class="parcours-grid" *ngIf="filteredParcours('ferme').length > 0">
            <div class="parcours-card" *ngFor="let p of filteredParcours('ferme')">
              <h4>{{ p.nom }}</h4>
              <p><strong>Master:</strong> {{ p.master_nom }}</p>
              <p><strong>Type:</strong> {{ p.type_display }}</p>
            </div>
          </div>
          <p *ngIf="filteredParcours('ferme').length === 0" class="text-muted">
            Aucun parcours fermé
          </p>
        </div>
      </div>

      <!-- Modal Coefficients -->
      <div class="modal" *ngIf="showCoeffModal">
        <div class="modal-content modal-lg">
          <span class="close" (click)="closeCoeffModal()">&times;</span>
          <h3>Coefficients - {{ selectedParcoursNom }}</h3>

          <div *ngIf="criteres && criteres.length > 0" class="coefficients-table">
            <table class="table">
              <thead>
                <tr>
                  <th>Critère</th>
                  <th>Description</th>
                  <th>Coefficient</th>
                  <th *ngIf="isEditing">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of criteres">
                  <td>{{ c.critere_label }}</td>
                  <td>{{ c.critere_code }}</td>
                  <td>
                    <span *ngIf="!isEditing">{{ c.coefficient }}</span>
                    <input
                      *ngIf="isEditing"
                      type="number"
                      step="0.01"
                      [(ngModel)]="c.coefficient"
                      class="form-control"
                    />
                  </td>
                  <td *ngIf="isEditing">
                    <button class="btn btn-sm btn-info" (click)="saveCoefficent(c)">
                      Sauvegarder
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div class="modal-actions">
              <button *ngIf="!isEditing" class="btn btn-warning" (click)="isEditing = true">
                Éditer Coefficients
              </button>
              <button *ngIf="isEditing" class="btn btn-secondary" (click)="isEditing = false">
                Terminer Édition
              </button>
            </div>
          </div>
          <p *ngIf="!criteres || criteres.length === 0" class="text-muted">
            Aucun critère configuré
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .responsable-parcours {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .tab-nav {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        border-bottom: 2px solid #ddd;
      }
      .tab-nav button {
        padding: 12px 20px;
        background: none;
        border: none;
        cursor: pointer;
        font-weight: bold;
        color: #666;
      }
      .tab-nav button.active {
        color: #007bff;
        border-bottom: 3px solid #007bff;
      }
      .parcours-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
      }
      .parcours-card {
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: #f9f9f9;
      }
      .parcours-card h4 {
        margin-top: 0;
        color: #333;
      }
      .parcours-card p {
        margin: 8px 0;
        font-size: 14px;
      }
      .btn {
        padding: 8px 12px;
        border: none;
        cursor: pointer;
        border-radius: 4px;
        font-weight: bold;
      }
      .btn-primary {
        background-color: #007bff;
        color: white;
      }
      .btn-warning {
        background-color: #ffc107;
        color: black;
      }
      .btn-secondary {
        background-color: #6c757d;
        color: white;
      }
      .btn-info {
        background-color: #17a2b8;
        color: white;
      }
      .btn:hover {
        opacity: 0.9;
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
        margin: 5% auto;
        padding: 20px;
        border: 1px solid #888;
        border-radius: 8px;
        width: 90%;
        max-width: 800px;
      }
      .modal-lg {
        width: 90%;
        max-width: 900px;
      }
      .close {
        color: #aaa;
        float: right;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
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
      .form-control {
        width: 100%;
        padding: 6px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .modal-actions {
        margin-top: 20px;
        text-align: right;
      }
      .text-muted {
        color: #999;
        font-style: italic;
      }
    `,
  ],
})
export class ResponsableParcoursComponent implements OnInit {
  parcours: Parcours[] = [];
  criteres: ValeurCritere[] = [];
  selectedTab = 'ouvert';
  selectedParcoursId: number | null = null;
  selectedParcoursNom = '';
  showCoeffModal = false;
  isEditing = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadParcours();
  }

  loadParcours() {
    this.http.get<any[]>(`${environment.apiUrl}/candidatures/parcours/`).subscribe({
      next: (data) => {
        this.parcours = data;
      },
      error: (error) => {
        console.error('Erreur chargement parcours responsable:', error);
      },
    });
  }

  filteredParcours(statut: string): Parcours[] {
    return this.parcours.filter((p) => p.statut_display?.toLowerCase().includes(statut));
  }

  showCoefficients(parcoursId: number) {
    const parcours = this.parcours.find((p) => p.id === parcoursId);
    if (parcours) {
      this.selectedParcoursId = parcoursId;
      this.selectedParcoursNom = parcours.nom;
      this.loadCriteres(parcoursId);
      this.showCoeffModal = true;
      this.isEditing = false;
    }
  }

  editCriteres(parcoursId: number) {
    this.showCoefficients(parcoursId);
    this.isEditing = true;
  }

  loadCriteres(parcoursId: number) {
    this.http
      .get<any[]>(`${environment.apiUrl}/candidatures/parcours/${parcoursId}/valeurs/`)
      .subscribe({
        next: (data) => {
          this.criteres = data;
        },
        error: (error) => {
          console.error('Erreur chargement critères:', error);
        },
      });
  }

  saveCoefficent(critere: ValeurCritere) {
    this.http
      .patch(`${environment.apiUrl}/candidatures/valeurs-critere/${critere.id}/`, {
        coefficient: critere.coefficient,
      })
      .subscribe({
        next: () => {
          alert('Coefficient sauvegardé');
        },
        error: (error) => {
          console.error('Erreur sauvegarde coefficient:', error);
        },
      });
  }

  closeCoeffModal() {
    this.showCoeffModal = false;
    this.selectedParcoursId = null;
    this.isEditing = false;
  }
}
