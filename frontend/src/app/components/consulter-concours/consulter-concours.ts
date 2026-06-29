import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-consulter-concours',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consulter-concours.html',
  styleUrl: './consulter-concours.css',
})
export class ConsulterConcoursComponent implements OnInit {
  concoursIngenieurs: any[] = [];
  loading: boolean = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.chargerConcours();
  }

  chargerConcours(): void {
    this.http.get(`${environment.concoursServiceUrl}/`).subscribe({
      next: (data: any) => {
        this.concoursIngenieurs = data.filter((c: any) => c.type_concours === 'ingenieur');
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur:', error);
        this.loading = false;
      },
    });
  }

  candidaterConcours(concours: any): void {
    alert(`Candidater pour: ${concours.nom}`);
  }
}
