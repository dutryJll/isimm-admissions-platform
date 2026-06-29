import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private currentLanguage: string = 'fr';

  private translations: any = {
    fr: {
      // Navigation
      'nav.home': 'Accueil',
      'nav.login': 'Connexion',
      'nav.logout': 'Déconnexion',

      // Dashboard
      'dashboard.welcome': 'Bienvenue',
      'dashboard.candidatures': 'Candidatures',
      'dashboard.profile': 'Profil',

      // Candidatures
      'candidature.numero': 'N° Candidature',
      'candidature.candidat': 'Candidat',
      'candidature.master': 'Master',
      'candidature.score': 'Score',
      'candidature.statut': 'Statut',
      'candidature.actions': 'Actions',
      'candidature.dossier': 'Dossier',
      'candidature.avis': 'Avis',

      // Statuts
      'status.soumis': 'Soumis',
      'status.en_attente': 'En attente',
      'status.selectionne': 'Sélectionné',
      'status.rejete': 'Rejeté',
      'status.sous_examen': 'Sous examen',
      'status.preselectionne': 'Présélectionné',

      // Boutons
      'btn.save': 'Enregistrer',
      'btn.cancel': 'Annuler',
      'btn.delete': 'Supprimer',
      'btn.edit': 'Modifier',
      'btn.view': 'Voir',
      'btn.download': 'Télécharger',
      'btn.add': 'Ajouter',
      'btn.search': 'Rechercher',
      'btn.reset': 'Réinitialiser',

      // Formulaires
      'form.email': 'Adresse email',
      'form.password': 'Mot de passe',
      'form.firstname': 'Prénom',
      'form.lastname': 'Nom',

      // Messages
      'msg.success': 'Opération réussie',
      'msg.error': 'Une erreur est survenue',
      'msg.confirm': 'Êtes-vous sûr ?',

      // Login page
      'login.back': "Retour à l'accueil",
      'login.title': "Plateforme d'Admission aux masters et cycles d'ingénieurs",
      'login.subtitle': 'ISIMM - Monastir',
      'login.candidate.badge': 'Candidat',
      'login.candidate.title': 'Espace Candidat',
      'login.candidate.desc': 'Gérer mes candidatures et suivre mon dossier',
      'login.commission.badge': 'Commission',
      'login.commission.title': 'Espace Commission',
      'login.commission.desc': 'Évaluer et gérer les dossiers de candidature',
      'login.admin.badge': 'Administration',
      'login.admin.title': 'Espace Administration',
      'login.admin.desc': 'Administrer la plateforme et les utilisateurs',
      'login.access': 'Accéder',
      'login.help': 'Aide',
      'login.contact': 'Contact',
      'login.privacy': 'Confidentialité',

      // Masters page
      'masters.hero.title': "Appels d'inscription - Masters & Cycle d'Ingénieur",
      'masters.hero.subtitle': "Consultez toutes les offres avec leur statut d'ouverture.",
      'masters.hero.mini': "Masters Recherche, Masters Professionnel, Cycle d'Ingénieur",
      'masters.referentiel.title': 'Référentiel officiel 2025/2026',
      'masters.referentiel.school': 'Établissement',
      'masters.referentiel.year': 'Année',
      'masters.referentiel.loading': 'Chargement des détails officiels...',
      'masters.card.research.badge': 'Recherche',
      'masters.card.research.title': 'Masters de Recherche',
      'masters.card.research.desc':
        'Programmes orientés recherche scientifique et innovation technologique',
      'masters.card.professional.badge': 'Professionnel',
      'masters.card.professional.title': 'Masters Professionnels',
      'masters.card.professional.desc':
        "Formations axées sur les compétences pratiques et l'insertion professionnelle",
      'masters.card.engineer.badge': 'Ingenieur',
      'masters.card.engineer.title': "Cycle d'Ingénieur",
      'masters.card.engineer.desc': 'Formation complète en ingénierie avec spécialisations variées',
      'masters.capacity.mrgl': 'Capacité officielle MRGL',
      'masters.capacity.mpgl': 'Capacité officielle MPGL',
      'masters.capacity.mpds': 'Capacité officielle MPDS',
      'masters.capacity.places': 'places',
      'masters.engineer.rule': 'Règlement concours appliqué selon référentiel officiel',
      'masters.explore': 'Explorer',
      'masters.bottom.title': 'APPRENEZ À TOUT MOMENT, PARTOUT',
      'masters.bottom.desc':
        'Chaque étudiant, accédez à la plateforme de votre université avec votre compte institutionnel pour consulter les ressources et activités pédagogiques depuis votre mobile, tablette ou ordinateur.',
      'masters.back': "Retour à l'accueil",

      // Login candidat page
      'login.candidat.back': 'Retour',
      'login.candidat.mark': 'Admission 2026',
      'login.candidat.title': 'Espace Candidat',
      'login.candidat.subtitle': 'Connectez-vous à votre compte',
      'login.candidat.hint.track': 'Suivi du dossier',
      'login.candidat.hint.docs': 'Documents',
      'login.candidat.hint.claims': 'Réclamations',
      'login.candidat.email.label': 'Email',
      'login.candidat.email.placeholder': 'votre.email@example.com',
      'login.candidat.password.label': 'Mot de passe',
      'login.candidat.password.placeholder': '••••••••',
      'login.candidat.forgot': 'Mot de passe oublié ?',
      'login.candidat.submit': 'Se connecter',
      'login.candidat.loading': 'Connexion...',
      'login.candidat.noapply': "Vous n'avez pas encore postulé ?",
      'login.candidat.postuler': 'Postuler à un Master / Cycle Ingénieur',
      'login.candidat.error.fill': 'Veuillez remplir tous les champs',
      'login.candidat.error.role': "Ce compte n'est pas un compte candidat",
      'login.candidat.error.invalid': 'Email ou mot de passe incorrect',

      // Login commission page
      'login.com.back': 'Retour',
      'login.com.mark': 'Espace Restreint',
      'login.com.title': 'Espace Commission',
      'login.com.subtitle': 'Connectez-vous avec vos identifiants',
      'login.com.hint.eval': 'Évaluation',
      'login.com.hint.rank': 'Classement',
      'login.com.hint.valid': 'Validation',
      'login.com.info': "Vos identifiants vous ont été envoyés par email par l'administrateur",
      'login.com.username.label': "Nom d'utilisateur / Email",
      'login.com.username.placeholder': 'Entrez votre identifiant reçu par email',
      'login.com.password.label': 'Mot de passe',
      'login.com.password.placeholder': '••••••••',
      'login.com.submit': 'Se connecter',
      'login.com.loading': 'Connexion...',
      'login.com.help.title': 'Problème de connexion ?',
      'login.com.help.text': "Contactez l'administrateur :",
      'login.com.error.fill': 'Veuillez remplir tous les champs',
      'login.com.error.role':
        "Ce compte n'est pas un compte commission. Veuillez contacter l'administrateur.",
      'login.com.error.invalid':
        'Identifiants incorrects. Vérifiez vos informations reçues par email.',

      // Login admin page
      'login.admin.back': 'Retour',
      'login.admin.mark': 'Espace Sécurisé',
      'login.admin.title.page': 'Espace Administration',
      'login.admin.subtitle': 'Accès réservé aux administrateurs',
      'login.admin.hint.users': 'Utilisateurs',
      'login.admin.hint.settings': 'Paramètres',
      'login.admin.hint.control': 'Contrôle',
      'login.admin.warning': 'Accès sécurisé et surveillé',
      'login.admin.email.label': 'Email administrateur',
      'login.admin.email.placeholder': 'admin@isimm.tn',
      'login.admin.password.label': 'Mot de passe',
      'login.admin.password.placeholder': '••••••••',
      'login.admin.submit': "Accéder à l'administration",
      'login.admin.loading': 'Vérification...',
      'login.admin.note': "Toute tentative d'accès non autorisée sera enregistrée",
      'login.admin.error.fill': 'Veuillez remplir tous les champs',
      'login.admin.error.role': "Accès refusé. Vous n'êtes pas administrateur.",
      'login.admin.error.invalid': 'Email ou mot de passe incorrect',

      // Choix candidature page
      'choix.header.title': 'Choisissez votre type de candidature',
      'choix.header.subtitle':
        'Sélectionnez le programme qui correspond à votre profil et au règlement officiel.',
      'choix.master.title': 'Candidater à un Master',
      'choix.master.desc':
        'Mastères de recherche et professionnels avec parcours MRGL, MRMI, MPGL, MPDS et MP3I.',
      'choix.master.feature.1': '5 parcours: MRGL, MRMI, MPGL, MPDS, MP3I',
      'choix.master.feature.2': 'Voies Recherche et Professionnel',
      'choix.master.feature.3': 'Candidature via classement sur score',
      'choix.master.feature.4': 'Durée: 2 ans',
      'choix.master.button': 'Choisir Master',
      'choix.ing.title': 'Candidater au Cycle Ingénieur',
      'choix.ing.desc': "Concours d'entrée en cycle ingénieur selon l'avis officiel de l'ISIMM.",
      'choix.ing.feature.1': 'Admission selon règlement du concours',
      'choix.ing.feature.2': 'Spécialité principale: Génie Logiciel',
      'choix.ing.feature.3': 'Autre spécialité mentionnée: Electronique/Microélectronique',
      'choix.ing.feature.4': 'Capacité Génie Logiciel: 52 internes + 13 externes',
      'choix.ing.button': 'Choisir Ingénieur',
      'choix.back': "Retour à l'accueil",
    },
    en: {
      // Navigation
      'nav.home': 'Home',
      'nav.login': 'Login',
      'nav.logout': 'Logout',

      // Dashboard
      'dashboard.welcome': 'Welcome',
      'dashboard.candidatures': 'Applications',
      'dashboard.profile': 'Profile',

      // Candidatures
      'candidature.numero': 'Application No.',
      'candidature.candidat': 'Candidate',
      'candidature.master': 'Master',
      'candidature.score': 'Score',
      'candidature.statut': 'Status',
      'candidature.actions': 'Actions',
      'candidature.dossier': 'File',
      'candidature.avis': 'Review',

      // Statuts
      'status.soumis': 'Submitted',
      'status.en_attente': 'Pending',
      'status.selectionne': 'Selected',
      'status.rejete': 'Rejected',
      'status.sous_examen': 'Under review',
      'status.preselectionne': 'Preselected',

      // Boutons
      'btn.save': 'Save',
      'btn.cancel': 'Cancel',
      'btn.delete': 'Delete',
      'btn.edit': 'Edit',
      'btn.view': 'View',
      'btn.download': 'Download',
      'btn.add': 'Add',
      'btn.search': 'Search',
      'btn.reset': 'Reset',

      // Formulaires
      'form.email': 'Email address',
      'form.password': 'Password',
      'form.firstname': 'First name',
      'form.lastname': 'Last name',

      // Messages
      'msg.success': 'Operation successful',
      'msg.error': 'An error occurred',
      'msg.confirm': 'Are you sure?',

      // Login page
      'login.back': 'Back to home',
      'login.title': "Admission Platform for Master's and Engineering Programs",
      'login.subtitle': 'ISIMM - Monastir',
      'login.candidate.badge': 'Candidate',
      'login.candidate.title': 'Candidate Area',
      'login.candidate.desc': 'Manage my applications and track my file',
      'login.commission.badge': 'Commission',
      'login.commission.title': 'Commission Area',
      'login.commission.desc': 'Evaluate and manage application files',
      'login.admin.badge': 'Administration',
      'login.admin.title': 'Administration Area',
      'login.admin.desc': 'Administer the platform and users',
      'login.access': 'Access',
      'login.help': 'Help',
      'login.contact': 'Contact',
      'login.privacy': 'Privacy',

      // Masters page
      'masters.hero.title': 'Registration Calls - Masters & Engineering Cycle',
      'masters.hero.subtitle': 'View all offers with their opening status.',
      'masters.hero.mini': 'Research Masters, Professional Masters, Engineering Cycle',
      'masters.referentiel.title': 'Official Reference 2025/2026',
      'masters.referentiel.school': 'Institution',
      'masters.referentiel.year': 'Academic Year',
      'masters.referentiel.loading': 'Loading official details...',
      'masters.card.research.badge': 'Research',
      'masters.card.research.title': 'Research Masters',
      'masters.card.research.desc':
        'Programs focused on scientific research and technological innovation',
      'masters.card.professional.badge': 'Professional',
      'masters.card.professional.title': 'Professional Masters',
      'masters.card.professional.desc':
        'Programs focused on practical skills and professional integration',
      'masters.card.engineer.badge': 'Engineer',
      'masters.card.engineer.title': 'Engineering Cycle',
      'masters.card.engineer.desc':
        'Comprehensive engineering training with varied specializations',
      'masters.capacity.mrgl': 'Official capacity MRGL',
      'masters.capacity.mpgl': 'Official capacity MPGL',
      'masters.capacity.mpds': 'Official capacity MPDS',
      'masters.capacity.places': 'places',
      'masters.engineer.rule': 'Competition rules applied according to official reference',
      'masters.explore': 'Explore',
      'masters.bottom.title': 'LEARN ANYTIME, ANYWHERE',
      'masters.bottom.desc':
        'Each student can access the university platform with an institutional account to consult resources and educational activities from mobile, tablet, or computer.',
      'masters.back': 'Back to home',

      // Login candidat page
      'login.candidat.back': 'Back',
      'login.candidat.mark': 'Admission 2026',
      'login.candidat.title': 'Candidate Area',
      'login.candidat.subtitle': 'Sign in to your account',
      'login.candidat.hint.track': 'File tracking',
      'login.candidat.hint.docs': 'Documents',
      'login.candidat.hint.claims': 'Claims',
      'login.candidat.email.label': 'Email',
      'login.candidat.email.placeholder': 'your.email@example.com',
      'login.candidat.password.label': 'Password',
      'login.candidat.password.placeholder': '••••••••',
      'login.candidat.forgot': 'Forgot password?',
      'login.candidat.submit': 'Sign in',
      'login.candidat.loading': 'Signing in...',
      'login.candidat.noapply': "Haven't applied yet?",
      'login.candidat.postuler': 'Apply for a Master / Engineering Cycle',
      'login.candidat.error.fill': 'Please fill in all fields',
      'login.candidat.error.role': 'This account is not a candidate account',
      'login.candidat.error.invalid': 'Incorrect email or password',

      // Login commission page
      'login.com.back': 'Back',
      'login.com.mark': 'Restricted Area',
      'login.com.title': 'Commission Area',
      'login.com.subtitle': 'Sign in with your credentials',
      'login.com.hint.eval': 'Evaluation',
      'login.com.hint.rank': 'Ranking',
      'login.com.hint.valid': 'Validation',
      'login.com.info': 'Your credentials were sent by email by the administrator',
      'login.com.username.label': 'Username / Email',
      'login.com.username.placeholder': 'Enter your identifier received by email',
      'login.com.password.label': 'Password',
      'login.com.password.placeholder': '••••••••',
      'login.com.submit': 'Sign in',
      'login.com.loading': 'Signing in...',
      'login.com.help.title': 'Connection issue?',
      'login.com.help.text': 'Contact the administrator:',
      'login.com.error.fill': 'Please fill in all fields',
      'login.com.error.role':
        'This account is not a commission account. Please contact the administrator.',
      'login.com.error.invalid': 'Incorrect credentials. Check information received by email.',

      // Login admin page
      'login.admin.back': 'Back',
      'login.admin.mark': 'Secure Area',
      'login.admin.title.page': 'Administration Area',
      'login.admin.subtitle': 'Access reserved for administrators',
      'login.admin.hint.users': 'Users',
      'login.admin.hint.settings': 'Settings',
      'login.admin.hint.control': 'Control',
      'login.admin.warning': 'Secure and monitored access',
      'login.admin.email.label': 'Administrator email',
      'login.admin.email.placeholder': 'admin@isimm.tn',
      'login.admin.password.label': 'Password',
      'login.admin.password.placeholder': '••••••••',
      'login.admin.submit': 'Access administration',
      'login.admin.loading': 'Checking...',
      'login.admin.note': 'Any unauthorized access attempt will be logged',
      'login.admin.error.fill': 'Please fill in all fields',
      'login.admin.error.role': 'Access denied. You are not an administrator.',
      'login.admin.error.invalid': 'Incorrect email or password',

      // Choix candidature page
      'choix.header.title': 'Choose your application type',
      'choix.header.subtitle':
        'Select the program that matches your profile and the official regulation.',
      'choix.master.title': 'Apply for a Master',
      'choix.master.desc':
        'Research and professional masters with tracks MRGL, MRMI, MPGL, MPDS and MP3I.',
      'choix.master.feature.1': '5 tracks: MRGL, MRMI, MPGL, MPDS, MP3I',
      'choix.master.feature.2': 'Research and Professional streams',
      'choix.master.feature.3': 'Application through score-based ranking',
      'choix.master.feature.4': 'Duration: 2 years',
      'choix.master.button': 'Choose Master',
      'choix.ing.title': 'Apply for Engineering Cycle',
      'choix.ing.desc': 'Engineering cycle admission through the official ISIMM competition.',
      'choix.ing.feature.1': 'Admission according to competition regulation',
      'choix.ing.feature.2': 'Main specialty: Software Engineering',
      'choix.ing.feature.3': 'Other mentioned specialty: Electronics/Microelectronics',
      'choix.ing.feature.4': 'Software Engineering capacity: 52 internal + 13 external',
      'choix.ing.button': 'Choose Engineer',
      'choix.back': 'Back to home',
    },
  };

  constructor() {
    const savedLang = localStorage.getItem('language');
    if (savedLang) {
      this.currentLanguage = savedLang;
    }
  }

  setLanguage(lang: string): void {
    this.currentLanguage = lang;
    localStorage.setItem('language', lang);
  }

  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  translate(key: string): string {
    return this.translations[this.currentLanguage][key] || key;
  }
}
