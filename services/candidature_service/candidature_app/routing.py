from django.urls import re_path

from .consumers import CandidaturesConsumer


websocket_urlpatterns = [
    re_path(r'ws/candidatures/$', CandidaturesConsumer.as_asgi()),
]
