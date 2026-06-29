import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-consulter-dossier',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './consulter-dossier.html',
  styleUrl: './consulter-dossier.css',
})
export class ConsulterDossierComponent implements OnInit {
  isDossierUnlocked: boolean = false;
  verificationPassword: string = '';
  verificationError: string = '';
  documents: any[] = [];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Charger les documents si déjà déverrouillé
  }

  verifyIdentity(): void {
    if (!this.verificationPassword) {
      this.verificationError = 'Mot de passe requis';
      return;
    }

    // TODO: Vérification via API
    this.isDossierUnlocked = true;
    this.verificationError = '';
  }

  hasDocument(type: string): boolean {
    return this.documents.some((doc) => doc.type_document === type);
  }
}
