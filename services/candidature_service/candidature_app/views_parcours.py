"""Views CRUD pour la gestion des Parcours d'Admission par l'Admin."""

import logging
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from candidature_app.models import (
    ParcoursAdmission,
    Master,
    CritereEvaluation,
    ValeurCritere,
)
from candidature_app.serializers import (
    ParcoursAdmissionSerializer,
    ValeurCritereSerializer,
)

logger = logging.getLogger(__name__)


def generer_criteres_pour_type(parcours_type):
    """Génère une liste de critères par défaut selon le type de parcours.
    
    Retourne une liste de codes de critères préconfigurés.
    """
    criteres_par_type = {
        'pro': [
            'moyenne_licence',
            'moyenne_bac',
            'redoublements',
        ],
        'recherche': [
            'moyenne_licence',
            'moyenne_bac',
            'note_math_bac',
            'redoublements',
            'bonus_langue',
            'bonus_diplome',
        ],
        'ingenieur': [
            'moyenne_m1',
            'moyenne_m2',
            'moyenne_m3',
            'rang1',
            'rang2',
        ],
    }
    return criteres_par_type.get(parcours_type, [])


def creer_valeurs_critere_pour_parcours(parcours, type_parcours):
    """Crée les ValeurCritere vides (coefficient = 1.0) pour un nouveau parcours.
    
    Cela permet au Responsable de remplir les coefficients sans intervention du code.
    """
    codes = generer_criteres_pour_type(type_parcours)
    
    for code in codes:
        try:
            critere = CritereEvaluation.objects.get(code=code)
            # Vérifier si elle existe déjà
            if not ValeurCritere.objects.filter(parcours=parcours, critere=critere).exists():
                ValeurCritere.objects.create(
                    parcours=parcours,
                    critere=critere,
                    coefficient=1.0,
                )
        except CritereEvaluation.DoesNotExist:
            logger.warning(f"CritereEvaluation '{code}' not found for type '{type_parcours}'")


class ParcoursAdmissionViewSet(viewsets.ModelViewSet):
    """CRUD pour les Parcours d'Admission (Admin only).
    
    - Admin: CRUD complet
    - Responsable: lecture seule des parcours 'ouvert' ou 'brouillon'
    - Candidat: lecture seule des parcours 'ouvert'
    """
    queryset = ParcoursAdmission.objects.select_related('master').order_by('-updated_at')
    serializer_class = ParcoursAdmissionSerializer
    permission_classes = []  # Will be set dynamically in get_permissions()

    def get_queryset(self):
        """Filtrer selon le rôle de l'utilisateur."""
        user = self.request.user
        
        # Superuser/Admin: voir tous
        if user and (user.is_staff or user.is_superuser):
            return ParcoursAdmission.objects.select_related('master').all()
        
        # Anonymous/Candidat: voir que les 'ouvert'
        return ParcoursAdmission.objects.filter(statut='ouvert').select_related('master')

    def get_permissions(self):
        """Seul l'admin peut créer/modifier/supprimer."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'generate_criteres']:
            return [IsAuthenticated(), IsAdminUser()]
        # Lecture: publique pour 'ouvert', authentification pour brouillon/fermé
        if self.action in ['list', 'retrieve']:
            return []  # Anonymous allowed
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Créer un nouveau parcours et générer automatiquement les ValeurCritere."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        parcours = serializer.save()
        
        # Générer automatiquement les ValeurCritere selon le type
        creer_valeurs_critere_pour_parcours(parcours, parcours.type)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """Mise à jour partielle. Si le statut change en 'ouvert', créer ValeurCritere si absentes."""
        instance = self.get_object()
        old_statut = instance.statut
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        parcours = serializer.save()
        
        # Si transition vers 'ouvert' et pas de critères, générer
        if old_statut != 'ouvert' and parcours.statut == 'ouvert':
            if not parcours.valeurs.exists():
                creer_valeurs_critere_pour_parcours(parcours, parcours.type)
        
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminUser])
    def generate_criteres(self, request, pk=None):
        """Endpoint pour générer/réinitialiser les ValeurCritere d'un parcours."""
        parcours = self.get_object()
        
        # Supprimer les existantes (optionnel)
        if request.data.get('reset', False):
            parcours.valeurs.all().delete()
        
        # Générer selon le type
        count_before = parcours.valeurs.count()
        creer_valeurs_critere_pour_parcours(parcours, parcours.type)
        count_after = parcours.valeurs.count()
        
        return Response({
            'success': True,
            'message': f'{count_after - count_before} critères créés',
            'total_criteres': count_after,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def changer_statut(self, request, pk=None):
        """Endpoint pour changer le statut du parcours."""
        parcours = self.get_object()
        nouveau_statut = request.data.get('statut')
        
        if nouveau_statut not in dict(ParcoursAdmission.STATUS_CHOICES):
            return Response(
                {'error': f'Statut invalide: {nouveau_statut}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        parcours.statut = nouveau_statut
        parcours.save(update_fields=['statut', 'updated_at'])
        
        serializer = self.get_serializer(parcours)
        return Response(serializer.data)
