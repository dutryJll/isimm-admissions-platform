import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BadgeTone, StatusBadgeComponent } from '../shared/status-badge/status-badge.component';

type Lang = 'fr' | 'en';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, StatusBadgeComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  currentLang: Lang = 'fr';
  showLangMenu: boolean = false;
  isMobileMenuOpen: boolean = false;

  translations: Record<Lang, any> = {
    fr: {
      nav: {
        official: 'Plateforme Officielle',
        home: 'Accueil',
        formation: 'Formation',
        guide: 'Guide Etudiant',
        contact: 'Contact',
        login: 'Se connecter',
        languageLabel: 'FR 🇫🇷',
        languageFr: 'FR 🇫🇷',
        languageEn: 'EN 🇬🇧',
      },
      hero: {
        title: 'Votre avenir commence ici : Candidature simple, rapide et transparente.',
        subtitle: 'Plateforme officielle ISIMM',
        apply: 'Candidater maintenant',
        discover: 'Decouvrir les formations',
      },
      credibilityStats: [
        { value: '+500', label: 'Candidats par an' },
        { value: '12', label: 'Masters ouverts' },
        { value: '97%', label: 'Taux de dossiers completes' },
        { value: '24h', label: 'Delai moyen de verification OCR' },
      ],
      stats: {
        one: 'Processus dematerialise',
        two: 'Acces a votre dossier',
        three: 'Verification intelligente',
        four: 'Processus securise',
      },
      sections: {
        formationsTitle: "Nos Formations d'Excellence",
        formationsSubtitle:
          'Choisissez parmi nos programmes de formation reconnus nationalement et internationalement',
        formationsNote:
          'Seules les offres validées par le responsable sont publiées dans les espaces candidat et accueil.',
        processTitle: "Le processus d'admission",
        processSubtitle: 'Un parcours simple et transparent en 7 etapes',
      },
      cards: {
        researchBadge: 'Recherche',
        researchTitle: 'Masters de Recherche',
        researchDesc: 'Programmes orientes recherche scientifique et innovation technologique',
        researchItem1: 'Master en Genie Logiciel',
        researchItem2: 'Master en Microelectronique',
        professionalBadge: 'Professionnel',
        professionalTitle: 'Masters Professionnels',
        professionalDesc: 'Formations pratiques pour une insertion professionnelle immediate',
        professionalItem1: 'Master en Data Science',
        professionalItem2: 'Master Ingenierie Instrumentation',
        professionalItem3: 'Master Genie Logiciel',
        engineerBadge: 'Ingenieur',
        engineerTitle: 'Cycle Ingenieur',
        engineerDesc: "Formation d'ingenieur en 3 ans avec 2 specialites d'excellence",
        engineerItem1: 'Genie Informatique',
        engineerItem2: 'Genie Electrique',
        explore: 'Explorer',
        statusOpen: 'Inscriptions Ouvertes',
        statusSoon: 'Bientot',
      },
      process: {
        s1Title: 'Preinscription en ligne',
        s1Text: 'Creez votre compte et remplissez votre formulaire de candidature.',
        s2Title: 'Preselection',
        s2Text: 'Calcul automatique de votre score selon les criteres officiels.',
        s3Title: 'Depot du dossier',
        s3Text: 'Telechargez vos documents justificatifs (releves, diplomes, CIN...).',
        s4Title: 'Verification intelligente',
        s4Text: "Notre systeme OCR verifie automatiquement l'authenticite de vos documents.",
        s5Title: 'Publication des resultats',
        s5Text: "Consultez votre statut : Admis, Liste d'attente ou Refuse.",
        s5Realtime: 'Le suivi est mis a jour en temps reel sur votre dashboard.',
        s6Title: 'Paiement des frais',
        s6Text: "Les candidats admis reglent leurs frais d'inscription via inscription.tn.",
        s7Title: "Confirmation d'inscription",
        s7Text: "Validation finale et bienvenue a l'ISIMM !",
      },
      footer: {
        institute: "Institut Superieur d'Informatique et de Mathematiques de Monastir",
        quickLinks: 'Liens Rapides',
        social: 'Reseaux officiels',
        calendar: 'Calendrier des concours',
        faq: 'FAQ',
        docs: 'Documents requis',
        login: 'Connexion',
        rights: 'Tous droits reserves',
      },
    },
    en: {
      nav: {
        official: 'Official Platform',
        home: 'Home',
        formation: 'Programs',
        guide: 'Student Guide',
        contact: 'Contact',
        login: 'Sign in',
        languageLabel: 'EN 🇬🇧',
        languageFr: 'FR 🇫🇷',
        languageEn: 'EN 🇬🇧',
      },
      hero: {
        title: 'Your future starts here: Simple, fast and transparent applications.',
        subtitle: 'Official ISIMM platform',
        apply: 'Apply now',
        discover: 'Explore programs',
      },
      credibilityStats: [
        { value: '+500', label: 'Candidates per year' },
        { value: '12', label: 'Open masters' },
        { value: '97%', label: 'Complete files rate' },
        { value: '24h', label: 'Average OCR verification delay' },
      ],
      stats: {
        one: 'Digital process',
        two: '24/7 file access',
        three: 'Smart verification',
        four: 'Secure process',
      },
      sections: {
        formationsTitle: 'Our Excellence Programs',
        formationsSubtitle:
          'Choose from our nationally and internationally recognized academic programs',
        formationsNote:
          'Only offers validated by the responsible staff are published in the candidate and home spaces.',
        processTitle: 'Admission process',
        processSubtitle: 'A simple and transparent 7-step journey',
      },
      cards: {
        researchBadge: 'Research',
        researchTitle: 'Research Masters',
        researchDesc: 'Programs focused on scientific research and technological innovation',
        researchItem1: 'Software Engineering Master',
        researchItem2: 'Microelectronics Master',
        professionalBadge: 'Professional',
        professionalTitle: 'Professional Masters',
        professionalDesc: 'Practice-oriented programs for rapid employability',
        professionalItem1: 'Data Science Master',
        professionalItem2: 'Instrumentation Engineering Master',
        professionalItem3: 'Software Engineering Master',
        engineerBadge: 'Engineer',
        engineerTitle: 'Engineering Cycle',
        engineerDesc: '3-year engineering program with 2 excellence tracks',
        engineerItem1: 'Computer Engineering',
        engineerItem2: 'Electrical Engineering',
        explore: 'Explore',
        statusOpen: 'Open Admissions',
        statusSoon: 'Coming Soon',
      },
      process: {
        s1Title: 'Online pre-registration',
        s1Text: 'Create your account and complete your application form.',
        s2Title: 'Preselection',
        s2Text: 'Automatic score calculation according to official criteria.',
        s3Title: 'Document submission',
        s3Text: 'Upload your supporting documents (transcripts, diplomas, ID card...).',
        s4Title: 'Smart verification',
        s4Text: 'Our OCR system automatically checks document authenticity.',
        s5Title: 'Results publication',
        s5Text: 'Check your status: Admitted, Waiting list or Rejected.',
        s5Realtime: 'Tracking is updated in real time on your dashboard.',
        s6Title: 'Fee payment',
        s6Text: 'Admitted candidates pay registration fees via inscription.tn.',
        s7Title: 'Enrollment confirmation',
        s7Text: 'Final validation and welcome to ISIMM!',
      },
      footer: {
        institute: 'Higher Institute of Computer Science and Mathematics of Monastir',
        quickLinks: 'Quick Links',
        social: 'Official social media',
        calendar: 'Admission calendar',
        faq: 'FAQ',
        docs: 'Required documents',
        login: 'Login',
        rights: 'All rights reserved',
      },
    },
  };

  constructor(private router: Router) {}

  get tr() {
    return this.translations[this.currentLang];
  }

  get credibilityStats(): Array<{ value: string; label: string }> {
    return this.tr.credibilityStats || [];
  }

  get formationStatuses(): Record<string, { label: string; tone: BadgeTone; route: string }> {
    return {
      research: {
        label: this.tr.cards.statusOpen,
        tone: 'success',
        route: '/masters/recherche/exploration',
      },
      professional: {
        label: this.tr.cards.statusOpen,
        tone: 'success',
        route: '/masters/professionnel/exploration',
      },
      engineer: {
        label: this.tr.cards.statusSoon,
        tone: 'warning',
        route: '/ingenieur/disponibles',
      },
    };
  }

  toggleLanguageMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showLangMenu = !this.showLangMenu;
  }

  toggleMobileMenu(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  selectLanguage(lang: Lang, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.currentLang = lang;
    this.showLangMenu = false;
  }

  @HostListener('document:click')
  closeLanguageMenu(): void {
    this.showLangMenu = false;
  }

  goToChoix(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.closeMobileMenu();
    this.router.navigate(['/choisir-candidature']);
  }

  goToMasters(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.closeMobileMenu();
    this.router.navigate(['/choisir-candidature']);
  }
}
