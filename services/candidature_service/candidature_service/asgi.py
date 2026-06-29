

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'candidature_service.settings')

django_asgi_app = get_asgi_application()

from candidature_app.routing import websocket_urlpatterns

application = ProtocolTypeRouter(
	{
		'http': django_asgi_app,
		'websocket': URLRouter(websocket_urlpatterns),
	}
)
