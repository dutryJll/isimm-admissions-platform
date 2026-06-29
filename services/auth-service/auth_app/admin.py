from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'role', 'specialite', 'date_inscription']
    list_filter = ['role', 'is_staff', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Rôle & Spécialité', {'fields': ('role', 'specialite')}),
        ('Profil', {'fields': ('phone', 'address', 'date_of_birth', 'avatar_url')}),
        ('Statut compte', {'fields': ('is_email_verified', 'two_factor_enabled', 'suspended_at', 'suspension_reason')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Rôle & Spécialité', {'fields': ('role', 'specialite')}),
    )