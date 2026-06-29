from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import Candidature, Commission, ConfigurationAppel, CandidatListe, ListeAdmission, Master, MembreCommission
from .views import (
    ajuster_dossier_numerique,
    create_candidature,
    get_my_commissions,
    mes_candidatures,
    modifier_candidature,
    deposer_dossier_numerique,
    publier_liste,
)


class Sprint23CandidatureFlowTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user_model = get_user_model()

        self.candidat = self.user_model.objects.create_user(
            username='candidat_s23',
            email='candidat.s23@isimm.tn',
            password='test12345',
            first_name='Candidat',
            last_name='Sprint23',
        )
        self.candidat.role = 'candidat'

        self.commission_user = self.user_model.objects.create_user(
            username='commission_s23',
            email='commission.s23@isimm.tn',
            password='test12345',
            first_name='Commission',
            last_name='Sprint23',
        )
        self.commission_user.role = 'commission'

        self.responsable_user = self.user_model.objects.create_user(
            username='responsable_s23',
            email='responsable.s23@isimm.tn',
            password='test12345',
            first_name='Responsable',
            last_name='Sprint23',
        )
        self.responsable_user.role = 'responsable_commission'

        self.master = Master.objects.create(
            nom='Master Sprint 23',
            type_master='professionnel',
            description='Master de test pour Sprint 2/3',
            specialite='Génie Logiciel',
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

        self.commission = Commission.objects.create(
            master=self.master,
            nom='Commission Sprint 23',
            description='Commission de test',
            actif=True,
        )
        membership = MembreCommission.objects.create(
            commission=self.commission,
            user=self.commission_user,
            role='membre',
            actif=True,
        )
        membership.commissions.add(self.commission)

    def _create_candidature(self, user=None, statut='soumis'):
        return Candidature.objects.create(
            candidat=user or self.candidat,
            master=self.master,
            statut=statut,
            choix_priorite=1,
        )

    def _auth(self, request, user=None):
        force_authenticate(request, user=user or self.candidat)
        return request

    def test_create_and_consult_candidature_sprint2(self):
        request = self._auth(
            self.factory.post('/api/candidatures/create/', {'master_id': self.master.id}, format='json'),
            self.candidat,
        )

        response = create_candidature(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Candidature.objects.filter(candidat=self.candidat, master=self.master).count(), 1)

        request = self._auth(self.factory.get('/api/candidatures/mes-candidatures/'), self.candidat)
        response = mes_candidatures(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['master'], self.master.id)
        self.assertEqual(response.data[0]['statut'], 'soumis')

    def test_modifier_candidature_before_deadline_sprint2(self):
        candidature = self._create_candidature(statut='soumis')
        candidature.date_limite_modification = timezone.now() + timedelta(days=2)
        candidature.save(update_fields=['date_limite_modification'])

        request = self._auth(
            self.factory.put(
                f'/api/candidatures/{candidature.id}/modifier/',
                {'choix_priorite': 2},
                format='json',
            ),
            self.candidat,
        )

        response = modifier_candidature(request, candidature.id)

        self.assertEqual(response.status_code, 200)
        candidature.refresh_from_db()
        self.assertEqual(candidature.choix_priorite, 2)

    def test_get_my_commissions_returns_active_commission(self):
        request = self._auth(self.factory.get('/api/candidatures/my-commissions/'), self.commission_user)

        response = get_my_commissions(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['commissions'][0]['id'], self.commission.id)

    def test_deposer_and_ajuster_dossier_sprint3(self):
        candidature = self._create_candidature(statut='preselectionne')

        deposit_request = self._auth(
            self.factory.post(
                f'/api/candidatures/{candidature.id}/deposer-dossier/',
                {
                    'formulaire': {
                        'cin': '12345678',
                        'telephone': '99111222',
                        'documents': ['releve_notes', 'diplome'],
                    }
                },
                format='json',
            ),
            self.candidat,
        )
        deposit_response = deposer_dossier_numerique(deposit_request, candidature.id)

        self.assertEqual(deposit_response.status_code, 200)
        candidature.refresh_from_db()
        self.assertEqual(candidature.statut, 'dossier_depose')
        self.assertTrue(candidature.dossier_depose)

        candidature.statut = 'preselectionne'
        candidature.date_limite_modification = timezone.now() + timedelta(days=2)
        candidature.save(update_fields=['statut', 'date_limite_modification'])

        adjust_request = self._auth(
            self.factory.put(
                f'/api/candidatures/{candidature.id}/ajuster-dossier/',
                {
                    'formulaire': {
                        'cin': '12345678',
                        'telephone': '99111222',
                        'documents': ['releve_notes', 'diplome'],
                    }
                },
                format='json',
            ),
            self.candidat,
        )
        adjust_response = ajuster_dossier_numerique(adjust_request, candidature.id)

        self.assertEqual(adjust_response.status_code, 200)
        candidature.refresh_from_db()
        self.assertEqual(candidature.statut, 'dossier_depose')

    @patch('candidature_app.views.envoyer_notifications_masse')
    def test_publier_liste_sprint3(self, mock_notifications):
        mock_notifications.return_value = {'envoyes': 1, 'echoues': 0, 'total': 1}

        candidature = self._create_candidature(statut='dossier_depose')
        liste = ListeAdmission.objects.create(
            master=self.master,
            type_liste='principale',
            iteration=1,
            annee_universitaire='2025-2026',
            capacite_accueil=20,
            places_restantes=19,
        )
        CandidatListe.objects.create(liste=liste, candidature=candidature, position=1, score=15.5)

        request = self._auth(self.factory.post(f'/api/candidatures/listes/{liste.id}/publier/', {}, format='json'), self.responsable_user)
        response = publier_liste(request, liste.id)

        self.assertEqual(response.status_code, 200)
        liste.refresh_from_db()
        self.assertTrue(liste.publiee)
        mock_notifications.assert_called_once_with(liste)
