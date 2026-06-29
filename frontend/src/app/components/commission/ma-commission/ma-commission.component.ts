import { Component, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommissionService } from '../../../services/commission';
import { CandidatureService } from '../../../services/candidature.service';

@Component({
  selector: 'app-ma-commission',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ma-commission.html',
  styleUrls: ['./ma-commission.css'],
})
export class MaCommissionComponent implements OnInit, AfterViewInit {
  commissionOptions: Array<{ id: number; nom: string; description?: string; actif?: boolean }> = [];
  selectedCommissionId: number | null = null;
  private readonly activeCommissionStorageKey = 'active_commission_id';

  constructor(
    private candidatureService: CandidatureService,
    private commissionService: CommissionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const storedId = localStorage.getItem(this.activeCommissionStorageKey);
    this.selectedCommissionId =
      storedId && !Number.isNaN(Number(storedId)) ? Number(storedId) : null;
    this.loadMyCommissions();
  }

  ngAfterViewInit(): void {
    // Expose data and functions on window so the legacy inline handlers in the
    // provided HTML keep working without deep template refactor.
    const w = window as any;

    w.membres = [];

    w.candidats = [
      { num: '2603-00001-GL', nom: 'Fatma Gharbi' },
      { num: '2603-00002-DS', nom: 'Ahmed Ben Ali' },
      { num: '2603-00003-GL', nom: 'Sana Trabelsi' },
      { num: '2603-00004-DS', nom: 'Youssef Mahjoub' },
      { num: '2603-00005-RI', nom: 'Nour Khelif' },
      { num: '2603-00006-DS', nom: 'Mariem Zouari' },
    ];

    // Minimal bridge functions used by the HTML. They operate on DOM ids present
    // in the template. We intentionally keep logic here as the original script
    // to avoid template refactor and prevent Angular template parsing issues.
    w.selected = new Set();
    w.filtered = [];
    w.assignMap = {};
    w.selectedCommissionId = this.selectedCommissionId;
    w.commissionOptions = this.commissionOptions;

    w.getInitials = function (m: any) {
      return (m.prenom[0] + m.nom[0]).toUpperCase();
    };

    w.progClass = function (pct: number) {
      if (pct >= 80) return 'pf-high';
      if (pct >= 40) return 'pf-med';
      if (pct > 0) return 'pf-low';
      return 'pf-zero';
    };

    // Render table (simple DOM injection copied from provided script)
    w.renderTable = function () {
      try {
        const searchEl = document.getElementById('f-search') as HTMLInputElement;
        const statutEl = document.getElementById('f-statut') as HTMLSelectElement;
        const search = searchEl ? searchEl.value.toLowerCase() : '';
        const fs = statutEl ? statutEl.value : '';
        const activeCommissionId = w.selectedCommissionId || null;
        w.filtered = w.membres.filter(function (m: any) {
          return (
            (!search ||
              m.prenom.toLowerCase().includes(search) ||
              m.nom.toLowerCase().includes(search) ||
              m.email.toLowerCase().includes(search) ||
              m.spec.toLowerCase().includes(search)) &&
            (!fs || m.statut === fs) &&
            (!activeCommissionId || m.commissionId === activeCommissionId)
          );
        });
        const tb = document.getElementById('table-body');
        if (!tb) return;
        tb.innerHTML = '';
        w.filtered.forEach(function (m: any) {
          const pct = m.assigns > 0 ? Math.round((m.traites / m.assigns) * 100) : 0;
          const chk = w.selected.has(m.id);
          const tr = document.createElement('tr');
          if (chk) tr.className = 'selected';
          const notifMsg = 'Notification envoyée à ' + m.prenom + ' ' + m.nom;
          tr.innerHTML =
            '<td><input type="checkbox" ' +
            (chk ? 'checked' : '') +
            ' onchange="toggleRow(' +
            m.id +
            ',this.checked)" style="cursor:pointer"></td>' +
            '<td><div class="member-cell"><div class="avatar" style="background:' +
            m.avatarBg +
            ';color:' +
            m.avatarColor +
            '">' +
            w.getInitials(m) +
            '</div><div><div class="member-name">' +
            m.prenom +
            ' ' +
            m.nom +
            '</div><div class="member-email">' +
            m.email +
            '</div></div></div></td>' +
            '<td style="color:var(--color-text-secondary)">' +
            m.spec +
            '</td>' +
            '<td style="text-align:center;font-weight:500">' +
            m.assigns +
            '</td>' +
            '<td><div class="prog-wrap"><div class="prog-bar"><div class="prog-fill ' +
            w.progClass(pct) +
            '" style="width:' +
            pct +
            '%"></div></div><div class="prog-val">' +
            m.traites +
            '/' +
            m.assigns +
            ' <span style="color:var(--color-text-secondary);font-weight:400">(' +
            pct +
            '%)</span></div></div></td>' +
            '<td style="text-align:center;font-weight:500;color:#534AB7">' +
            m.avis +
            '</td>' +
            '<td><span class="badge ' +
            (m.statut === 'actif' ? 'b-active' : 'b-inactive') +
            '">' +
            m.statut +
            '</span></td>' +
            '<td style="font-size:11px;color:var(--color-text-secondary)">' +
            m.lastActivity +
            '</td>' +
            '<td><div class="action-cell">' +
            '<button class="icon-btn blue" title="Voir détail" onclick="openDetail(' +
            m.id +
            ')"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><ellipse cx="6" cy="6" rx="5" ry="3.5"></ellipse><circle cx="6" cy="6" r="1.5"></circle></svg></button>' +
            '<button class="icon-btn teal" title="Assigner dossiers" onclick="openAssign(' +
            m.id +
            ')"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="5" r="2.5"></circle><path d="M1 10c0-2.5 2-4 5-4"></path><line x1="8" y1="2" x2="12" y2="2"></line><line x1="10" y1="0" x2="10" y2="4"></line></svg></button>' +
            '<button class="icon-btn purple" title="Envoyer notification" onclick="showToast(' +
            "'" +
            notifMsg +
            "'" +
            ',' +
            "'" +
            't-info' +
            "'" +
            ')"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 3h10v7H1z"></path><path d="M1 3l5 4 5-4"></path></svg></button>' +
            '<button class="icon-btn danger" title="Retirer de la commission" onclick="retirerMembre(' +
            m.id +
            ')"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 3h8M5 3V2h2v1M4 3v6h4V3"></path></svg></button>' +
            '</div></td>';
          tb.appendChild(tr);
        });
        const countLbl = document.getElementById('count-lbl');
        if (countLbl) countLbl.textContent = '(' + w.filtered.length + ')';
        const pagInfo = document.getElementById('pag-info');
        if (pagInfo)
          pagInfo.textContent = 'Affichage 1–' + w.filtered.length + ' sur ' + w.filtered.length;
        const checkAll = document.getElementById('check-all') as HTMLInputElement;
        if (checkAll)
          checkAll.checked =
            w.filtered.length > 0 &&
            w.filtered.every(function (m: any) {
              return w.selected.has(m.id);
            });
      } catch (e) {
        console.error('MaCommission renderTable error', e);
      }
    };

    w.toggleRow = function (id: number, chk: boolean) {
      if (chk) w.selected.add(id);
      else w.selected.delete(id);
      w.renderTable();
    };
    w.toggleAll = function (chk: boolean) {
      w.filtered.forEach(function (m: any) {
        if (chk) w.selected.add(m.id);
        else w.selected.delete(m.id);
      });
      w.renderTable();
    };
    w.filterTable = function () {
      w.renderTable();
    };
    w.resetFilters = function () {
      const s = document.getElementById('f-search') as HTMLInputElement;
      const st = document.getElementById('f-statut') as HTMLSelectElement;
      if (s) s.value = '';
      if (st) st.value = '';
      w.renderTable();
    };

    w.changeCommission = function (value: string | number) {
      const parsed = value === '' || value === null || value === undefined ? null : Number(value);
      w.selectedCommissionId = Number.isFinite(parsed as number) ? parsed : null;
      if (w.selectedCommissionId) {
        localStorage.setItem('active_commission_id', String(w.selectedCommissionId));
      } else {
        localStorage.removeItem('active_commission_id');
      }
      w.renderTable();
      w.showToast('Commission active mise à jour', 't-info');
    }.bind(this);

    w.retirerMembre = function (id: number) {
      const m = w.membres.find(function (x: any) {
        return x.id === id;
      });
      if (m) m.statut = 'inactif';
      w.renderTable();
      w.showToast('Membre retiré de la commission active', 't-warn');
    };

    w.openAssign = function (targetId?: number) {
      const al = document.getElementById('assign-list');
      if (!al) return;
      al.innerHTML = '';
      w.candidats.forEach(function (c: any) {
        const div = document.createElement('div');
        div.className = 'cand-assign-row';
        div.innerHTML =
          '<div class="cand-num">' +
          c.num +
          '</div>' +
          '<div class="cand-name">' +
          c.nom +
          '</div>' +
          '<select class="member-select" id="sel-' +
          c.num +
          '" onchange="updateLoad()"><option value="">— Choisir —</option>' +
          w.membres
            .filter(function (m: any) {
              return m.statut === 'actif';
            })
            .map(function (m: any) {
              var sel = targetId && m.id === targetId ? 'selected' : '';
              return (
                '<option value="' + m.id + '" ' + sel + '>' + m.prenom + ' ' + m.nom + '</option>'
              );
            })
            .join('') +
          '</select>';
        al.appendChild(div);
      });
      if (typeof w.updateLoad === 'function') w.updateLoad();
      const modal = document.getElementById('modal-assign');
      if (modal) modal.className = 'modal-wrap open';
    };

    w.updateLoad = function () {
      const counts: any = {};
      w.membres.forEach(function (m: any) {
        counts[m.id] = 0;
      });
      w.candidats.forEach(function (c: any) {
        const sel = document.getElementById('sel-' + c.num) as HTMLSelectElement;
        if (sel && sel.value) counts[parseInt(sel.value)] = (counts[parseInt(sel.value)] || 0) + 1;
      });
      let html = '';
      w.membres
        .filter(function (m: any) {
          return m.statut === 'actif';
        })
        .forEach(function (m: any) {
          html +=
            m.prenom +
            ' ' +
            m.nom +
            ' : <strong>' +
            (counts[m.id] || 0) +
            '</strong> dossier' +
            ((counts[m.id] || 0) > 1 ? 's' : '') +
            '<br>';
        });
      const loadSummary = document.getElementById('load-summary');
      if (loadSummary) loadSummary.innerHTML = html || 'Aucune assignation';
    };

    w.autoAssign = function () {
      const actifs = w.membres.filter(function (m: any) {
        return m.statut === 'actif';
      });
      w.candidats.forEach(function (c: any, i: number) {
        const m = actifs[i % actifs.length];
        const sel = document.getElementById('sel-' + c.num) as HTMLSelectElement;
        if (sel) sel.value = m.id;
      });
      w.updateLoad();
      w.showToast('Répartition automatique appliquée (équitable)', 't-info');
    };

    w.clearAssign = function () {
      w.candidats.forEach(function (c: any) {
        const sel = document.getElementById('sel-' + c.num) as HTMLSelectElement;
        if (sel) sel.value = '';
      });
      w.updateLoad();
    };

    w.saveAssign = function () {
      w.membres.forEach(function (m: any) {
        const count = w.candidats.filter(function (c: any) {
          const sel = document.getElementById('sel-' + c.num) as HTMLSelectElement;
          return sel && parseInt(sel.value) === m.id;
        }).length;
        if (count > 0) {
          m.assigns += count;
          m.statut = 'actif';
        }
      });
      const modal = document.getElementById('modal-assign');
      if (modal) modal.className = 'modal-wrap';
      w.renderTable();
      w.showToast('Dossiers assignés — notifications envoyées aux membres', 't-success');
    };

    w.openDetail = function (id: number) {
      const m = w.membres.find(function (x: any) {
        return x.id === id;
      });
      if (!m) return;
      const pct = m.assigns > 0 ? Math.round((m.traites / m.assigns) * 100) : 0;
      const title = document.getElementById('detail-title');
      if (title) title.textContent = m.prenom + ' ' + m.nom;
      const sub = document.getElementById('detail-sub');
      if (sub) sub.textContent = m.email + ' · ' + m.spec;
      const body = document.getElementById('detail-body');
      if (body) {
        body.innerHTML = '';
        body.innerHTML =
          '<div class="detail-grid" style="margin-bottom:.65rem">' +
          '<div class="det-cell"><div class="det-lbl">Spécialité</div><div class="det-val">' +
          m.spec +
          '</div></div>' +
          '<div class="det-cell"><div class="det-lbl">Statut</div><div class="det-val"><span class="badge ' +
          (m.statut === 'actif' ? 'b-active' : 'b-inactive') +
          '">' +
          m.statut +
          '</span></div></div>' +
          '<div class="det-cell"><div class="det-lbl">Dossiers assignés</div><div class="det-val">' +
          m.assigns +
          '</div></div>' +
          '<div class="det-cell"><div class="det-lbl">Dossiers traités</div><div class="det-val">' +
          m.traites +
          ' (' +
          pct +
          '%)</div></div>' +
          '<div class="det-cell" style="grid-column:1/-1"><div class="det-lbl">Progression</div>' +
          '<div style="margin-top:.35rem"><div style="height:8px;background:var(--color-border-tertiary);border-radius:4px;overflow:hidden"><div style="height:100%;background:#185FA5;border-radius:4px;width:' +
          pct +
          '%"></div></div></div>' +
          '</div>' +
          '<div class="det-cell"><div class="det-lbl">Avis donnés</div><div class="det-val" style="color:#534AB7">' +
          m.avis +
          '</div></div>' +
          '<div class="det-cell"><div class="det-lbl">Dernière activité</div><div class="det-val" style="font-size:11px">' +
          m.lastActivity +
          '</div></div>' +
          '</div>';
        body.innerHTML +=
          '<div style="font-size:11px;font-weight:500;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Derniers avis donnés</div>' +
          '<div style="display:flex;flex-direction:column;gap:.35rem">' +
          '<div class="avis-item"><div class="avis-dot ad-fav"></div><div><div class="avis-cand">Fatma Gharbi</div><div class="avis-sub">Favorable · Dossier complet</div></div></div>' +
          (m.avis >= 2
            ? '<div class="avis-item"><div class="avis-dot ad-res"></div><div><div class="avis-cand">Ahmed Ben Ali</div><div class="avis-sub">Réservé · Manque expérience projet</div></div></div>'
            : '') +
          (m.avis >= 3
            ? '<div class="avis-item"><div class="avis-dot ad-fav"></div><div><div class="avis-cand">Sana Trabelsi</div><div class="avis-sub">Favorable · Excellent parcours</div></div></div>'
            : '') +
          '</div>';
      }
      const modal = document.getElementById('modal-detail');
      if (modal) modal.className = 'modal-wrap open';
    };

    w.closeModal = function (id: string) {
      const modal = document.getElementById(id);
      if (modal) modal.className = 'modal-wrap';
    };

    w.showToast = function (msg: string, cls?: string) {
      const t = document.getElementById('toast');
      if (!t) return;
      const txt = document.getElementById('toast-txt');
      if (txt) txt.textContent = msg;
      t.className = 'toast show ' + (cls || 't-success');
      setTimeout(function () {
        t.className = 'toast';
      }, 3200);
    };

    // Set today's date string if element exists
    try {
      const d = new Date();
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      const months = [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre',
      ];

      w.loadMyCommissions = () => this.loadMyCommissions();
      const el = document.getElementById('today-date');
      if (el)
        el.textContent =
          days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    } catch (e) {
      /* ignore */
    }

    // Initial render will happen after the roster loads.
    this.loadRosterForSelectedCommission();
  }

  private loadMyCommissions(): void {
    this.candidatureService.getMyCommissions(this.selectedCommissionId).subscribe({
      next: (res: any) => {
        this.commissionOptions = res.commissions || [];
        if (!this.selectedCommissionId && this.commissionOptions.length > 0) {
          this.selectedCommissionId = res.active_commission_id || this.commissionOptions[0].id;
        }
        this.persistCommissionSelection();
        this.applyCommissionContextToMembers();
        this.loadRosterForSelectedCommission();
      },
      error: () => {
        if (!this.selectedCommissionId) {
          this.selectedCommissionId = 1;
        }
        this.commissionOptions = [
          { id: 1, nom: 'Commission GL' },
          { id: 2, nom: 'Commission DS' },
        ];
        this.persistCommissionSelection();
        this.applyCommissionContextToMembers();
        this.loadRosterForSelectedCommission();
      },
    });
  }

  private persistCommissionSelection(): void {
    if (this.selectedCommissionId) {
      localStorage.setItem(this.activeCommissionStorageKey, String(this.selectedCommissionId));
    } else {
      localStorage.removeItem(this.activeCommissionStorageKey);
    }
  }

  private applyCommissionContextToMembers(): void {
    const w = window as any;
    if (!w.membres || !this.commissionOptions.length) return;

    w.selectedCommissionId = this.selectedCommissionId;
    w.renderTable();
  }

  changeCommission(value: string | number): void {
    const parsed = value === '' || value === null || value === undefined ? null : Number(value);
    this.selectedCommissionId = Number.isFinite(parsed as number) ? parsed : null;
    this.persistCommissionSelection();

    const w = window as any;
    w.selectedCommissionId = this.selectedCommissionId;
    this.loadRosterForSelectedCommission();
    if (typeof w.showToast === 'function') {
      w.showToast('Commission active mise à jour', 't-info');
    }
  }

  private loadRosterForSelectedCommission(): void {
    const commissionId = this.selectedCommissionId;
    if (!commissionId) {
      return;
    }

    this.commissionService.listCommissionMembers(commissionId).subscribe({
      next: (response: any) => {
        const rawMembers = Array.isArray(response) ? response : response?.members || [];
        const roster = rawMembers.map((member: any, index: number) => {
          const firstName = String(member.first_name || '').trim();
          const lastName = String(member.last_name || '').trim();
          const memberName = String(member.member_name || `${firstName} ${lastName}` || member.email || `Membre ${index + 1}`).trim();
          const parts = memberName.split(' ');
          const prenom = firstName || parts[0] || 'Membre';
          const nom = lastName || parts.slice(1).join(' ') || '';
          const roleLabel = member.role === 'responsable' ? 'Responsable' : 'Membre';

          return {
            id: member.user_id || member.id || index + 1,
            prenom,
            nom,
            email: member.email || member.user_email || '',
            spec: roleLabel,
            commissionId,
            assigns: member.actif === false ? 0 : 1,
            traites: member.actif === false ? 0 : 1,
            avis: member.role === 'responsable' ? 1 : 0,
            statut: member.actif === false ? 'inactif' : 'actif',
            lastActivity: member.date_nomination || '',
            avatarBg: member.role === 'responsable' ? '#E6F1FB' : '#E1F5EE',
            avatarColor: member.role === 'responsable' ? '#185FA5' : '#0F6E56',
          };
        });

        const w = window as any;
        w.membres = roster;
        w.filtered = [...roster];
        if (typeof w.renderTable === 'function') {
          w.renderTable();
        }
      },
      error: (error: any) => {
        console.error('Erreur chargement roster commission:', error);
        const w = window as any;
        w.membres = [];
        w.filtered = [];
        if (typeof w.renderTable === 'function') {
          w.renderTable();
        }
      },
    });
  }

  openMembersManagement(): void {
    if (!this.selectedCommissionId) {
      return;
    }

    this.router.navigate(['/commission/gestion-membres', this.selectedCommissionId]);
  }
}
