import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SpecialitesService } from '../../../services/specialites.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

interface Document {
  id: number;
  type: string;
  nom: string;
  icon: string;
  depose: boolean;
  date_depot?: string;
  url?: string;
  urlSafe?: SafeResourceUrl;
  nom_fichier?: string;
  taille?: string;
  valide?: boolean | null;
  commentaire?: string;
  nouveauCommentaire?: string;
  verified_by?: string;
  verified_at?: string;
}

@Component({
  selector: 'app-consulter-dossier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulter-dossier.html',
  styleUrl: './consulter-dossier.css',
})
export class ConsulterDossierComponent implements OnInit {
  candidatureId: number = 0;
  candidat: any = null;
  isLoading: boolean = true;
  sourceContext: string = '';
  sourceLabel: string = 'Consultation du dossier';
  pageSummary = {
    statut: 'En attente de validation',
    completude: '75%',
    documents: 4,
    valides: 2,
  };
  commentaireGlobal: string = '';
  documentViewer: any = null;
  // snippet UI state
  showCustomSnippet: boolean = false;
  vis: boolean = true;
  statut: boolean = false;
  toastShow: boolean = false;
  toastMsg: string = '';
  toastClass: string = 't-success';
  // document snippet state
  docStates: { [key: string]: 'valid' | 'rejected' | 'pending' } = {
    d1: 'valid',
    d2: 'valid',
    d3: 'pending',
    d4: 'pending',
    d5: 'valid',
  };
  availableSpecialites: string[] = [];
  selectedSpecialite: string = '';

  documents: Document[] = [
    {
      id: 1,
      type: 'cin',
      nom: "Carte d'identité nationale",
      icon: 'fa-id-card',
      depose: true,
      date_depot: '2026-02-15',
      url: '/assets/docs/sample.pdf',
      nom_fichier: 'CIN_12345678.pdf',
      taille: '1.2 MB',
      valide: true,
      commentaire: 'Document conforme',
      verified_by: 'Dr. Ahmed Gharbi',
      verified_at: '2026-02-16T10:30:00',
    },
    {
      id: 2,
      type: 'releves',
      nom: 'Relevés de notes (L1, L2, L3)',
      icon: 'fa-chart-line',
      depose: true,
      date_depot: '2026-02-15',
      url: '/assets/docs/sample.pdf',
      nom_fichier: 'Releves_Notes.pdf',
      taille: '3.5 MB',
      valide: true,
      verified_by: 'Dr. Ahmed Gharbi',
      verified_at: '2026-02-16T10:35:00',
    },
    {
      id: 3,
      type: 'diplome',
      nom: 'Diplôme de Licence',
      icon: 'fa-graduation-cap',
      depose: true,
      date_depot: '2026-02-16',
      url: '/assets/docs/sample.pdf',
      nom_fichier: 'Diplome_Licence.pdf',
      taille: '2.1 MB',
      valide: null,
      nouveauCommentaire: '',
    },
    {
      id: 4,
      type: 'photo',
      nom: "Photo d'identité",
      icon: 'fa-camera',
      depose: true,
      date_depot: '2026-02-15',
      url: '/assets/images/photo-sample.jpg',
      nom_fichier: 'Photo_ID.jpg',
      taille: '250 KB',
      valide: null,
      nouveauCommentaire: '',
    },
    {
      id: 5,
      type: 'generated-summary',
      nom: 'Document de synthèse depuis la liste générée',
      icon: 'fa-layer-group',
      depose: true,
      date_depot: '2026-04-16',
      url: '/assets/docs/sample.pdf',
      nom_fichier: 'liste-generation-2.pdf',
      taille: '180 KB',
      valide: true,
      commentaire: 'Document généré automatiquement depuis la liste de sélection.',
      verified_by: 'Système commission',
      verified_at: '2026-04-16T09:15:00',
    },
  ];

  historique = [
    {
      action: 'Dossier soumis',
      details: 'Le candidat a soumis son dossier complet',
      auteur: 'Système',
      date: '2026-02-15T10:30:00',
      icon: 'fa-upload',
      type: 'info',
    },
    {
      action: 'CIN validé',
      details: 'Document validé par Dr. Ahmed Gharbi',
      auteur: 'Dr. Ahmed Gharbi',
      date: '2026-02-16T10:30:00',
      icon: 'fa-check',
      type: 'success',
    },
    {
      action: 'Relevés validés',
      details: 'Documents validés après vérification',
      auteur: 'Dr. Ahmed Gharbi',
      date: '2026-02-16T10:35:00',
      icon: 'fa-check',
      type: 'success',
    },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private specialitesService: SpecialitesService,
  ) {}

  ngOnInit(): void {
    this.candidatureId = Number(this.route.snapshot.paramMap.get('id'));
    this.sourceContext = this.route.snapshot.queryParamMap.get('source') || '';
    const reclamationParam = this.route.snapshot.queryParamMap.get('reclamation');
    if (this.sourceContext === 'reclamations' && reclamationParam) {
      this.showCustomSnippet = true;
    }
    this.sourceLabel =
      this.sourceContext === 'liste-generation'
        ? 'Ouvert depuis une liste générée'
        : 'Consultation du dossier';
    if (this.sourceContext === 'liste-generation') {
      this.pageSummary = {
        statut: 'Dossier issu de la liste générée',
        completude: '80%',
        documents: this.documents.length,
        valides: this.documents.filter((doc) => doc.valide === true).length,
      };
    }
    this.loadCandidature();
    this.specialitesService.getSpecialitesData().subscribe(() => {
      this.availableSpecialites = this.specialitesService.getAllSpecialties();
    });
  }

  /* Integration helpers for embedded HTML snippet */
  sendPrompt(msg: string): void {
    console.log('sendPrompt:', msg);
    this.showToast(`Action déclenchée: ${msg}`, 't-info');
  }

  toggleVis(): void {
    this.vis = !this.vis;
    this.showToast(
      this.vis
        ? 'Offre visible pour les candidats'
        : 'Offre masquée — candidats ne voient plus la carte',
      this.vis ? 't-success' : 't-warn',
    );
  }

  toggleStatut(): void {
    this.statut = !this.statut;
    this.showToast(
      this.statut ? 'Offre ouverte — postuler activé' : 'Offre fermée — postuler désactivé',
      this.statut ? 't-success' : 't-warn',
    );
  }

  showToast(msg: string, cls: string = 't-success') {
    this.toastMsg = msg;
    this.toastClass = cls || 't-success';
    this.toastShow = true;
    setTimeout(() => (this.toastShow = false), 3200);
  }

  /* Methods ported from the user snippet JS to TS */
  toggleDoc(id: string): void {
    const body = document.getElementById('b-' + id);
    const ch = document.getElementById('ch-' + id);
    const open = body?.classList.contains('open');
    document.querySelectorAll('.doc-body').forEach((b) => b.classList.remove('open'));
    document.querySelectorAll('.doc-chevron').forEach((c) => c.classList.remove('open'));
    if (!open) {
      body?.classList.add('open');
      ch?.classList.add('open');
    }
  }

  validerDoc(id: string, valid: boolean): void {
    this.docStates[id] = valid ? 'valid' : 'rejected';
    const item = document.getElementById(id);
    if (item) item.className = 'doc-item ' + (valid ? 's-valid' : 's-rejected');
    const sb = document.getElementById('sb-' + id);
    if (sb) {
      sb.className = 'status-badge ' + (valid ? 'sb-v' : 'sb-r');
      sb.textContent = valid ? 'Validé' : 'Rejeté';
    }
    this.updateProgress();
    this.addToTimeline(id, valid);
    this.showToast(valid ? 'Document validé' : 'Document rejeté', valid ? 't-success' : 't-danger');
    document.getElementById('b-' + id)?.classList.remove('open');
    document.getElementById('ch-' + id)?.classList.remove('open');
  }

  updateProgress(): void {
    let v = 0;
    let r = 0;
    let p = 0;
    const total = Object.keys(this.docStates).length;
    Object.values(this.docStates).forEach((s) => {
      if (s === 'valid') v++;
      else if (s === 'rejected') r++;
      else p++;
    });
    const pct = Math.round((v / total) * 100);
    const pctEl = document.getElementById('pct');
    const pbar = document.getElementById('pbar');
    const kv = document.getElementById('k-v');
    const kr = document.getElementById('k-r');
    const kp = document.getElementById('k-p');
    if (pctEl) pctEl.textContent = pct + '%';
    if (pbar) (pbar as HTMLElement).style.width = pct + '%';
    if (kv) kv.textContent = String(v);
    if (kr) kr.textContent = String(r);
    if (kp) kp.textContent = String(p);
    const dn = document.getElementById('decision-note');
    if (dn) {
      dn.textContent =
        p > 0
          ? r > 0
            ? 'Certains documents ont été rejetés. La décision finale est disponible.'
            : 'Des documents manquent, décision en attente.'
          : r > 0
            ? 'Certains documents ont été rejetés. La décision finale est disponible.'
            : 'Tous les documents sont validés. Vous pouvez prendre une décision.';
    }
  }

  addToTimeline(docId: string, valid: boolean): void {
    const docNames: any = {
      d1: 'CIN',
      d2: 'Relevés de notes',
      d3: 'Diplôme Licence',
      d4: 'Photo identité',
      d5: 'Document synthèse',
    };
    const tl = document.getElementById('timeline');
    if (!tl) return;
    const div = document.createElement('div');
    div.className = 'tl-item';
    const now = new Date();
    const t =
      now.toLocaleDateString('fr-FR') +
      ' — ' +
      now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dotClass = valid ? 'td-green' : 'td-gray';
    const icon = valid
      ? '<path d="M2 6l3 3 5-5"/>'
      : '<line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>';
    div.innerHTML =
      '<div class="tl-dot ' +
      dotClass +
      '"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">' +
      icon +
      '</svg></div>' +
      '<div class="tl-content"><div class="tl-title">' +
      (docNames[docId] || docId) +
      ' ' +
      (valid ? 'validé' : 'rejeté') +
      '</div>' +
      '<div class="tl-sub">' +
      (valid ? 'Document conforme' : 'Rejeté par la commission') +
      '</div>' +
      '<div class="tl-time">' +
      t +
      ' · Vous</div></div>';
    tl.appendChild(div);
    const histCountEl = document.getElementById('tc-hist');
    if (histCountEl) histCountEl.textContent = String(tl.querySelectorAll('.tl-item').length);
  }

  priseDecision(type: 'approve' | 'reject' | 'hold'): void {
    const map: any = {
      approve: ['Dossier validé — décision finale enregistrée', 't-success', 'dr-success'],
      reject: ['Dossier rejeté — notification envoyée au candidat', 't-danger', 'dr-danger'],
      hold: ['Dossier mis en attente', 't-warn', 'dr-warn'],
    };
    const d = map[type];
    const dr = document.getElementById('decision-result');
    if (dr) {
      dr.className = 'decision-result show ' + d[2];
      const icons: any = {
        approve:
          '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6l3 3 5-5"/></svg>',
        reject:
          '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>',
        hold: '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="2" x2="4" y2="10"/><line x1="8" y1="2" x2="8" y2="10"/></svg>',
      };
      const labels: any = {
        approve: 'Dossier validé',
        reject: 'Dossier rejeté',
        hold: 'En attente',
      };
      dr.innerHTML =
        icons[type] +
        '<span>' +
        labels[type] +
        ' — ' +
        new Date().toLocaleDateString('fr-FR') +
        '</span>';
    }
    this.addToTimeline('final-' + type, type === 'approve');
    this.showToast(d[0], d[1]);
  }

  switchTab(name: string, btn: any): void {
    const buttonEl =
      btn && btn.classList && btn.classList.contains('tab-btn')
        ? btn
        : btn && btn.closest
          ? btn.closest('.tab-btn')
          : null;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    if (buttonEl) (buttonEl as HTMLElement).classList.add('active');
    const panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
  }

  loadCandidature(): void {
    // Simuler un chargement
    setTimeout(() => {
      this.candidat = {
        first_name: 'Ahmed',
        last_name: 'Ben Ali',
        cin: '12345678',
        email: 'ahmed.benali@example.com',
        telephone: '+216 98 765 432',
        date_naissance: '2000-03-15',
        adresse: '15 Avenue Habib Bourguiba',
        ville: 'Monastir',
        code_postal: '5000',
        type_candidature: 'master',
        voeux: ['Master Génie Logiciel', 'Master Data Science', 'Master Microélectronique'],
        score: 17.5,
        statut_dossier: 'en_attente',
        date_soumission: '2026-02-15T10:30:00',
        source: this.sourceContext || 'commission-dashboard',
      };
      this.isLoading = false;
    }, 1000);
  }

  get documentsValides(): number {
    return this.documents.filter((d) => d.valide === true).length;
  }

  get documentsRejetes(): number {
    return this.documents.filter((d) => d.valide === false).length;
  }

  get documentsEnAttente(): number {
    return this.documents.filter((d) => d.depose && d.valide === null).length;
  }

  get completionPercent(): number {
    if (!this.documents.length) {
      return 0;
    }
    return Math.round((this.documentsValides / this.documents.length) * 100);
  }

  get candidatureScore(): string {
    if (this.candidat?.score === null || this.candidat?.score === undefined) {
      return '--';
    }
    return Number(this.candidat.score).toFixed(2);
  }

  get scoreMention(): string {
    const score = Number(this.candidat?.score ?? 0);
    if (score >= 16) {
      return 'Excellent';
    }
    if (score >= 14) {
      return 'Très bon';
    }
    if (score >= 12) {
      return 'Bon niveau';
    }
    return 'À renforcer';
  }

  getStatutClass(statut: string): string {
    const classes: any = {
      valide: 'success',
      invalide: 'danger',
      en_attente: 'warning',
    };
    return classes[statut] || 'secondary';
  }

  getStatutLabel(statut: string): string {
    const labels: any = {
      valide: 'Dossier validé',
      invalide: 'Dossier invalidé',
      en_attente: 'En attente de validation',
    };
    return labels[statut] || statut;
  }

  voirDocument(doc: Document): void {
    this.documentViewer = {
      ...doc,
      urlSafe: this.sanitizer.bypassSecurityTrustResourceUrl(doc.url || ''),
    };
  }

  fermerViewer(): void {
    this.documentViewer = null;
  }

  telechargerDocument(doc: Document): void {
    console.log('📥 Téléchargement:', doc.nom);
    // Implémenter le téléchargement
  }

  imprimerDocument(): void {
    window.print();
  }

  validerDocument(doc: Document): void {
    doc.valide = true;
    doc.verified_by = 'Dr. Ahmed Gharbi'; // Utiliser l'utilisateur connecté
    doc.verified_at = new Date().toISOString();

    if (doc.nouveauCommentaire) {
      doc.commentaire = doc.nouveauCommentaire;
    }

    console.log('✅ Document validé:', doc.nom);

    // Ajouter à l'historique
    this.historique.unshift({
      action: `${doc.nom} validé`,
      details: doc.commentaire || 'Document validé',
      auteur: 'Dr. Ahmed Gharbi',
      date: new Date().toISOString(),
      icon: 'fa-check',
      type: 'success',
    });
  }

  rejeterDocument(doc: Document): void {
    if (!doc.nouveauCommentaire) {
      alert('Veuillez ajouter un commentaire pour justifier le rejet');
      return;
    }

    doc.valide = false;
    doc.commentaire = doc.nouveauCommentaire;
    doc.verified_by = 'Dr. Ahmed Gharbi';
    doc.verified_at = new Date().toISOString();

    console.log('❌ Document rejeté:', doc.nom);

    // Ajouter à l'historique
    this.historique.unshift({
      action: `${doc.nom} rejeté`,
      details: doc.commentaire,
      auteur: 'Dr. Ahmed Gharbi',
      date: new Date().toISOString(),
      icon: 'fa-times',
      type: 'danger',
    });
  }

  validerDossier(): void {
    if (this.documentsValides !== this.documents.length) {
      alert('Tous les documents doivent être validés avant de valider le dossier');
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir valider ce dossier ?')) {
      console.log('✅ Dossier validé:', this.commentaireGlobal);
      alert('Dossier validé avec succès !');
      this.retour();
    }
  }

  invaliderDossier(): void {
    if (!this.commentaireGlobal) {
      alert("Veuillez ajouter un commentaire pour justifier l'invalidation");
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir invalider ce dossier ?')) {
      console.log('❌ Dossier invalidé:', this.commentaireGlobal);
      alert('Dossier invalidé');
      this.retour();
    }
  }

  mettreEnAttente(): void {
    console.log('⏸️ Dossier mis en attente:', this.commentaireGlobal);
    alert('Dossier mis en attente');
  }

  retour(): void {
    this.router.navigate(['/commission/dashboard'], {
      queryParams: { view: 'listes' },
    });
  }
}
