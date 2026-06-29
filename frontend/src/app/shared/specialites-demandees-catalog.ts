export type ParcoursSousType = 'professionnel' | 'recherche' | '';
export type ParcoursTypeFormation = 'master' | 'cycle_ingenieur' | 'ingenieur';

export type CritereMode = 'palier' | 'formule' | 'fixe';

export interface CriterePalier {
  condition: string;
  points: number;
}

export interface ScoreCriterion {
  code: string;
  label: string;
  description?: string;
  mode: CritereMode;
  paliers?: CriterePalier[];
  formuleCalc?: string;
  valeurFixe?: number;
}

export interface ScoreConfig {
  criteres: ScoreCriterion[];
  formule: string;
}

export interface ParcoursSpecialiteOption {
  code: string;
  label: string;
  titre: string;
  typeFormation: ParcoursTypeFormation;
  sousType: ParcoursSousType;
  defaultSpecialitesDemandees: string[];
  defaultScoreConfig: ScoreConfig;
}

const SCORE_MPGL: ScoreConfig = {
  formule: 'M.G + B.N.R + B.S.P',
  criteres: [
    {
      code: 'M.G', label: 'Moyenne Générale', mode: 'formule',
      formuleCalc: '(l1 + l2 + l3) / 3',
      description: 'Moyenne arithmétique des 3 années de Licence',
    },
    {
      code: 'B.N.R', label: 'Bonus Non-Redoublement', mode: 'palier',
      paliers: [
        { condition: 'Aucun redoublement (0)', points: 5 },
        { condition: 'Un redoublement (1)', points: 3 },
        { condition: 'Deux redoublements et plus (≥2)', points: 0 },
      ],
    },
    {
      code: 'B.S.P', label: 'Bonus Session Principale', mode: 'palier',
      paliers: [
        { condition: 'Aucune session de rattrapage (0)', points: 3 },
        { condition: '1 session de rattrapage', points: 2 },
        { condition: '2 sessions de rattrapage et plus (≥2)', points: 0 },
      ],
    },
  ],
};

const SCORE_MPDS: ScoreConfig = SCORE_MPGL;

const SCORE_MP3I: ScoreConfig = {
  formule: 'M.P + M.R + M.C',
  criteres: [
    {
      code: 'M.P', label: 'Moyenne Pondérée', mode: 'formule',
      formuleCalc: '2*bac + 1.5*l1 + 1*l2 + 0.5*l3',
      description: '2×Moy.Bac + 1.5×L1 + 1×L2 + 0.5×L3',
    },
    {
      code: 'M.R', label: 'Malus Redoublement', mode: 'fixe',
      valeurFixe: -1,
      description: '-1 point par redoublement',
    },
    {
      code: 'M.C', label: 'Malus Session de Contrôle', mode: 'fixe',
      valeurFixe: -1,
      description: '-1 point par session de contrôle réussie',
    },
  ],
};

const SCORE_MRGL: ScoreConfig = {
  formule: '1.5*M1 + 2*M2 + M3 + B.N.R + B.S.P + (M.Bac + N.Math - 20)/2 + B.L + B.A.D',
  criteres: [
    { code: 'M1', label: 'Moyenne 1ère année Licence', mode: 'fixe', valeurFixe: 0, description: 'Moyenne L1 — coeff 1.5 dans la formule' },
    { code: 'M2', label: 'Moyenne 2ème année Licence', mode: 'fixe', valeurFixe: 0, description: 'Moyenne L2 — coeff 2 dans la formule' },
    { code: 'M3', label: 'Moyenne 3ème année Licence', mode: 'fixe', valeurFixe: 0, description: 'Moyenne L3 — coeff 1 dans la formule' },
    { code: 'M.Bac', label: 'Moyenne Baccalauréat', mode: 'fixe', valeurFixe: 0, description: 'Session principale uniquement' },
    { code: 'N.Math', label: 'Note Mathématiques Bac', mode: 'fixe', valeurFixe: 0, description: 'Session principale uniquement' },
    {
      code: 'B.N.R', label: 'Bonus Non-Redoublement', mode: 'palier',
      paliers: [
        { condition: '0 redoublement', points: 5 },
        { condition: '1 redoublement', points: 1.5 },
        { condition: "Plus d'1 redoublement", points: 0 },
      ],
    },
    {
      code: 'B.S.P', label: 'Bonus Session Principale', mode: 'palier',
      paliers: [
        { condition: '0 session de contrôle', points: 3 },
        { condition: '1 session de contrôle', points: 1 },
        { condition: "Plus d'1 session", points: 0 },
      ],
    },
    {
      code: 'B.L', label: 'Bonus Langue', mode: 'palier',
      paliers: [
        { condition: 'Note Français Bac ≥12 OU Anglais Bac ≥12 OU Certif B2', points: 1 },
        { condition: 'Sinon', points: 0 },
      ],
    },
    {
      code: 'B.A.D', label: 'Bonus Année Diplôme', mode: 'palier',
      paliers: [
        { condition: 'Diplôme obtenu en 2025 ou 2023', points: 4 },
        { condition: 'Diplôme obtenu en 2022, 2021 ou 2020', points: 2 },
        { condition: 'Sinon', points: 0 },
      ],
    },
  ],
};

const SCORE_MRMI: ScoreConfig = {
  formule: 'M.P + M.R + M.C',
  criteres: [
    {
      code: 'M.P', label: 'Moyenne Pondérée', mode: 'formule',
      formuleCalc: '0.5*bac + 1*l1 + 1.5*l2 + 2*l3',
      description: '0.5×Bac + 1×L1 + 1.5×L2 + 2×L3 (S5 sans PFE)',
    },
    {
      code: 'M.R', label: 'Malus Redoublement', mode: 'fixe',
      valeurFixe: -4,
      description: '-4 pts par redoublement — max 1 toléré',
    },
    {
      code: 'M.C', label: 'Malus Session de Contrôle', mode: 'palier',
      paliers: [
        { condition: 'Réussite en contrôle L1', points: -1 },
        { condition: 'Réussite en contrôle L2', points: -1.5 },
        { condition: 'Réussite en contrôle L3', points: -2 },
      ],
    },
  ],
};

const SCORE_INGGL: ScoreConfig = {
  formule: '0.5*(2*M1 + 2*M2 + M3) + 50*(1-R1) + 50*(1-R2)',
  criteres: [
    { code: 'M1', label: 'Moyenne L1 session principale', mode: 'fixe', valeurFixe: 0 },
    { code: 'M2', label: 'Moyenne L2 session principale', mode: 'fixe', valeurFixe: 0 },
    { code: 'M3', label: 'Moyenne S1 L3 session principale', mode: 'fixe', valeurFixe: 0 },
    { code: 'R1', label: 'Rang relatif L1 (rang/total)', mode: 'fixe', valeurFixe: 0, description: "Valeur entre 0 et 1 — fournie par l'établissement" },
    { code: 'R2', label: 'Rang relatif L2 (rang/total)', mode: 'fixe', valeurFixe: 0, description: "Valeur entre 0 et 1 — fournie par l'établissement" },
    {
      code: 'B1', label: 'Bonus 1ère année', mode: 'palier',
      paliers: [
        { condition: 'Admis session principale', points: 2 },
        { condition: 'Admis session rattrapage', points: 1.5 },
        { condition: 'Redoublement', points: 0 },
      ],
    },
    {
      code: 'B2', label: 'Bonus 2ème année', mode: 'palier',
      paliers: [
        { condition: 'Admis session principale', points: 2 },
        { condition: 'Admis session rattrapage', points: 1.5 },
      ],
    },
  ],
};

const MPGL_DIPLOMES = [
  "Licence en Sciences de l'Informatique - Génie Logiciel",
  'Licence en Informatique de Gestion (uniquement)',
  "Génie logiciel et systèmes d'information",
  'Génie logiciel',
  'Licence appliquée en développement des systèmes informatiques',
  'Big Data et Analyse de données',
  'Business Computing',
];

const MPDS_DIPLOMES = [
  "Mathématiques Appliquées - Spécialité Statistique de l'Environnement",
  'Mathématiques Appliquées - Spécialité Sciences de Données',
  'Mathématiques et Applications',
  ...MPGL_DIPLOMES,
];

const MP3I_DIPLOMES = [
  'Licence en Électronique, Électrotechnique et Automatique (MIM)',
  'Licence en Électronique, Électrotechnique et Automatique (SE)',
  "Licence en Technologies de l'Information et de la Communication (TIC)",
  'Licence en Mesures et Instrumentation',
  'Licence en EEA (Spécialité Automatique et Informatique Industrielle ou Mesures et Métrologie)',
  'Licence en Génie Électrique (Spécialité Automatique et Informatique Industrielle)',
];

const MRGL_DIPLOMES = [
  'Licence en Informatique',
  'Maîtrise en Informatique',
  'Licence en Informatique ou Informatique de Gestion',
  'Maîtrise en Informatique ou Informatique de Gestion',
];

const MRMI_DIPLOMES = [
  'Licence en EEA, MIM (Électronique, Systèmes Embarqués, Métrologie) ou TIC (Réseaux et IoT)',
  'Licence en Électronique, Automatique ou Mesures et Instrumentation',
  "Réussite en 1ère année du cycle ingénieur (Électronique/Instrumentation) ou équivalent",
];

const INGGL_DIPLOMES = [
  'Génie Logiciel (Informatique)',
  "Diplôme en ingénierie systèmes d'information",
  'Diplôme en ingénierie systèmes informatiques',
];

export const PARCOURS_SPECIALITE_CATALOG: ParcoursSpecialiteOption[] = [
  {
    code: 'MPGL',
    label: 'Génie Logiciel',
    titre: 'Mastère Professionnel en Génie Logiciel (MPGL)',
    typeFormation: 'master',
    sousType: 'professionnel',
    defaultSpecialitesDemandees: MPGL_DIPLOMES,
    defaultScoreConfig: SCORE_MPGL,
  },
  {
    code: 'MPDS',
    label: 'Sciences de Données',
    titre: 'Mastère Professionnel en Sciences des Données (MPDS)',
    typeFormation: 'master',
    sousType: 'professionnel',
    defaultSpecialitesDemandees: MPDS_DIPLOMES,
    defaultScoreConfig: SCORE_MPDS,
  },
  {
    code: 'MP3I',
    label: 'Instrumentation Industrielle',
    titre: 'Mastère Professionnel en Ingénieries en Instrumentation Industrielle (MP3I)',
    typeFormation: 'master',
    sousType: 'professionnel',
    defaultSpecialitesDemandees: MP3I_DIPLOMES,
    defaultScoreConfig: SCORE_MP3I,
  },
  {
    code: 'MRGL',
    label: 'Génie Logiciel',
    titre: 'Mastère Recherche en Génie Logiciel (MRGL)',
    typeFormation: 'master',
    sousType: 'recherche',
    defaultSpecialitesDemandees: MRGL_DIPLOMES,
    defaultScoreConfig: SCORE_MRGL,
  },
  {
    code: 'MRMI',
    label: 'Micro-Électronique et Instrumentation',
    titre: 'Mastère Recherche en Micro-Électronique et Instrumentation (MRMI)',
    typeFormation: 'master',
    sousType: 'recherche',
    defaultSpecialitesDemandees: MRMI_DIPLOMES,
    defaultScoreConfig: SCORE_MRMI,
  },
  {
    code: 'ING-GL',
    label: 'Génie Logiciel',
    titre: 'Ingénieur en Sciences Appliquées et Technologie — Génie Logiciel (ING-GL)',
    typeFormation: 'cycle_ingenieur',
    sousType: '',
    defaultSpecialitesDemandees: INGGL_DIPLOMES,
    defaultScoreConfig: SCORE_INGGL,
  },
];

export function resolveParcoursByCode(code: string): ParcoursSpecialiteOption | undefined {
  return PARCOURS_SPECIALITE_CATALOG.find((p) => p.code === code);
}

export function resolveParcoursByOffreId(id: number): ParcoursSpecialiteOption | undefined {
  const byOffreId: Record<number, string> = {
    1: 'MPGL',
    2: 'MPDS',
    3: 'MP3I',
    4: 'MRGL',
    5: 'MRMI',
    6: 'ING-GL',
  };
  const code = byOffreId[id];
  return code ? resolveParcoursByCode(code) : undefined;
}

export interface FormulaEvalResult {
  ok: boolean;
  value: number | null;
  error: string | null;
  usedCodes: string[];
  unknownCodes: string[];
}

function codeToAlias(code: string): string {
  return code.replace(/\./g, '__');
}

export function defaultValueForCritere(c: ScoreCriterion): number {
  if (c.mode === 'palier') {
    const p = c.paliers && c.paliers[0];
    return p ? Number(p.points) || 0 : 0;
  }
  if (c.mode === 'fixe') {
    return Number(c.valeurFixe) || 0;
  }
  if (c.mode === 'formule') {
    const sample = { l1: 14, l2: 14, l3: 14, bac: 14, math_bac: 14 };
    return evalCritereFormula(c.formuleCalc || '0', sample);
  }
  return 0;
}

export function evalCritereFormula(
  formuleCalc: string,
  candidateVars: Record<string, number>,
): number {
  const expr = String(formuleCalc || '').trim();
  if (!expr) return 0;
  if (!/^[A-Za-z0-9_+\-*/().,\s]+$/.test(expr)) return 0;
  try {
    const keys = Object.keys(candidateVars);
    const body = `"use strict"; return (${expr});`;
    const fn = new Function(...keys, body);
    const v = fn(...keys.map((k) => Number(candidateVars[k]) || 0));
    return typeof v === 'number' && isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function evaluateScoreFormule(
  formule: string,
  criteres: ScoreCriterion[],
  overrides?: Record<string, number>,
): FormulaEvalResult {
  const raw = String(formule || '').trim();
  if (!raw) {
    return { ok: false, value: null, error: 'Formule vide', usedCodes: [], unknownCodes: [] };
  }

  const codeByAlias = new Map<string, string>();
  for (const c of criteres) {
    codeByAlias.set(codeToAlias(c.code), c.code);
  }

  const sortedCodes = [...criteres.map((c) => c.code)].sort((a, b) => b.length - a.length);
  let expr = raw;
  for (const code of sortedCodes) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expr = expr.replace(new RegExp(escaped, 'g'), codeToAlias(code));
  }

  if (!/^[A-Za-z0-9_+\-*/().,\s]+$/.test(expr)) {
    return { ok: false, value: null, error: 'Caractères non autorisés dans la formule', usedCodes: [], unknownCodes: [] };
  }

  const tokens = Array.from(new Set(expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []));
  const known = new Map<string, number>();
  for (const c of criteres) {
    const alias = codeToAlias(c.code);
    const value = overrides && c.code in overrides ? overrides[c.code] : defaultValueForCritere(c);
    known.set(alias, Number(value) || 0);
  }

  const usedCodes: string[] = [];
  const unknownCodes: string[] = [];
  for (const t of tokens) {
    if (known.has(t)) {
      usedCodes.push(codeByAlias.get(t) || t);
    } else {
      unknownCodes.push(t);
    }
  }
  if (unknownCodes.length > 0) {
    return { ok: false, value: null, error: `Codes inconnus : ${unknownCodes.join(', ')}`, usedCodes, unknownCodes };
  }

  try {
    const args = Array.from(known.keys());
    const body = `"use strict"; return (${expr});`;
    const fn = new Function(...args, body);
    const value = fn(...args.map((k) => known.get(k)));
    if (typeof value !== 'number' || !isFinite(value)) {
      return { ok: false, value: null, error: 'Résultat non numérique', usedCodes, unknownCodes: [] };
    }
    return { ok: true, value, error: null, usedCodes, unknownCodes: [] };
  } catch (e: any) {
    return { ok: false, value: null, error: e?.message || 'Erreur de syntaxe', usedCodes, unknownCodes: [] };
  }
}

export function getParcoursOptionsForType(
  typeFormation: ParcoursTypeFormation,
  sousType?: string,
): ParcoursSpecialiteOption[] {
  return PARCOURS_SPECIALITE_CATALOG.filter((p) => {
    if (typeFormation === 'cycle_ingenieur' || typeFormation === 'ingenieur') {
      return p.typeFormation === 'cycle_ingenieur';
    }
    if (p.typeFormation !== 'master') return false;
    if (sousType) return p.sousType === sousType;
    return true;
  });
}
