import { Injectable } from '@angular/core';
import { ScoreCriterion, CriterePalier } from '../shared/specialites-demandees-catalog';

export interface FormDataCandidat {
  moyenne_l1: number;
  moyenne_l2: number;
  moyenne_l3: number;
  moyenne_bac: number;
  note_maths_bac: number;
  note_francais_bac: number;
  note_anglais_bac: number;
  nb_redoublements: number;
  nb_sessions_controle: number;
  annee_diplome: number;
  rang_l1?: number;
  rang_l2?: number;
  session_l1?: 'principale' | 'rattrapage';
  session_l2?: 'principale' | 'rattrapage';
  session_l1_controle?: boolean;
  session_l2_controle?: boolean;
  session_l3_controle?: boolean;
  certif_b2?: boolean;
}

export interface ScoreDetailItem {
  code: string;
  nom: string;
  valeur: number;
}

export interface ScoreResult {
  detail: ScoreDetailItem[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ScoreService {
  calculerValeurCritere(critere: ScoreCriterion, formData: FormDataCandidat): number {
    if (critere.mode === 'fixe') {
      const valeurFixe = Number(critere.valeurFixe ?? 0);
      const code = critere.code;
      if (code === 'M.R' || code === 'MR') {
        return valeurFixe * Number(formData.nb_redoublements || 0);
      }
      if (code === 'M.C' || code === 'MC') {
        return valeurFixe * Number(formData.nb_sessions_controle || 0);
      }
      const mapping: Record<string, number> = {
        M1: Number(formData.moyenne_l1 || 0),
        M2: Number(formData.moyenne_l2 || 0),
        M3: Number(formData.moyenne_l3 || 0),
        'M.Bac': Number(formData.moyenne_bac || 0),
        'N.Math': Number(formData.note_maths_bac || 0),
        R1: Number(formData.rang_l1 || 0),
        R2: Number(formData.rang_l2 || 0),
      };
      return mapping[code] ?? valeurFixe;
    }

    if (critere.mode === 'formule') {
      const vars: Record<string, number> = {
        l1: Number(formData.moyenne_l1 || 0),
        l2: Number(formData.moyenne_l2 || 0),
        l3: Number(formData.moyenne_l3 || 0),
        bac: Number(formData.moyenne_bac || 0),
        math: Number(formData.note_maths_bac || 0),
        math_bac: Number(formData.note_maths_bac || 0),
        fr: Number(formData.note_francais_bac || 0),
        ang: Number(formData.note_anglais_bac || 0),
      };
      let expr = String(critere.formuleCalc ?? '0');
      Object.entries(vars).forEach(([k, v]) => {
        expr = expr.replace(new RegExp('\\b' + k + '\\b', 'g'), String(v));
      });
      if (!/^[0-9+\-*/().,\s]+$/.test(expr)) {
        return 0;
      }
      try {
        const result = new Function('"use strict"; return (' + expr + ')')();
        return typeof result === 'number' && isFinite(result) ? result : 0;
      } catch {
        return 0;
      }
    }

    if (critere.mode === 'palier') {
      const code = critere.code;
      const paliers = critere.paliers ?? [];

      if (code === 'B.N.R' || code === 'BNR') {
        return this.appliquerPalierRedoublement(paliers, Number(formData.nb_redoublements || 0));
      }
      if (code === 'B.S.P' || code === 'BSP') {
        return this.appliquerPalierSession(paliers, Number(formData.nb_sessions_controle || 0));
      }
      if (code === 'B.L' || code === 'BL') {
        const hasBonus =
          Number(formData.note_francais_bac || 0) >= 12 ||
          Number(formData.note_anglais_bac || 0) >= 12 ||
          !!formData.certif_b2;
        return hasBonus
          ? Number(paliers[0]?.points ?? 0)
          : Number(paliers[paliers.length - 1]?.points ?? 0);
      }
      if (code === 'B.A.D' || code === 'BAD') {
        return this.appliquerPalierAnneeDiplome(paliers, Number(formData.annee_diplome || 0));
      }
      if (code === 'M.C' || code === 'MC') {
        let malus = 0;
        if (formData.session_l1_controle) malus += Number(paliers[0]?.points ?? -1);
        if (formData.session_l2_controle) malus += Number(paliers[1]?.points ?? -1.5);
        if (formData.session_l3_controle) malus += Number(paliers[2]?.points ?? -2);
        return malus;
      }
      if (code === 'B1') {
        return this.appliquerPalierSessionIng(paliers, formData.session_l1);
      }
      if (code === 'B2') {
        return this.appliquerPalierSessionIng(paliers, formData.session_l2);
      }
      return Number(paliers[0]?.points ?? 0);
    }

    return 0;
  }

  private appliquerPalierRedoublement(paliers: CriterePalier[], nbRedoub: number): number {
    if (paliers.length === 0) return 0;
    if (nbRedoub === 0) return Number(paliers[0].points);
    if (nbRedoub === 1) return Number(paliers[1]?.points ?? paliers[paliers.length - 1].points);
    return Number(paliers[paliers.length - 1].points);
  }

  private appliquerPalierSession(paliers: CriterePalier[], nbSess: number): number {
    if (paliers.length === 0) return 0;
    if (nbSess === 0) return Number(paliers[0].points);
    if (nbSess === 1) return Number(paliers[1]?.points ?? paliers[paliers.length - 1].points);
    return Number(paliers[paliers.length - 1].points);
  }

  private appliquerPalierAnneeDiplome(paliers: CriterePalier[], annee: number): number {
    if (paliers.length === 0) return 0;
    if (annee === 2025 || annee === 2023) return Number(paliers[0].points);
    if (annee === 2022 || annee === 2021 || annee === 2020) {
      return Number(paliers[1]?.points ?? paliers[paliers.length - 1].points);
    }
    return Number(paliers[paliers.length - 1].points);
  }

  private appliquerPalierSessionIng(
    paliers: CriterePalier[],
    session: 'principale' | 'rattrapage' | undefined,
  ): number {
    if (paliers.length === 0) return 0;
    if (session === 'principale' || !session) return Number(paliers[0].points);
    if (session === 'rattrapage') {
      return Number(paliers[1]?.points ?? paliers[paliers.length - 1].points);
    }
    return Number(paliers[paliers.length - 1].points);
  }

  calculerScoreTotal(
    criteres: ScoreCriterion[],
    formuleScore: string,
    formData: FormDataCandidat,
  ): ScoreResult {
    const detail: ScoreDetailItem[] = criteres.map((c) => ({
      code: c.code,
      nom: c.label,
      valeur: this.calculerValeurCritere(c, formData),
    }));

    let expr = String(formuleScore || '0').replace(/×/g, '*');
    const sortedDetail = [...detail].sort((a, b) => b.code.length - a.code.length);
    sortedDetail.forEach((d) => {
      const safeCode = d.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expr = expr.replace(new RegExp(safeCode, 'g'), String(d.valeur));
    });

    if (!/^[0-9+\-*/().,\s]+$/.test(expr)) {
      return { detail, total: 0 };
    }

    let total = 0;
    try {
      const result = new Function('"use strict"; return (' + expr + ')')();
      total =
        typeof result === 'number' && isFinite(result) ? Math.round(result * 100) / 100 : 0;
    } catch {
      total = 0;
    }

    return { detail, total };
  }
}
