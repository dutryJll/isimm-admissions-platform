export interface OffreRichContent {
  offerId: number;
  title: string;
  openingTitle: string;
  openingBody: string;
  tableTitle: string;
  tableHeaders: string[];
  tableRows: string[][];
  modalitesTitle: string;
  etape1: string;
  etape2: string;
  dossierTitle: string;
  dossierItems: string[];
  scoreTitle: string;
  scoreFormula: string;
  moyenneFormula: string;
  scoreTableHeaders?: string[];
  scoreTableRows?: string[][];
  bnrRules: string[];
  bspRules: string[];
  evaluationNotes: string[];
  updatedAt: string;
}
