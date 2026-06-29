// Minimal mock sets used for local dev when API returns none
export const MOCK_MASTER_CANDIDATURES: any[] = [
  {
    id: 1001,
    numero: 'MCK-1001',
    candidat_nom: 'Mock Master 1',
    candidat_email: 'mock1@example.com',
    specialite: 'Master Génie Logiciel',
    score: 16.2,
    dossier_depose: true,
    statut: 'sous_examen',
    type_concours: 'masters',
  },
  {
    id: 1002,
    numero: 'MCK-1002',
    candidat_nom: 'Mock Master 2',
    candidat_email: 'mock2@example.com',
    specialite: 'Master Data Science',
    score: 15.7,
    dossier_depose: false,
    statut: 'soumis',
    type_concours: 'masters',
  },
];

export const MOCK_INGENIEUR_CANDIDATURES: any[] = [
  {
    id: 2001,
    numero: 'ICK-2001',
    candidat_nom: 'Mock Ingénieur 1',
    candidat_email: 'imock1@example.com',
    specialite: 'Cycle Ingénieur',
    score: 15.0,
    dossier_depose: true,
    statut: 'preselectionne',
    type_concours: 'ingenieur',
  },
  {
    id: 2002,
    numero: 'ICK-2002',
    candidat_nom: 'Mock Ingénieur 2',
    candidat_email: 'imock2@example.com',
    specialite: 'Cycle Ingénieur',
    score: 14.6,
    dossier_depose: false,
    statut: 'soumis',
    type_concours: 'ingenieur',
  },
];
