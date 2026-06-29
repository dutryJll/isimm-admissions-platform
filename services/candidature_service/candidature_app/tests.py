from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import (
	CandidatListe,
	Candidature,
	Concours,
	Commission,
	ConfigurationAppel,
	DonneesAcademiques,
	FormuleScore,
	ListeAdmission,
	Master,
	MembreCommission,
	Paiement,
)
from .views import (
	_sync_system_notifications_for_user,
	ajuster_dossier_numerique,
	candidatures_responsable,
	changer_statut_candidature,
	consulter_inscriptions_administratives,
	create_candidature,
	deposer_dossier_numerique,
	formule_score_master,
	modifier_candidature,
	publier_liste,
	update_status,
)
from .notifications import envoyer_rappels_j3_preinscription


class CandidatureWorkflowTests(TestCase):
	def setUp(self):
		self.factory = APIRequestFactory()
		self.user_model = get_user_model()

		self.candidat = self.user_model.objects.create_user(
			username='candidat1',
			email='candidat@example.com',
			password='test12345',
			first_name='Test',
			last_name='Candidat',
		)
		self.candidat.role = 'candidat'

		self.commission = self.user_model.objects.create_user(
			username='commission1',
			email='commission@example.com',
			password='test12345',
			first_name='Test',
			last_name='Commission',
		)
		self.commission.role = 'commission'

		self.responsable = self.user_model.objects.create_user(
			username='responsable1',
			email='responsable@example.com',
			password='test12345',
			first_name='Test',
			last_name='Responsable',
		)
		self.responsable.role = 'responsable_commission'

		self.master = Master.objects.create(
			nom='Master Test',
			type_master='recherche',
			description='Master de test',
			specialite='Genie Logiciel',
			places_disponibles=20,
			date_limite_candidature=date.today() + timedelta(days=30),
			annee_universitaire='2025-2026',
			actif=True,
		)

		self.configuration = ConfigurationAppel.objects.create(
			master=self.master,
			date_debut_visibilite=date.today() - timedelta(days=1),
			date_fin_visibilite=date.today() + timedelta(days=30),
			date_limite_preinscription=date.today() + timedelta(days=15),
			date_limite_depot_dossier=date.today() + timedelta(days=20),
			date_limite_paiement=date.today() + timedelta(days=30),
			delai_modification_candidature_jours=7,
			delai_depot_dossier_preselectionnes_jours=14,
			capacite_accueil=20,
			capacite_liste_attente=30,
			formulaire_commission_schema={
				'required_fields': ['cin', 'telephone'],
				'required_documents': ['releve_notes', 'diplome'],
			},
		)

	@patch('candidature_app.views.envoyer_email_confirmation_candidature')
	def test_create_candidature_sends_confirmation_email(self, mock_confirmation_email):
		request = self.factory.post('/api/candidatures/create/', {'master_id': self.master.id}, format='json')
		force_authenticate(request, user=self.candidat)

		response = create_candidature(request)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Candidature.objects.count(), 1)
		mock_confirmation_email.assert_called_once()

	@patch('candidature_app.views.envoyer_email_changement_statut')
	def test_changer_statut_refuses_invalid_transition(self, mock_email_statut):
		candidature = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis')

		request = self.factory.post(
			f'/api/candidatures/{candidature.id}/changer-statut/',
			{'statut': 'inscrit'},
			format='json',
		)
		force_authenticate(request, user=self.commission)

		response = changer_statut_candidature(request, candidature.id)

		self.assertEqual(response.status_code, 400)
		candidature.refresh_from_db()
		self.assertEqual(candidature.statut, 'soumis')
		mock_email_statut.assert_not_called()

	@patch('candidature_app.views.envoyer_email_changement_statut')
	def test_changer_statut_valid_transition_updates_and_sends_email(self, mock_email_statut):
		candidature = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis')

		request = self.factory.post(
			f'/api/candidatures/{candidature.id}/changer-statut/',
			{'statut': 'sous_examen'},
			format='json',
		)
		force_authenticate(request, user=self.commission)

		response = changer_statut_candidature(request, candidature.id)

		self.assertEqual(response.status_code, 200)
		candidature.refresh_from_db()
		self.assertEqual(candidature.statut, 'sous_examen')
		self.assertTrue(candidature.date_changement_statut is not None)
		self.assertGreaterEqual(len(candidature.historique), 1)
		mock_email_statut.assert_called_once_with(candidature, 'soumis', 'sous_examen')

	@patch('candidature_app.views.envoyer_notifications_masse')
	def test_publier_liste_calls_mass_notifications(self, mock_notifications):
		mock_notifications.return_value = {'envoyes': 1, 'echoues': 0, 'total': 1}

		candidature = Candidature.objects.create(
			candidat=self.candidat,
			master=self.master,
			statut='dossier_depose',
			score=15.5,
		)
		liste = ListeAdmission.objects.create(
			master=self.master,
			type_liste='principale',
			iteration=1,
			annee_universitaire='2025-2026',
			capacite_accueil=20,
			places_restantes=20,
		)
		CandidatListe.objects.create(liste=liste, candidature=candidature, position=1, score=15.5)

		request = self.factory.post(f'/api/candidatures/listes/{liste.id}/publier/', {}, format='json')
		force_authenticate(request, user=self.responsable)

		response = publier_liste(request, liste.id)

		self.assertEqual(response.status_code, 200)
		liste.refresh_from_db()
		self.assertTrue(liste.publiee)
		self.assertIsNotNone(liste.date_publication)
		mock_notifications.assert_called_once_with(liste)

	def test_depot_dossier_refuse_si_statut_non_autorise(self):
		candidature = Candidature.objects.create(
			candidat=self.candidat,
			master=self.master,
			statut='soumis',
		)

		request = self.factory.post(
			f'/api/candidatures/{candidature.id}/deposer-dossier/',
			{
				'formulaire': {
					'cin': '12345678',
					'telephone': '99111222',
					'documents': ['releve_notes', 'diplome'],
				}
			},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = deposer_dossier_numerique(request, candidature.id)

		self.assertEqual(response.status_code, 403)

	def test_depot_dossier_valide_avec_formulaire_commission(self):
		candidature = Candidature.objects.create(
			candidat=self.candidat,
			master=self.master,
			statut='preselectionne',
		)

		request = self.factory.post(
			f'/api/candidatures/{candidature.id}/deposer-dossier/',
			{
				'formulaire': {
					'cin': '12345678',
					'telephone': '99111222',
					'documents': ['releve_notes', 'diplome'],
				}
			},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = deposer_dossier_numerique(request, candidature.id)

		self.assertEqual(response.status_code, 200)
		candidature.refresh_from_db()
		self.assertEqual(candidature.statut, 'dossier_depose')
		self.assertTrue(candidature.dossier_depose)

	@patch('candidature_app.views.creer_notification_avec_email')
	def test_sync_notifications_candidate_open_preinscription_emails(self, mock_notify_email):
		mock_notify_email.return_value = None

		_sync_system_notifications_for_user(self.candidat)

		self.assertTrue(mock_notify_email.called)
		args, kwargs = mock_notify_email.call_args
		self.assertEqual(kwargs['notif_type'], 'info')
		self.assertIn('preinscription-open', kwargs['dedup_key'])

	@patch('candidature_app.notifications.creer_notification_avec_email')
	def test_rappel_j3_preinscription_creates_notification_and_email(self, mock_notify_email):
		mock_notify_email.return_value = None
		candidature = Candidature.objects.create(
			candidat=self.candidat,
			master=self.master,
			statut='selectionne',
		)
		self.configuration.date_limite_preinscription = date.today() + timedelta(days=3)
		self.configuration.save(update_fields=['date_limite_preinscription'])

		envoyer_rappels_j3_preinscription()

		self.assertTrue(mock_notify_email.called)
		args, kwargs = mock_notify_email.call_args
		self.assertEqual(kwargs['notif_type'], 'warning')
		self.assertIn('rappel-j3-preinscription', kwargs['dedup_key'])

	def test_formule_score_master_update_by_responsable(self):
		request = self.factory.put(
			f'/api/candidatures/masters/{self.master.id}/formule-score/',
			{
				'nom': 'Formule commission 2026',
				'coef_moyenne_generale': '0.55',
				'coef_moyenne_specialite': '0.35',
				'coef_note_pfe': '0.10',
				'bonus_mention_tres_bien': '2.00',
				'bonus_mention_bien': '1.00',
				'bonus_mention_assez_bien': '0.50',
				'malus_redoublement': '-1.00',
				'malus_dette': '-0.50',
				'criteres_specifiques': {'experience_pro': {'coefficient': 0.2}},
				'actif': True,
			},
			format='json',
		)
		force_authenticate(request, user=self.responsable)

		response = formule_score_master(request, self.master.id)

		self.assertEqual(response.status_code, 200)
		formule = FormuleScore.objects.get(master=self.master)
		self.assertEqual(str(formule.coef_moyenne_generale), '0.55')

	def test_modifier_candidature_updates_priorite_before_deadline(self):
		candidature = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis')

		request = self.factory.put(
			f'/api/candidatures/{candidature.id}/modifier/',
			{'choix_priorite': 2},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = modifier_candidature(request, candidature.id)

		self.assertEqual(response.status_code, 200)
		candidature.refresh_from_db()
		self.assertEqual(candidature.choix_priorite, 2)

	def test_modifier_candidature_refused_after_deadline(self):
		candidature = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis')
		candidature.date_limite_modification = timezone.now() - timedelta(days=1)
		candidature.save(update_fields=['date_limite_modification'])

		request = self.factory.put(
			f'/api/candidatures/{candidature.id}/modifier/',
			{'choix_priorite': 3},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = modifier_candidature(request, candidature.id)

		self.assertEqual(response.status_code, 403)

	def test_ajuster_dossier_refused_when_deadline_expired(self):
		self.configuration.date_limite_depot_dossier = date.today() - timedelta(days=1)
		self.configuration.save(update_fields=['date_limite_depot_dossier'])

		candidature = Candidature.objects.create(
			candidat=self.candidat,
			master=self.master,
			statut='dossier_depose',
		)

		request = self.factory.put(
			f'/api/candidatures/{candidature.id}/ajuster-dossier/',
			{
				'formulaire': {
					'cin': '12345678',
					'telephone': '99111222',
					'documents': ['releve_notes', 'diplome'],
				}
			},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = ajuster_dossier_numerique(request, candidature.id)

		self.assertEqual(response.status_code, 403)

	def test_consulter_inscriptions_administratives_separe_finalisee_et_incomplete(self):
		candidat2 = self.user_model.objects.create_user(
			username='candidat2',
			email='candidat2@example.com',
			password='test12345',
		)
		candidat2.role = 'candidat'

		c1 = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='selectionne')
		c2 = Candidature.objects.create(candidat=candidat2, master=self.master, statut='selectionne')

		Paiement.objects.create(
			candidature=c1,
			montant=100,
			statut='paye',
			reference_paiement='REF-1',
			date_paiement=self.configuration.date_limite_paiement,
		)

		request = self.factory.get('/api/candidatures/inscriptions-administratives/')
		force_authenticate(request, user=self.responsable)

		response = consulter_inscriptions_administratives(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['stats']['total'], 2)
		self.assertEqual(response.data['stats']['finalisee'], 1)
		self.assertEqual(response.data['stats']['incomplete'], 1)

	def test_score_recalcule_automatiquement_depuis_bac_et_licence(self):
		candidature = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis')

		DonneesAcademiques.objects.create(
			candidature=candidature,
			moyenne_generale=15.0,
			moyenne_specialite=12.0,
			nb_redoublements=0,
			notes_detaillees={
				'source': 'test',
				'formation_code': 'MPGL',
				'moyenne_bac': 12,
				'moyenne_licence': 15,
				'payload': {
					'formation_code': 'MPGL',
					'glDs': {'moy1': 14, 'moy2': 15, 'moy3': 16},
				},
			},
		)

		candidature.save()
		candidature.refresh_from_db()

		# 40% bac + 60% licence = 0.4*12 + 0.6*15 = 13.8
		self.assertEqual(float(candidature.score), 13.8)

	def test_candidatures_responsable_sont_triees_par_score_desc(self):
		commission = Commission.objects.create(master=self.master, nom='Commission Test', actif=True)
		MembreCommission.objects.create(commission=commission, user=self.responsable, role='responsable', actif=True)

		candidat2 = self.user_model.objects.create_user(
			username='cand2',
			email='cand2@example.com',
			password='test12345',
		)
		candidat2.role = 'candidat'

		candidat3 = self.user_model.objects.create_user(
			username='cand3',
			email='cand3@example.com',
			password='test12345',
		)
		candidat3.role = 'candidat'

		c1 = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis', score=12.5)
		c2 = Candidature.objects.create(candidat=candidat2, master=self.master, statut='soumis', score=16.2)
		c3 = Candidature.objects.create(candidat=candidat3, master=self.master, statut='soumis', score=14.1)

		request = self.factory.get('/api/candidatures/responsable/candidatures/')
		force_authenticate(request, user=self.responsable)
		response = candidatures_responsable(request)

		self.assertEqual(response.status_code, 200)
		returned_ids = [item['id'] for item in response.data]
		self.assertEqual(returned_ids, [c2.id, c3.id, c1.id])

	def test_update_status_positionne_preselectionne(self):
		commission = Commission.objects.create(master=self.master, nom='Commission Validation', actif=True)
		MembreCommission.objects.create(commission=commission, user=self.commission, role='membre', actif=True)

		candidature = Candidature.objects.create(candidat=self.candidat, master=self.master, statut='sous_examen')

		request = self.factory.post(f'/api/candidatures/{candidature.id}/update-status/', {}, format='json')
		force_authenticate(request, user=self.commission)

		response = update_status(request, candidature.id)

		self.assertEqual(response.status_code, 200)
		candidature.refresh_from_db()
		self.assertEqual(candidature.statut, 'preselectionne')
		self.assertFalse(candidature.peut_modifier)

	def test_create_candidature_rejette_notes_superieures_a_20(self):
		request = self.factory.post(
			'/api/candidatures/create/',
			{
				'master_id': self.master.id,
				'formation_code': 'MPGL',
				'academic_data': {
					'common': {'session': 'principale', 'redoublements': 0},
					'glDs': {'moy1': 21, 'moy2': 15, 'moy3': 14},
				},
			},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = create_candidature(request)

		self.assertEqual(response.status_code, 400)
		self.assertIn('0 et 20', str(response.data.get('error', '')))
		self.assertEqual(Candidature.objects.filter(candidat=self.candidat).count(), 1)

	def test_create_candidature_persiste_donnees_preinscription_et_calcule_score(self):
		request = self.factory.post(
			'/api/candidatures/create/',
			{
				'master_id': self.master.id,
				'formation_code': 'MP3I',
				'selected_diplome': 'Licence en Informatique',
				'etablissement_origine': 'ISIMM',
				'diplome_reference': 'Licence',
				'diplomes': [
					{
						'intitule': 'Licence en Informatique',
						'etablissement': 'ISIMM',
						'annee': '2025',
					}
				],
				'academic_data': {
					'common': {'session': 'principale', 'redoublements': 0},
					'i3': {'moyBac': 12, 'moyL1': 14, 'moyL2': 16, 'moyL3': 18},
				},
			},
			format='json',
		)
		force_authenticate(request, user=self.candidat)

		response = create_candidature(request)

		self.assertEqual(response.status_code, 201)
		candidature_id = response.data['id']
		candidature = Candidature.objects.get(id=candidature_id)
		donnees = DonneesAcademiques.objects.get(candidature=candidature)

		self.assertEqual(donnees.notes_detaillees.get('selected_diplome'), 'Licence en Informatique')
		self.assertEqual(donnees.notes_detaillees.get('etablissement_origine'), 'ISIMM')
		self.assertEqual(donnees.notes_detaillees.get('formation_code'), 'MP3I')

		# Bac=12, Licence=(14+16+18)/3=16 => score=0.4*12 + 0.6*16 = 14.4
		self.assertAlmostEqual(float(candidature.score), 14.4, places=2)

	def test_candidatures_responsable_filtre_type_ingenieur(self):
		commission = Commission.objects.create(master=self.master, nom='Commission Type', actif=True)
		MembreCommission.objects.create(commission=commission, user=self.responsable, role='responsable', actif=True)

		concours = Concours.objects.create(
			nom='Concours Ingenieur 2026',
			type_concours='ingenieur',
			description='Concours test',
			date_ouverture=date.today() - timedelta(days=1),
			date_cloture=date.today() + timedelta(days=10),
			places_disponibles=30,
			actif=True,
		)

		candidat2 = self.user_model.objects.create_user(
			username='cand_type',
			email='cand_type@example.com',
			password='test12345',
		)
		candidat2.role = 'candidat'

		Candidature.objects.create(candidat=self.candidat, master=self.master, statut='soumis', score=11.0)
		candidature_ing = Candidature.objects.create(
			candidat=candidat2,
			master=self.master,
			statut='soumis',
			score=15.0,
			concours=concours,
		)

		request = self.factory.get('/api/candidatures/responsable/candidatures/?type=ingenieur')
		force_authenticate(request, user=self.responsable)
		response = candidatures_responsable(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['id'], candidature_ing.id)
		self.assertEqual(response.data[0]['type_concours'], 'ingenieur')
