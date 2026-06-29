from django.db import models

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('candidat', 'Candidat'),
        ('commission', 'Commission'),
        ('admin', 'Administrateur'),
        ('directeur', 'Directeur'),  # ← AJOUTÉ
        ('secretaire_general', 'Secrétaire Général'),  # ← AJOUTÉ
    ]
    
    # Lien avec AUTH-SERVICE
    auth_user_id = models.IntegerField(unique=True, verbose_name="ID Auth Service")
    
    # Données de base (synchronisées depuis AUTH)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)  # ← CHANGÉ
    
    # Données personnelles
    first_name = models.CharField(max_length=150, verbose_name="Prénom")
    last_name = models.CharField(max_length=150, verbose_name="Nom")
    cin = models.CharField(max_length=8, unique=True, null=True, blank=True, verbose_name="CIN")
    telephone = models.CharField(max_length=20, null=True, blank=True, verbose_name="Téléphone")
    date_naissance = models.DateField(null=True, blank=True, verbose_name="Date de naissance")
    
    # Adresse
    adresse = models.TextField(null=True, blank=True, verbose_name="Adresse")
    ville = models.CharField(max_length=100, null=True, blank=True, verbose_name="Ville")
    code_postal = models.CharField(max_length=10, null=True, blank=True, verbose_name="Code postal")

    # Sprint — Commission assignée (pour rôle responsable_commission / commission)
    commission = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name="Commission / parcours assigné",
        help_text="Code du parcours : MPGL, MPDS, MP3I, MRGL, MRMI",
    )
    
    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'user_profiles'
        verbose_name = 'Profil Utilisateur'
        verbose_name_plural = 'Profils Utilisateurs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"