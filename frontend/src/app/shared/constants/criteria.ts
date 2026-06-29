/**
 * ISIMM — Liste des critères d'évaluation disponibles.
 *
 * - Côté Responsable : configure code + label + coefficient + valeur/seuil
 * - Côté Candidat : remplit uniquement la VALEUR (jamais le coefficient)
 * - Côté Système : score = Σ (coefficient_i × valeur_i)
 *
 * ⚠️ Le coefficient n'est JAMAIS exposé au candidat. Il est saisi
 *    uniquement par le Responsable et stocké côté serveur.
 */

/** Type d'input attendu pour la saisie de la valeur du critère. */
export type CritereInputType = 'number' | 'yesno' | 'count';

/** Catégorie pour le regroupement visuel dans le dropdown Responsable. */
export type CritereCategory =
  | 'bac'
  | 'langue'
  | 'licence'
  | 'maitrise'
  | 'parcours'
  | 'bonus'
  | 'malus';

/** Option de critère exposée au Responsable (avec coefficient). */
export interface CritereOption {
  code: string;
  label: string;
  category: CritereCategory;
  inputType: CritereInputType;
}

/** Configuration d'un critère par offre (côté Responsable, INCLUT coefficient). */
export interface CritereConfig {
  code: string;
  label: string;
  coefficient: number; // ⚠️ RESPONSABLE seulement — jamais envoyé au candidat
  valeur: string;      // ex: 'sur 20', '5/3/0 pts'
  category: CritereCategory;
}

/** Vue critère exposée au CANDIDAT (sans coefficient). */
export interface CritereCandidatView {
  code: string;
  label: string;
  inputType: CritereInputType;
  required: boolean;
}

/** Valeur saisie par le candidat pour un critère. */
export interface CritereValeur {
  code: string;
  valeur: string;
}

/** Payload soumis par le candidat à l'API (sans coefficient). */
export interface CandidatCriteriaSubmit {
  parcours: string;
  criteresValeurs: CritereValeur[];
}

// ─────────────────────────────────────────────────────────────────
//  Liste complète des critères disponibles dans le dropdown Responsable
// ─────────────────────────────────────────────────────────────────
export const CRITERIA_OPTIONS: CritereOption[] = [
  // ── BAC ─────────────────────────────────────────────────────
  { code: 'M_BAC',   label: 'Moyenne du Baccalauréat (M_Bac)',  category: 'bac',      inputType: 'number' },
  { code: 'N_MATH',  label: 'Note Mathématiques Bac (N_Math)',  category: 'bac',      inputType: 'number' },
  { code: 'N_FR',    label: 'Note Français Bac (N_Fr)',         category: 'bac',      inputType: 'number' },
  { code: 'N_ANG',   label: 'Note Anglais Bac (N_Ang)',         category: 'bac',      inputType: 'number' },

  // ── LANGUE ──────────────────────────────────────────────────
  { code: 'CERT_B2', label: 'Certification B2 Anglais',         category: 'langue',   inputType: 'yesno'  },

  // ── LICENCE ─────────────────────────────────────────────────
  { code: 'M1',      label: 'Moyenne 1ère Année Licence (M1)',  category: 'licence',  inputType: 'number' },
  { code: 'M2',      label: 'Moyenne 2ème Année Licence (M2)',  category: 'licence',  inputType: 'number' },
  { code: 'M3',      label: 'Moyenne 3ème Année Licence (M3)',  category: 'licence',  inputType: 'number' },
  { code: 'MG',      label: 'Moyenne Générale Licence (MG)',    category: 'licence',  inputType: 'number' },

  // ── MAÎTRISE ────────────────────────────────────────────────
  { code: 'M1_M',    label: 'Moyenne 1ère Année Maîtrise (M1_M)', category: 'maitrise', inputType: 'number' },
  { code: 'M2_M',    label: 'Moyenne 2ème Année Maîtrise (M2_M)', category: 'maitrise', inputType: 'number' },
  { code: 'M3_M',    label: 'Moyenne 3ème Année Maîtrise (M3_M)', category: 'maitrise', inputType: 'number' },
  { code: 'M4_M',    label: 'Moyenne 4ème Année Maîtrise (M4_M)', category: 'maitrise', inputType: 'number' },

  // ── DONNÉES BRUTES PARCOURS ────────────────────────────────
  { code: 'NR',      label: 'Nombre de Redoublements (NR)',         category: 'parcours', inputType: 'count'  },
  { code: 'NSC',     label: 'Nombre de Sessions de Contrôle (NSC)', category: 'parcours', inputType: 'count'  },

  // ── BONUS ───────────────────────────────────────────────────
  { code: 'BNR',     label: 'Bonus Non-Redoublement (BNR)',     category: 'bonus',    inputType: 'number' },
  { code: 'BSP',     label: 'Bonus Session Principale (BSP)',   category: 'bonus',    inputType: 'number' },
  { code: 'BL',      label: 'Bonus Langue (BL)',                category: 'bonus',    inputType: 'yesno'  },
  { code: 'BAD',     label: "Bonus Année du Diplôme (BAD)",     category: 'bonus',    inputType: 'number' },

  // ── MALUS ───────────────────────────────────────────────────
  { code: 'MR',      label: 'Malus Redoublement (MR)',          category: 'malus',    inputType: 'number' },
  { code: 'MC',      label: 'Malus Session de Contrôle (MC)',   category: 'malus',    inputType: 'number' },
];

/**
 * Critères affichés par défaut au candidat selon le parcours.
 * Utilisé comme fallback si l'API ne renvoie rien.
 */
export const PARCOURS_CRITERIA_DEFAULT: Record<string, string[]> = {
  mrgl: ['M_BAC', 'N_MATH', 'N_FR', 'N_ANG', 'CERT_B2', 'M1', 'M2', 'M3', 'NR', 'NSC'],
  gl:   ['M1', 'M2', 'M3', 'NR', 'NSC'],
  ds:   ['M1', 'M2', 'M3', 'NR', 'NSC'],
  '3i': ['M_BAC', 'M1', 'M2', 'M3', 'NR', 'NSC'],
  micro:['M_BAC', 'M1', 'M2', 'M3', 'NR', 'NSC'],
};

/** Lookup helper : retourne l'option critère depuis son code. */
export function getCritereByCode(code: string): CritereOption | undefined {
  return CRITERIA_OPTIONS.find((c) => c.code === code);
}

/** Retourne la liste ordonnée des options groupées par catégorie. */
export function getCriteriaGrouped(): Record<CritereCategory, CritereOption[]> {
  return CRITERIA_OPTIONS.reduce(
    (acc, c) => {
      (acc[c.category] = acc[c.category] || []).push(c);
      return acc;
    },
    {} as Record<CritereCategory, CritereOption[]>,
  );
}

/**
 * Convertit une liste de CritereConfig (côté Responsable) en vue Candidat
 * en SUPPRIMANT le coefficient.
 */
export function toCandidatView(configs: CritereConfig[]): CritereCandidatView[] {
  return configs.map((c) => {
    const opt = getCritereByCode(c.code);
    return {
      code: c.code,
      label: c.label,
      inputType: opt?.inputType || 'number',
      required: true,
    };
  });
}

/**
 * Génère un aperçu textuel de la formule de score :
 *   "Score = 1.5×M1 + 2×M2 + M3 + BNR"
 */
export function buildFormulaPreview(configs: CritereConfig[]): string {
  if (!configs.length) return 'Score = — (aucun critère)';
  const parts = configs.map((c) => {
    const coef = Number(c.coefficient);
    const shortLabel = c.code;
    return Number.isFinite(coef) && coef !== 1 ? `${coef}×${shortLabel}` : shortLabel;
  });
  return 'Score = ' + parts.join(' + ');
}
