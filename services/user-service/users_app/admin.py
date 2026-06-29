from django.contrib import admin
from .models import UserProfile

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['email', 'full_name', 'role', 'cin', 'telephone', 'created_at']
    list_filter = ['role', 'ville']
    search_fields = ['email', 'first_name', 'last_name', 'cin']
    ordering = ['-created_at']
    
    def full_name(self, obj):
        return obj.get_full_name()
    full_name.short_description = 'Nom complet'