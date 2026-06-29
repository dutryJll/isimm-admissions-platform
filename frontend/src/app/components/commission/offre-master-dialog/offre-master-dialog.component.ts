import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface OffreMasterDialogData {
  mode: 'create' | 'edit';
  value?: {
    titre: string;
    description: string;
    capacite: number;
    date_limite: string;
    actif: boolean;
  };
}

@Component({
  selector: 'app-offre-master-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.mode === 'create' ? 'Ajouter une offre' : 'Modifier une offre' }}
    </h2>
    <mat-dialog-content>
      <div class="dialog-grid">
        <mat-form-field appearance="outline">
          <mat-label>Titre</mat-label>
          <input matInput [(ngModel)]="form.titre" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="4" [(ngModel)]="form.description"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Capacite</mat-label>
          <input matInput type="number" min="1" [(ngModel)]="form.capacite" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date limite</mat-label>
          <input matInput type="date" [(ngModel)]="form.date_limite" required />
        </mat-form-field>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Annuler</button>
      <button mat-flat-button color="primary" (click)="submit()">Enregistrer</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        min-width: 360px;
      }
    `,
  ],
})
export class OffreMasterDialogComponent {
  form: {
    titre: string;
    description: string;
    capacite: number;
    date_limite: string;
    actif: boolean;
  };

  constructor(
    public dialogRef: MatDialogRef<OffreMasterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OffreMasterDialogData,
  ) {
    this.form = {
      titre: this.data.value?.titre || '',
      description: this.data.value?.description || '',
      capacite: Number(this.data.value?.capacite ?? 30),
      date_limite: this.data.value?.date_limite || '',
      actif: this.data.value?.actif ?? true,
    };
  }

  submit(): void {
    if (!this.form.titre.trim() || !this.form.date_limite || this.form.capacite <= 0) {
      return;
    }
    this.dialogRef.close({ ...this.form, titre: this.form.titre.trim() });
  }
}
