from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from .models import Candidature, ListeAdmission, CandidatListe, Master, Paiement
from collections import defaultdict

try:
    import pandas as pd
except ImportError:
    pd = None


class StatutService:
    """Centralise la normalisation et les transitions de statuts candidature."""

    STATUS_ALIASES = {
        'soumis': 'soumis',
        'sous_examen': 'sous_examen',
        'preselectionne': 'preselectionne',
        'présélectionné': 'preselectionne',
        'presélectionné': 'preselectionne',
        'preselectionné': 'preselectionne',
        'admissible': 'preselectionne',
        'en_attente_dossier': 'en_attente_dossier',
        'dossier_non_depose': 'dossier_non_depose',
        'dossier_depose': 'dossier_depose',
        'en_attente': 'en_attente',
        'selectionne': 'selectionne',
        'inscrit': 'inscrit',
        'rejete': 'rejete',
        'annule': 'annule',
    }

    ALLOWED_TRANSITIONS = {
        'soumis': {'sous_examen', 'preselectionne', 'rejete', 'annule'},
        'sous_examen': {'preselectionne', 'en_attente_dossier', 'rejete'},
        'preselectionne': {'en_attente_dossier', 'selectionne', 'inscrit', 'rejete'},
        'en_attente_dossier': {'dossier_depose', 'dossier_non_depose', 'rejete'},
        'dossier_depose': {'en_attente', 'selectionne', 'inscrit', 'rejete'},
        'en_attente': {'selectionne', 'inscrit', 'rejete', 'annule'},
        'selectionne': {'inscrit', 'rejete'},
        'dossier_non_depose': {'en_attente_dossier', 'rejete'},
        'annule': set(),
        'rejete': set(),
        'inscrit': set(),
    }

    @classmethod
    def normalize_status(cls, value):
        key = str(value or '').strip().lower()
        return cls.STATUS_ALIASES.get(key)

    @classmethod
    def allowed_transitions_for(cls, old_status):
        return cls.ALLOWED_TRANSITIONS.get(str(old_status or '').strip().lower(), set())

    @classmethod
    @transaction.atomic
    def change_candidature_status(
        cls,
        candidature,
        requested_status,
        actor=None,
        commentaire='Changement de statut via StatutService',
        motif_rejet='',
    ):
        old_status = str(candidature.statut or '').strip().lower()
        new_status = cls.normalize_status(requested_status)

        if not new_status:
            valid_targets = sorted(set(cls.STATUS_ALIASES.values()))
            raise ValueError(f"Statut invalide: {requested_status}. Valeurs: {', '.join(valid_targets)}")

        if old_status == new_status:
            return False, candidature, old_status, new_status

        allowed = cls.allowed_transitions_for(old_status)
        if new_status not in allowed:
            raise ValueError(f'Transition interdite: {old_status} -> {new_status}')

        candidature.statut = new_status
        candidature.date_changement_statut = timezone.now()
        candidature.peut_modifier = new_status not in ['sous_examen', 'preselectionne', 'selectionne', 'inscrit']

        if new_status == 'rejete':
            candidature.motif_rejet = str(motif_rejet or '').strip() or 'Refus commission.'
        elif candidature.motif_rejet:
            candidature.motif_rejet = ''

        candidature.save(update_fields=['statut', 'date_changement_statut', 'peut_modifier', 'motif_rejet', 'updated_at'])

        if actor is not None:
            candidature.ajouter_historique(old_status, new_status, actor, commentaire)

        return True, candidature, old_status, new_status

class GestionListesService:
    
    @staticmethod
    @transaction.atomic
    def generer_liste_principale(master, iteration=1):
        """Générer la liste principale à partir des candidats éligibles (score décroissant)."""
        annee = timezone.now().year
        config = master.configuration
        
        candidatures = Candidature.objects.filter(
            master=master,
            statut='dossier_depose',
            score__isnull=False
        ).select_related('donnees_academiques').order_by('-score', 'date_soumission')
        
        if iteration > 1:
            candidatures = candidatures.exclude(statut='inscrit')
        
        liste_principale = ListeAdmission.objects.create(
            master=master,
            type_liste='principale',
            iteration=iteration,
            annee_universitaire=f"{annee}/{annee+1}",
            capacite_accueil=config.capacite_accueil,
            places_restantes=config.capacite_accueil
        )
        
        position = 1
        for candidature in candidatures[:config.capacite_accueil]:
            CandidatListe.objects.create(
                liste=liste_principale,
                candidature=candidature,
                position=position,
                score=candidature.score
            )
            
            candidature.statut = 'preselectionne'
            candidature.save()
            
            position += 1
        
        GestionListesService.generer_liste_attente(
            master, 
            candidatures[config.capacite_accueil:],
            iteration
        )
        
        return liste_principale
    
    @staticmethod
    @transaction.atomic
    def generer_liste_attente(master, candidatures_restantes, iteration=1):
        """Générer la liste d'attente"""
        annee = timezone.now().year
        config = master.configuration
        
        liste_attente = ListeAdmission.objects.create(
            master=master,
            type_liste='attente',
            iteration=iteration,
            annee_universitaire=f"{annee}/{annee+1}",
            capacite_accueil=config.capacite_liste_attente,
            places_restantes=config.capacite_liste_attente
        )
        
        position = 1
        for candidature in candidatures_restantes[:config.capacite_liste_attente]:
            CandidatListe.objects.create(
                liste=liste_attente,
                candidature=candidature,
                position=position,
                score=candidature.score
            )
            
            candidature.statut = 'en_attente'
            candidature.save()
            
            position += 1
        
        return liste_attente


class ImportPaiementService:

    @staticmethod
    def _normaliser_colonnes(df):
        mapping = {}
        for col in df.columns:
            key = str(col).strip().lower()
            key = key.replace('é', 'e').replace('è', 'e').replace('ê', 'e').replace('à', 'a').replace('ù', 'u')
            key = key.replace(' ', '_')
            mapping[col] = key
        return df.rename(columns=mapping)

    @staticmethod
    def _extraire_valeur(row, candidates, default=None):
        for c in candidates:
            if c in row and row[c] is not None and str(row[c]).strip() != '':
                return row[c]
        return default
    
    @staticmethod
    def importer_fichier_excel(fichier_path):
        """Importer un fichier Excel de www.inscription.tn"""
        if pd is None:
            return {
                'success': 0,
                'errors': 1,
                'details': [{'erreur': 'pandas n est pas installe dans cet environnement'}],
            }

        try:
            df = pd.read_excel(fichier_path)
            df = ImportPaiementService._normaliser_colonnes(df)
            
            resultats = {
                'success': 0,
                'errors': 0,
                'details': [],
                'processed': 0,
                'on_time': 0,
                'late': 0,
            }
            
            for index, row in df.iterrows():
                try:
                    cin = str(
                        ImportPaiementService._extraire_valeur(
                            row,
                            ['cin', 'numero_cin', 'num_cin'],
                            '',
                        )
                    ).strip()
                    reference = str(
                        ImportPaiementService._extraire_valeur(
                            row,
                            ['reference', 'reference_paiement', 'numero_reference'],
                            '',
                        )
                    ).strip()
                    date_paiement_raw = ImportPaiementService._extraire_valeur(
                        row,
                        ['date_paiement', 'date'],
                        None,
                    )
                    montant = ImportPaiementService._extraire_valeur(
                        row,
                        ['montant', 'montant_paye', 'amount'],
                        0,
                    )

                    if not cin or not reference:
                        raise ValueError('Colonnes obligatoires manquantes: CIN/Reference')

                    date_paiement = pd.to_datetime(date_paiement_raw) if date_paiement_raw is not None else timezone.now()
                    
                    candidature = Candidature.objects.filter(
                        candidat__cin=cin,
                        statut__in=['selectionne', 'inscrit']
                    ).select_related('master', 'master__configuration').order_by('-updated_at').first()
                    
                    if not candidature:
                        resultats['errors'] += 1
                        resultats['details'].append({
                            'ligne': index + 2,
                            'cin': cin,
                            'erreur': 'Candidature non trouvée'
                        })
                        continue
                    
                    paiement, created = Paiement.objects.get_or_create(
                        candidature=candidature,
                        defaults={
                            'montant': montant,
                            'statut': 'en_attente'
                        }
                    )

                    try:
                        date_limite = candidature.master.configuration.date_limite_paiement
                    except Exception:
                        date_limite = None

                    paiement.reference_paiement = reference
                    paiement.date_paiement = date_paiement
                    paiement.montant = montant
                    paiement.statut = 'paye'
                    paiement.fichier_import = fichier_path
                    paiement.date_import = timezone.now()
                    paiement.save()

                    on_time = True
                    if date_limite is not None and getattr(date_paiement, 'date', None):
                        on_time = date_paiement.date() <= date_limite

                    if on_time:
                        candidature.statut = 'inscrit'
                        candidature.save(update_fields=['statut', 'updated_at'])
                        resultats['on_time'] += 1
                    else:
                        # Paiement enregistre mais hors delai: inscription administrative incomplete.
                        if candidature.statut == 'inscrit':
                            candidature.statut = 'selectionne'
                            candidature.save(update_fields=['statut', 'updated_at'])
                        resultats['late'] += 1
                    
                    resultats['processed'] += 1
                    resultats['success'] += 1
                    resultats['details'].append(
                        {
                            'ligne': index + 2,
                            'cin': cin,
                            'candidature_id': candidature.id,
                            'master': candidature.master.nom,
                            'date_limite': str(date_limite) if date_limite else None,
                            'date_paiement': str(date_paiement),
                            'paiement_dans_delai': on_time,
                        }
                    )
                    
                except Exception as e:
                    resultats['errors'] += 1
                    resultats['details'].append({
                        'ligne': index + 2,
                        'erreur': str(e)
                    })
            
            return resultats
            
        except Exception as e:
            return {
                'success': 0,
                'errors': 1,
                'details': [{'erreur': f'Erreur lecture fichier: {str(e)}'}]
            }


class VerificationPaiementService:

    @staticmethod
    def consulter_statuts_inscription(master_id=None):
        """
        Retourne les listes des candidats admis:
        - inscription_finalisee: paiement effectue dans le delai commission
        - inscription_incomplete: non paye ou paiement hors delai
        """
        qs = Candidature.objects.filter(statut__in=['selectionne', 'inscrit']).select_related(
            'candidat',
            'master',
            'master__configuration',
        )
        if master_id:
            qs = qs.filter(master_id=master_id)

        finalisee = []
        incomplete = []

        for candidature in qs:
            paiement = getattr(candidature, 'paiement', None)
            date_limite = None
            try:
                date_limite = candidature.master.configuration.date_limite_paiement
            except Exception:
                date_limite = None

            record = {
                'candidature_id': candidature.id,
                'numero': candidature.numero,
                'candidat_id': candidature.candidat_id,
                'cin': getattr(candidature.candidat, 'cin', None),
                'email': getattr(candidature.candidat, 'email', None),
                'master_id': candidature.master_id,
                'master': candidature.master.nom,
                'statut_candidature': candidature.statut,
                'date_limite_paiement': str(date_limite) if date_limite else None,
                'paiement_statut': getattr(paiement, 'statut', 'non_paye') if paiement else 'non_paye',
                'date_paiement': str(getattr(paiement, 'date_paiement', None)) if paiement else None,
                'reference_paiement': getattr(paiement, 'reference_paiement', None) if paiement else None,
            }

            if not paiement or paiement.statut != 'paye':
                record['motif'] = 'paiement_non_effectue'
                incomplete.append(record)
                continue

            if date_limite is not None and paiement.date_paiement and paiement.date_paiement.date() > date_limite:
                record['motif'] = 'paiement_hors_delai'
                incomplete.append(record)
                continue

            record['motif'] = 'inscription_finalisee'
            finalisee.append(record)

        return {
            'inscription_finalisee': finalisee,
            'inscription_incomplete': incomplete,
            'stats': {
                'total': len(finalisee) + len(incomplete),
                'finalisee': len(finalisee),
                'incomplete': len(incomplete),
            },
        }
    
    @staticmethod
    @transaction.atomic
    def verifier_paiements_liste(liste_admission):
        """Vérifier les paiements pour une liste"""
        resultats = {
            'verifies': 0,
            'payes': 0,
            'non_payes_elimines': 0,
            'inscrits_ailleurs_elimines': 0,
            'places_liberees': 0
        }
        
        candidats_liste = liste_admission.candidats.all()
        
        for candidat_liste in candidats_liste:
            candidature = candidat_liste.candidature
            resultats['verifies'] += 1
            
            if VerificationPaiementService._est_inscrit_ailleurs(candidature):
                candidat_liste.delete()
                candidature.statut = 'inscrit'
                candidature.save()
                
                resultats['inscrits_ailleurs_elimines'] += 1
                resultats['places_liberees'] += 1
                continue
            
            try:
                paiement = Paiement.objects.get(candidature=candidature)
                
                if paiement.statut == 'paye':
                    candidat_liste.a_paye = True
                    candidat_liste.date_paiement = paiement.date_paiement
                    candidat_liste.save()
                    resultats['payes'] += 1
                else:
                    date_limite = liste_admission.date_publication + timedelta(days=7)
                    
                    if timezone.now().date() > date_limite.date():
                        candidat_liste.delete()
                        candidature.statut = 'en_attente'
                        candidature.save()
                        
                        resultats['non_payes_elimines'] += 1
                        resultats['places_liberees'] += 1
            
            except Paiement.DoesNotExist:
                date_limite = liste_admission.date_publication + timedelta(days=7)
                
                if timezone.now().date() > date_limite.date():
                    candidat_liste.delete()
                    candidature.statut = 'en_attente'
                    candidature.save()
                    
                    resultats['non_payes_elimines'] += 1
                    resultats['places_liberees'] += 1
        
        liste_admission.places_restantes = resultats['places_liberees']
        liste_admission.save()
        
        return resultats
    
    @staticmethod
    def _est_inscrit_ailleurs(candidature):
        """Vérifier si le candidat est déjà inscrit dans un autre master"""
        candidatures_candidat = Candidature.objects.filter(
            candidat=candidature.candidat,
            statut='inscrit'
        ).exclude(id=candidature.id)
        
        if not candidatures_candidat.exists():
            return False
        
        for autre_candidature in candidatures_candidat:
            if autre_candidature.choix_priorite < candidature.choix_priorite:
                return True
        
        return False

    @staticmethod
    @transaction.atomic
    def generer_liste_suivante_si_necessaire(liste_admission):
        """
        Génère automatiquement une 2ème/3ème liste principale si des places sont libérées,
        en puisant dans la liste d'attente active.
        """
        if liste_admission.type_liste != 'principale':
            return None

        places_a_combler = max(0, int(liste_admission.places_restantes or 0))
        if places_a_combler == 0:
            return None

        liste_attente_active = ListeAdmission.objects.filter(
            master=liste_admission.master,
            type_liste='attente',
            active=True,
        ).order_by('-iteration', '-date_creation').first()

        if not liste_attente_active:
            return None

        attente_qs = liste_attente_active.candidats.select_related('candidature').order_by('position')
        promus = list(attente_qs[:places_a_combler])
        if not promus:
            return None

        nouvelle_iteration = liste_admission.iteration + 1
        annee = timezone.now().year

        nouvelle_liste = ListeAdmission.objects.create(
            master=liste_admission.master,
            type_liste='principale',
            iteration=nouvelle_iteration,
            annee_universitaire=f"{annee}/{annee+1}",
            capacite_accueil=len(promus),
            places_restantes=0,
            active=True,
            publiee=False,
        )

        for idx, candidat_liste in enumerate(promus, start=1):
            candidature = candidat_liste.candidature
            CandidatListe.objects.create(
                liste=nouvelle_liste,
                candidature=candidature,
                position=idx,
                score=candidat_liste.score,
            )
            candidature.statut = 'selectionne'
            candidature.save(update_fields=['statut', 'updated_at'])
            candidat_liste.delete()

        reste_attente = list(attente_qs[len(promus):])
        if reste_attente:
            nouvelle_attente = ListeAdmission.objects.create(
                master=liste_admission.master,
                type_liste='attente',
                iteration=nouvelle_iteration,
                annee_universitaire=f"{annee}/{annee+1}",
                capacite_accueil=len(reste_attente),
                places_restantes=len(reste_attente),
                active=True,
                publiee=False,
            )
            for idx, old_item in enumerate(reste_attente, start=1):
                CandidatListe.objects.create(
                    liste=nouvelle_attente,
                    candidature=old_item.candidature,
                    position=idx,
                    score=old_item.score,
                )

        liste_attente_active.active = False
        liste_attente_active.save(update_fields=['active'])

        return nouvelle_liste

    @staticmethod
    @transaction.atomic
    def evaluer_cloture_ou_relance(master):
        """
        Point 13 - clôture ou relance:
        - si capacité atteinte: clôture + publication liste définitive
        - sinon: relance via génération d'une nouvelle itération à partir de la liste d'attente
        """
        try:
            capacite = int(master.configuration.capacite_accueil)
        except Exception:
            capacite = int(master.places_disponibles or 0)

        nb_inscrits = Candidature.objects.filter(master=master, statut='inscrit').count()
        reste_a_pourvoir = max(0, capacite - nb_inscrits)

        derniere_principale = ListeAdmission.objects.filter(
            master=master,
            type_liste='principale',
            active=True,
        ).order_by('-iteration', '-date_creation').first()

        if reste_a_pourvoir == 0:
            if derniere_principale and not derniere_principale.publiee:
                derniere_principale.publiee = True
                derniere_principale.date_publication = timezone.now()
                derniere_principale.save(update_fields=['publiee', 'date_publication', 'updated_at'])

            ListeAdmission.objects.filter(master=master, active=True).update(active=False)

            return {
                'cloturee': True,
                'relance': False,
                'capacite_accueil': capacite,
                'nb_inscrits': nb_inscrits,
                'message': 'Capacite atteinte: procedure cloturee et liste definitive publiee.',
            }

        if not derniere_principale:
            return {
                'cloturee': False,
                'relance': False,
                'capacite_accueil': capacite,
                'nb_inscrits': nb_inscrits,
                'message': 'Aucune liste principale active a relancer.',
            }

        derniere_principale.places_restantes = max(
            int(derniere_principale.places_restantes or 0),
            reste_a_pourvoir,
        )
        derniere_principale.save(update_fields=['places_restantes', 'updated_at'])

        nouvelle_liste = VerificationPaiementService.generer_liste_suivante_si_necessaire(derniere_principale)
        if not nouvelle_liste:
            return {
                'cloturee': False,
                'relance': False,
                'capacite_accueil': capacite,
                'nb_inscrits': nb_inscrits,
                'reste_a_pourvoir': reste_a_pourvoir,
                'message': 'Capacite non atteinte mais aucune relance possible (liste attente vide).',
            }

        return {
            'cloturee': False,
            'relance': True,
            'capacite_accueil': capacite,
            'nb_inscrits': nb_inscrits,
            'reste_a_pourvoir': reste_a_pourvoir,
            'iteration_generee': nouvelle_liste.iteration,
            'nouvelle_liste_id': nouvelle_liste.id,
            'nb_promus': nouvelle_liste.candidats.count(),
            'message': (
                'Capacite non atteinte: relance effectuee et nouvelle liste principale generee.'
            ),
        }


class SelectionCandidatsService:
    
    @staticmethod
    def selectionner_candidats_par_specialite(master):
        """
        Sélection des candidats admis (article 12):
        - candidats éligibles uniquement
        - classement séparé par spécialité
        - score décroissant
        - affectation par ordre de préférence (choix 1 -> choix 2 -> choix 3)
        - candidats non affectés basculent en liste d'attente
        """
        config = master.configuration

        candidatures_eligibles = Candidature.objects.filter(
            master=master,
            statut='dossier_depose',
            dossier_depose=True,
            score__isnull=False,
        ).select_related('candidat', 'donnees_academiques')

        candidatures_par_specialite = defaultdict(list)

        for candidature in candidatures_eligibles:
            specialite = (candidature.master.specialite or '').strip().lower()
            if hasattr(candidature, 'donnees_academiques') and candidature.donnees_academiques:
                details = candidature.donnees_academiques.notes_detaillees or {}
                specialite = (
                    str(details.get('specialite_cible') or details.get('specialite') or specialite)
                    .strip()
                    .lower()
                )

            candidatures_par_specialite[specialite or 'non_renseignee'].append(candidature)

        liste_principale_finale = []
        liste_attente_finale = []

        nb_groupes = max(1, len(candidatures_par_specialite))
        capacite_totale = int(config.capacite_accueil)
        base_capacite = capacite_totale // nb_groupes
        reste = capacite_totale % nb_groupes

        groupes_ordonnes = sorted(
            candidatures_par_specialite.items(),
            key=lambda item: len(item[1]),
            reverse=True,
        )

        for idx_groupe, (_, candidatures) in enumerate(groupes_ordonnes):
            candidatures_triees = sorted(
                candidatures,
                key=lambda c: (-float(c.score), c.date_soumission)
            )

            capacite_specialite = base_capacite + (1 if idx_groupe < reste else 0)
            places_disponibles = capacite_specialite

            # CHOIX 1 en priorité
            for candidature in candidatures_triees:
                if candidature.choix_priorite == 1 and places_disponibles > 0:
                    liste_principale_finale.append(candidature)
                    places_disponibles -= 1

            # CHOIX 2
            if places_disponibles > 0:
                for candidature in candidatures_triees:
                    if candidature.choix_priorite == 2 and places_disponibles > 0:
                        if candidature not in liste_principale_finale:
                            liste_principale_finale.append(candidature)
                            places_disponibles -= 1

            # CHOIX 3
            if places_disponibles > 0:
                for candidature in candidatures_triees:
                    if candidature.choix_priorite == 3 and places_disponibles > 0:
                        if candidature not in liste_principale_finale:
                            liste_principale_finale.append(candidature)
                            places_disponibles -= 1

            for candidature in candidatures_triees:
                if candidature not in liste_principale_finale:
                    liste_attente_finale.append(candidature)

        return {
            'liste_principale': liste_principale_finale,
            'liste_attente': liste_attente_finale
        }