from django.contrib import admin
from .models import FormuleScore, DonneesAcademiques

@admin.register(FormuleScore)
class FormuleScoreAdmin(admin.ModelAdmin):
    list_display = ['master', 'coef_moyenne_generale', 'coef_moyenne_specialite', 'actif']
    list_filter = ['actif']
    search_fields = ['master__nom']
    
    fieldsets = (
        ('Informations de base', {
            'fields': ('master', 'nom', 'description', 'actif')
        }),
        ('Coefficients principaux', {
            'fields': ('coef_moyenne_generale', 'coef_moyenne_specialite', 'coef_note_pfe')
        }),
        ('Bonus', {
            'fields': ('bonus_mention_tres_bien', 'bonus_mention_bien', 'bonus_mention_assez_bien')
        }),
        ('Malus', {
            'fields': ('malus_redoublement', 'malus_dette')
        }),
        ('Critères spécifiques', {
            'fields': ('criteres_specifiques',),
            'classes': ('collapse',)
        }),
    )

@admin.register(DonneesAcademiques)
class DonneesAcademiquesAdmin(admin.ModelAdmin):
    list_display = ['candidature', 'moyenne_generale', 'mention', 'nb_redoublements']
    list_filter = ['mention']
    search_fields = ['candidature__numero', 'candidature__candidat__email']