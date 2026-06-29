from datetime import date, datetime
from rest_framework import serializers

from .models import UserProfile


# ──────────────────────────────────────────────────────────────────────
# Helpers de validation partagés (date de naissance + année du Bac)
# ──────────────────────────────────────────────────────────────────────

def _calculer_age(date_naissance):
    """Retourne l'âge complet (années révolues) à partir d'une date de naissance."""
    aujourd_hui = date.today()
    age = aujourd_hui.year - date_naissance.year
    if (aujourd_hui.month, aujourd_hui.day) < (date_naissance.month, date_naissance.day):
        age -= 1
    return age


def valider_date_naissance(value):
    """Valide la date de naissance — règles ISIMM (≥ 17 ans et ≤ 60 ans)."""
    if not value:
        raise serializers.ValidationError("La date de naissance est obligatoire.")
    aujourd_hui = date.today()
    if value >= aujourd_hui:
        raise serializers.ValidationError(
            "La date de naissance ne peut pas être dans le futur."
        )
    age = _calculer_age(value)
    if age < 17:
        raise serializers.ValidationError(
            "Vous devez avoir au moins 17 ans pour postuler."
        )
    if age > 60:
        raise serializers.ValidationError(
            "Veuillez vérifier votre date de naissance."
        )
    return value


def valider_annee_bac(value):
    """Valide l'année du Bac (1990 ≤ année ≤ année courante)."""
    try:
        annee = int(value)
    except (TypeError, ValueError):
        raise serializers.ValidationError(
            "Format invalide — 4 chiffres requis (ex : 2022)."
        )
    annee_actuelle = datetime.now().year
    if annee < 1990:
        raise serializers.ValidationError(
            "L'année du Bac ne peut pas être avant 1990."
        )
    if annee > annee_actuelle:
        raise serializers.ValidationError(
            "L'année du Bac ne peut pas être dans le futur."
        )
    return annee


# ──────────────────────────────────────────────────────────────────────
# Serializers
# ──────────────────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            'id', 'auth_user_id', 'email', 'username', 'role',
            'first_name', 'last_name', 'full_name', 'cin', 'telephone',
            'date_naissance', 'adresse', 'ville', 'code_postal',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'auth_user_id', 'email', 'username', 'role', 'created_at', 'updated_at'
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'first_name', 'last_name', 'cin', 'telephone',
            'date_naissance', 'adresse', 'ville', 'code_postal'
        ]

    def validate_date_naissance(self, value):
        return valider_date_naissance(value)
