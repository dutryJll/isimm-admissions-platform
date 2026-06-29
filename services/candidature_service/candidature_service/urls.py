from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve as _media_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from candidature_app import views_depot_dossier

urlpatterns = [
    path('admin/', admin.site.urls),
   path('api/candidatures/', include('candidature_app.urls')),
    # Espace membre de commission (ma-commission-membre, candidatures par commission)
    path('api/commission/', include('candidature_app.commission_urls')),
    # Dossier endpoints are declared in the app to avoid duplication.
    path('api/dossier/', include('candidature_app.dossier_urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

# MOD v6 §4 — Sert les fichiers déposés (/media/...). On utilise django.views.static.serve
# de façon inconditionnelle (et pas le helper static() limité à DEBUG) car ce déploiement
# tourne avec DEBUG=False ; sans cette route, « Voir » / « Télécharger » renvoient 404.
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', _media_serve, {'document_root': settings.MEDIA_ROOT}),
]