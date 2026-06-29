/**
 * ISIMM — Liste des universités tunisiennes et leurs établissements.
 * Utilisée par le formulaire candidat (étape Bac et Diplôme).
 *
 * - La clé est le nom de l'université.
 * - La valeur est la liste des établissements rattachés.
 *
 * Le helper `isISIMMSelection(uni, etab)` retourne true si la sélection
 * correspond à un étudiant ISIMM (Université de Monastir + ISIMM).
 */

export const UNIVERSITIES_DATA: Record<string, string[]> = {
  'Université de Monastir': [
    "ISIMM – Institut Supérieur d'Informatique et des Mathématiques de Monastir",
    'Faculté des Sciences de Monastir',
    'Faculté de Médecine de Monastir',
    'Faculté de Pharmacie de Monastir',
    'Faculté de Médecine Dentaire de Monastir',
    'Faculté des Lettres et Sciences Humaines de Monastir',
    'Faculté de Droit et des Sciences Politiques de Monastir',
    "École Nationale d'Ingénieurs de Monastir (ENIM)",
    'Institut Supérieur de Biotechnologie de Monastir',
    'Institut Supérieur de Musique de Monastir',
    'Institut Supérieur des Langues de Monastir',
    "Institut Supérieur d'Informatique de Mahdia",
    'Institut Supérieur des Arts et Métiers de Kairouan',
  ],
  'Université de Tunis El Manar': [
    'Faculté des Sciences de Tunis (FST)',
    "École Nationale d'Ingénieurs de Tunis (ENIT)",
    "Institut Supérieur d'Informatique (ISI)",
    'Faculté de Médecine de Tunis',
    'Faculté de Pharmacie de Tunis',
    'Faculté de Médecine Dentaire de Tunis',
    'Institut Supérieur des Technologies Médicales (ISTMT)',
    "Institut Préparatoire aux Études d'Ingénieurs El Manar (IPEIEM)",
    'Institut National de Nutrition et de Technologie Alimentaire (INNTA)',
  ],
  'Université de Tunis': [
    "École Nationale Supérieure d'Ingénieurs de Tunis (ENSIT)",
    'Institut Supérieur de Gestion de Tunis (ISG)',
    "Institut Supérieur des Technologies de l'Information et de la Communication (ISTIC)",
    'Faculté des Sciences Humaines et Sociales de Tunis',
    'Institut Supérieur des Sciences Appliquées et de Technologie de Mateur',
  ],
  'Université de la Manouba': [
    "École Nationale des Sciences de l'Informatique (ENSI)",
    "École Supérieure de l'Économie Numérique (ESEN)",
    'Faculté des Lettres, Arts et Humanités de la Manouba',
    'Institut Supérieur de Documentation (ISD)',
    'Institut Supérieur des Arts Multimédias de la Manouba',
    "Institut Supérieur du Sport et de l'Éducation Physique de Ksar Saïd",
  ],
  'Université de Carthage': [
    'École Polytechnique de Tunisie (EPT)',
    'Institut National des Sciences Appliquées et de Technologie (INSAT)',
    "École Nationale d'Architecture et d'Urbanisme (ENAU)",
    "Institut Supérieur de Comptabilité et d'Administration des Entreprises (ISCAE)",
    'École Supérieure de Commerce de Tunis (ESCT)',
    'Faculté des Sciences Économiques et de Gestion de Nabeul',
    "Institut Supérieur des Technologies de l'Information et de la Communication de Borj Cedria",
  ],
  'Université de Sousse': [
    'Faculté des Sciences de Sousse',
    'Faculté des Lettres et Sciences Humaines de Sousse',
    "École Nationale d'Ingénieurs de Sousse (ENISO)",
    'Institut Supérieur de Gestion de Sousse',
    'Institut Supérieur de Musique de Sousse',
    'Institut Supérieur des Beaux Arts de Sousse',
    'Institut Supérieur des Technologies de Hammam Sousse',
  ],
  'Université de Sfax': [
    'Faculté des Sciences de Sfax (FSS)',
    'Faculté des Lettres et Sciences Humaines de Sfax',
    'Faculté de Droit et des Sciences Économiques de Sfax',
    'Faculté de Médecine de Sfax',
    "École Nationale d'Ingénieurs de Sfax (ENIS)",
    "Institut Supérieur d'Informatique et Multimédia de Sfax (ISIMS)",
    'Institut Supérieur de Gestion de Sfax',
    'Institut Supérieur de Biotechnologie de Sfax',
  ],
  'Université de Gabès': [
    'Faculté des Sciences de Gabès',
    "École Nationale d'Ingénieurs de Gabès (ENIG)",
    'Institut Supérieur des Sciences Appliquées et de Technologie de Gabès',
    'Institut Supérieur de Gestion de Gabès',
    'Institut Supérieur des Technologies Informatiques de Gabès',
  ],
  'Université de Gafsa': [
    'Faculté des Sciences de Gafsa',
    'Institut Supérieur des Arts et Métiers de Gafsa',
    'École Supérieure des Sciences et Technologies de Gafsa',
    'Institut Supérieur de Gestion de Gafsa',
  ],
  'Université de Jendouba': [
    'Faculté de Droit et des Sciences Politiques de Jendouba',
    'Institut Supérieur de Gestion de Jendouba',
    "Institut Supérieur d'Agriculture du Kef",
    'Institut Supérieur des Sciences Humaines de Jendouba',
  ],
  'Université de Kairouan': [
    'Faculté des Sciences de Kairouan',
    'Faculté des Lettres et Sciences Humaines de Kairouan',
    "Institut Supérieur d'Informatique de Kairouan",
    'Institut Supérieur des Sciences Appliquées et de Technologie de Kasserine',
  ],
  'Ez-Zitouna University': [
    'Institut Supérieur de Civilisation Islamique',
    'Institut Supérieur des Sciences Islamiques',
  ],
  'Université Virtuelle de Tunis (UVT)': ['UVT – Enseignement à distance'],
  Étranger: ['Autre établissement étranger – préciser dans le dossier'],
};

/** Liste ordonnée des universités (clés du dict ci-dessus) — pour les <option> */
export const UNIVERSITIES_LIST: string[] = Object.keys(UNIVERSITIES_DATA);

/** Helper : retourne true si Université de Monastir + établissement ISIMM. */
export function isISIMMSelection(universite: string, etablissement: string): boolean {
  if (!universite || !etablissement) return false;
  if (universite !== 'Université de Monastir') return false;
  return etablissement.toUpperCase().includes('ISIMM');
}

/** Retourne la liste des établissements d'une université donnée. */
export function getEtablissementsForUniversite(universite: string): string[] {
  return UNIVERSITIES_DATA[universite] || [];
}

/**
 * Structure stockée côté candidature :
 *   { universite: string, etablissement: string, isISIMM: boolean }
 */
export interface OrigineEtablissement {
  universite: string;
  etablissement: string;
  isISIMM: boolean;
}
