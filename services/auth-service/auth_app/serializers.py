from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User, ActionRole

class UserSerializer(serializers.ModelSerializer):
    """Serializer pour le modèle User"""
    suspended_since = serializers.DateTimeField(source='suspended_at', read_only=True)
    suspended_by_email = serializers.SerializerMethodField()
    reactivated_by_email = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'username',
            'first_name',
            'last_name',
            'role',
            'specialite',
            'is_email_verified',
            'avatar_url',
            'phone',
            'address',
            'date_of_birth',
            'two_factor_enabled',
            'date_inscription',
            'derniere_connexion',
            'is_active',
            'is_staff',
            'suspended_at',
            'suspended_since',
            'suspension_reason',
            'suspended_by',
            'suspended_by_email',
            'reactivated_at',
            'reactivated_by',
            'reactivated_by_email',
        ]
        read_only_fields = [
            'id',
            'date_inscription',
            'derniere_connexion',
            'suspended_since',
            'suspended_by_email',
            'reactivated_by_email',
        ]

    def get_suspended_by_email(self, obj):
        return obj.suspended_by.email if obj.suspended_by else None

    def get_reactivated_by_email(self, obj):
        return obj.reactivated_by.email if obj.reactivated_by else None

class RegisterSerializer(serializers.ModelSerializer):
    """Serializer pour l'inscription"""
    password2 = serializers.CharField(write_only=True)
    username = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'password2', 'first_name', 'last_name', 'role']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError("Les mots de passe ne correspondent pas")
        try:
            validate_password(data['password'])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return data
    
    def create(self, validated_data):
        validated_data.pop('password2')
        raw_username = (validated_data.pop('username', '') or '').strip()
        email = (validated_data.get('email') or '').strip().lower()

        if raw_username:
            username = raw_username
        else:
            base = email.split('@')[0] if '@' in email else 'candidat'
            # Garder uniquement lettres/chiffres/underscore pour un username Django propre.
            sanitized = ''.join(ch if (ch.isalnum() or ch == '_') else '_' for ch in base).strip('_')
            base_username = sanitized or 'candidat'
            username = base_username
            suffix = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{suffix}"
                suffix += 1

        user = User.objects.create_user(username=username, **validated_data)
        return user


class ActionRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionRole
        fields = [
            'id',
            'action_no',
            'action_name',
            'target_role',
            'enabled',
            'description',
        ]