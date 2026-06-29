from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid

class User(AbstractUser):
    ROLE_CHOICES = [
        ('candidat', 'Candidat'),
        ('commission', 'Membre de Commission'),
        ('responsable_commission', 'Responsable de Commission'),
        ('admin', 'Administrateur'),
    ]
    
    email = models.EmailField(unique=True, verbose_name="Email")
    role = models.CharField(
        max_length=30,
        choices=ROLE_CHOICES, 
        default='candidat',
        verbose_name="Rôle"
    )
    
    # ✅ NOUVEAUX CHAMPS POUR VÉRIFICATION EMAIL
    is_email_verified = models.BooleanField(default=False, verbose_name="Email vérifié")
    email_verification_token = models.UUIDField(default=uuid.uuid4, editable=False)
    
    # ✅ CHAMPS POUR RÉINITIALISATION MOT DE PASSE
    reset_password_token = models.UUIDField(null=True, blank=True)
    reset_password_expire = models.DateTimeField(null=True, blank=True)
    
    # Champ spécialité pour les responsables/membres de commission
    specialite = models.CharField(max_length=300, blank=True, default='', verbose_name='Spécialité')

    # Autres champs
    avatar_url = models.CharField(max_length=500, blank=True, default='', verbose_name='Avatar')
    phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Téléphone")
    address = models.TextField(blank=True, null=True, verbose_name="Adresse")
    date_of_birth = models.DateField(null=True, blank=True, verbose_name="Date de naissance")
    two_factor_enabled = models.BooleanField(default=False, verbose_name='Double authentification activée')
    
    # Timestamps
    date_inscription = models.DateTimeField(auto_now_add=True, verbose_name="Date d'inscription")
    derniere_connexion = models.DateTimeField(null=True, blank=True, verbose_name="Dernière connexion")

    # Traçabilité suspension/activation compte
    suspended_at = models.DateTimeField(null=True, blank=True, verbose_name='Date suspension')
    suspension_reason = models.TextField(blank=True, default='', verbose_name='Raison suspension')
    suspended_by = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='suspended_users',
        verbose_name='Suspendu par',
    )
    reactivated_at = models.DateTimeField(null=True, blank=True, verbose_name='Date réactivation')
    reactivated_by = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reactivated_users',
        verbose_name='Réactivé par',
    )
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        db_table = 'auth_users'
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        ordering = ['-date_inscription']
    
    def __str__(self):
        return f"{self.email} ({self.get_role_display()})"


class Permission(models.Model):
    """Permissions granulaires du système"""
    code = models.CharField(max_length=100, unique=True)
    nom = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    
    module = models.CharField(max_length=50)  # 'candidatures', 'masters', 'users', etc.
    
    class Meta:
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
    
    def __str__(self):
        return f"{self.nom} ({self.code})"


class Role(models.Model):
    """Rôles système avec permissions"""
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    
    permissions = models.ManyToManyField(Permission, related_name='roles')
    
    # Flags
    est_systeme = models.BooleanField(
        default=False,
        help_text="Rôle système non modifiable"
    )
    actif = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.nom


class ActionLog(models.Model):
    """Journal des actions utilisateurs"""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    action = models.CharField(max_length=100)
    module = models.CharField(max_length=50)
    description = models.TextField()
    
    # Métadonnées
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(blank=True)
    
    # Résultat
    succes = models.BooleanField(default=True)
    details = models.JSONField(default=dict, blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Action Log'
        verbose_name_plural = 'Actions Logs'
    
    def __str__(self):
        return f"{self.user} - {self.action} - {self.timestamp}"


class ActionRole(models.Model):
    """Matrice des actions par rôle (table action_role)"""

    action_no = models.PositiveIntegerField(verbose_name="Numéro d'action")
    action_name = models.CharField(max_length=255, verbose_name="Nom d'action")
    target_role = models.CharField(max_length=30, choices=User.ROLE_CHOICES, verbose_name='Rôle cible')
    enabled = models.BooleanField(default=False, verbose_name='Activée')
    description = models.TextField(blank=True, verbose_name='Description')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'action_role'
        verbose_name = 'Action par rôle'
        verbose_name_plural = 'Actions par rôle'
        ordering = ['action_no', 'target_role']
        constraints = [
            models.UniqueConstraint(
                fields=['action_no', 'target_role'],
                name='unique_action_role_entry',
            )
        ]

    def __str__(self):
        return f"{self.action_no} - {self.action_name} ({self.target_role})"