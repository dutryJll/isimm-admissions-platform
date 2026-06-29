from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Candidature,
    ConfigurationAppel,
    CritereEvaluation,
    DonneesAcademiques,
    FormuleScore,
    ListeAdmission,
    Master,
    Notification,
    OffreMaster,
    ParcoursAdmission,
    AvisMembre,
    AvisSelection,
    ValeurCritere,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email']


class MasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Master
        fields = '__all__'


class OffreMasterSerializer(serializers.ModelSerializer):
    master_id = serializers.IntegerField(source='master.id', read_only=True)
    nombre_candidats_inscrits = serializers.SerializerMethodField()

    class Meta:
        model = OffreMaster
        fields = [
            'id',
            'master_id',
            'titre',
            'description',
            'type_formation',
            'capacite',
            'date_limite',
            'date_debut_visibilite',
            'date_fin_visibilite',
            'date_limite_preinscription',
            'date_limite_depot_dossier',
            'capacites_detaillees',
            'appel_actif',
            'est_publiee',
            'actif',
            'created_at',
            'updated_at',
            'nombre_candidats_inscrits',
        ]

    def get_nombre_candidats_inscrits(self, obj):
        return Candidature.objects.filter(master_id=obj.master_id).count()


class CandidatureSerializer(serializers.ModelSerializer):
    master_nom = serializers.CharField(source='master.nom', read_only=True)
    peut_modifier = serializers.SerializerMethodField()
    jours_restants = serializers.SerializerMethodField()
    formulaire = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = Candidature
        fields = [
            'id',
            'numero',
            'master',
            'master_nom',
            'statut',
            'motif_rejet',
            'decision_finale_responsable',
            'score',
            'classement',
            'date_soumission',
            'date_limite_modification',
            'date_changement_statut',
            'dossier_valide',
            'dossier_depose',
            'choix_priorite',
            'peut_modifier',
            'jours_restants',
            'formulaire',
        ]
        read_only_fields = ['numero', 'date_soumission']

    def get_peut_modifier(self, obj):
        return obj.peut_etre_modifie()

    def get_jours_restants(self, obj):
        if obj.statut != 'soumis' or not obj.date_limite_modification:
            return 0
        from django.utils import timezone

        delta = obj.date_limite_modification - timezone.now()
        return max(0, delta.days)

    def create(self, validated_data):
        formulaire = validated_data.pop('formulaire', None)

        request = self.context.get('request')
        candidat = getattr(request, 'user', None)

        candidature = Candidature.objects.create(candidat=candidat, **validated_data)

        if isinstance(formulaire, dict):
            DonneesAcademiques.objects.create(
                candidature=candidature,
                moyenne_generale=0.0,
                moyenne_specialite=0.0,
                note_pfe=0.0,
                notes_detaillees={'source': 'formulaire_dynamic', 'payload': formulaire},
            )

            try:
                parcours = ParcoursAdmission.objects.filter(master=candidature.master, actif=True).first()
                if parcours:
                    score = parcours.calculer_score(candidature)
                    if score is not None:
                        candidature.score = score
                        candidature.save(update_fields=['score', 'updated_at'])
            except Exception:
                pass

        return candidature


class ConfigurationAppelSerializer(serializers.ModelSerializer):
    master_nom = serializers.CharField(source='master.nom', read_only=True)
    est_visible = serializers.SerializerMethodField()
    peut_candidater = serializers.SerializerMethodField()
    document_officiel_pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = ConfigurationAppel
        fields = '__all__'

    def get_est_visible(self, obj):
        return obj.est_visible()

    def get_peut_candidater(self, obj):
        return obj.peut_candidater()

    def get_document_officiel_pdf_url(self, obj):
        if not obj.document_officiel_pdf:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.document_officiel_pdf.url)
        return obj.document_officiel_pdf.url


class FormuleScoreSerializer(serializers.ModelSerializer):
    master_nom = serializers.CharField(source='master.nom', read_only=True)

    class Meta:
        model = FormuleScore
        fields = '__all__'


class DonneesAcademiquesSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonneesAcademiques
        fields = '__all__'


class ListeAdmissionSerializer(serializers.ModelSerializer):
    master_nom = serializers.CharField(source='master.nom', read_only=True)

    class Meta:
        model = ListeAdmission
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    date = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'titre', 'message', 'type', 'lue', 'date']


class ParcoursAdmissionSerializer(serializers.ModelSerializer):
    master_nom = serializers.CharField(source='master.nom', read_only=True)
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = ParcoursAdmission
        fields = [
            'id',
            'master',
            'master_nom',
            'nom',
            'type',
            'type_display',
            'specialite',
            'capacite',
            'date_limite',
            'statut',
            'statut_display',
            'actif',
            'created_at',
            'updated_at',
        ]


class ValeurCritereSerializer(serializers.ModelSerializer):
    critere_code = serializers.CharField(source='critere.code', read_only=True)
    critere_nom = serializers.CharField(source='critere.nom', read_only=True)
    critere_label = serializers.CharField(source='critere.label', read_only=True)

    class Meta:
        model = ValeurCritere
        fields = [
            'id',
            'parcours',
            'critere',
            'critere_code',
            'critere_nom',
            'critere_label',
            'coefficient',
        ]


class CritereEvaluationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CritereEvaluation
        fields = ['id', 'code', 'nom', 'label', 'description']


class AvisMembreSerializer(serializers.ModelSerializer):
    membre_id = serializers.IntegerField(source='membre.id', read_only=True)
    membre_user = serializers.CharField(source='membre.user.username', read_only=True)
    membre_email = serializers.EmailField(source='membre.user.email', read_only=True)
    membre_name = serializers.SerializerMethodField()
    candidature_id = serializers.IntegerField(source='candidature.id', read_only=True)
    candidature_numero = serializers.SerializerMethodField()
    commission_id = serializers.IntegerField(source='commission.id', read_only=True)
    commission_name = serializers.SerializerMethodField()
    avis_type = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source='date_avis', read_only=True)

    class Meta:
        model = AvisMembre
        fields = [
            'id',
            'membre',
            'membre_id',
            'membre_user',
            'membre_email',
            'membre_name',
            'candidature',
            'candidature_id',
            'candidature_numero',
            'commission',
            'commission_id',
            'commission_name',
            'avis',
            'avis_type',
            'argument',
            'date_avis',
            'date',
        ]
        read_only_fields = [
            'date_avis',
            'date',
            'membre_id',
            'membre_user',
            'membre_email',
            'membre_name',
            'candidature_id',
            'candidature_numero',
            'commission_id',
            'commission_name',
            'avis_type',
        ]

    def get_membre_name(self, obj):
        user = getattr(obj.membre, 'user', None)
        if not user:
            return ''
        return f"{user.first_name} {user.last_name}".strip() or user.username

    def get_candidature_numero(self, obj):
        return getattr(obj.candidature, 'numero', '')

    def get_commission_name(self, obj):
        commission = getattr(obj, 'commission', None)
        return commission.nom if commission else ''

    def get_avis_type(self, obj):
        return 'favorable' if obj.avis else 'defavorable'


class AvisSelectionSerializer(serializers.ModelSerializer):
    membre_id = serializers.IntegerField(source='membre.id', read_only=True)
    membre_user = serializers.CharField(source='membre.user.username', read_only=True)
    membre_name = serializers.SerializerMethodField()
    commission_id = serializers.IntegerField(source='commission.id', read_only=True)
    commission_name = serializers.CharField(source='commission.nom', read_only=True)

    class Meta:
        model = AvisSelection
        fields = [
            'id',
            'commission',
            'commission_id',
            'commission_name',
            'membre',
            'membre_id',
            'membre_user',
            'membre_name',
            'statut',
            'commentaire',
            'date_avis',
            'is_global',
        ]
        read_only_fields = [
            'id',
            'commission_id',
            'commission_name',
            'membre_id',
            'membre_user',
            'membre_name',
            'date_avis',
        ]

    def get_membre_name(self, obj):
        user = getattr(obj.membre, 'user', None)
        if not user:
            return ''
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username


class MembreCommissionSerializer(serializers.ModelSerializer):
    commission_name = serializers.CharField(source='commission.nom', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    member_name = serializers.SerializerMethodField()

    class Meta:
        from .models import MembreCommission as _MembreCommission

        model = _MembreCommission
        fields = [
            'id',
            'commission',
            'commission_name',
            'user',
            'user_id',
            'first_name',
            'last_name',
            'member_name',
            'email',
            'role',
            'date_nomination',
            'actif',
        ]

    def get_member_name(self, obj):
        full_name = f"{getattr(obj.user, 'first_name', '')} {getattr(obj.user, 'last_name', '')}".strip()
        return full_name or getattr(obj.user, 'username', '') or getattr(obj.user, 'email', '')
