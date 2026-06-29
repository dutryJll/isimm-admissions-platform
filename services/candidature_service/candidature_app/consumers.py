import json

from channels.generic.websocket import AsyncWebsocketConsumer


STATUS_MESSAGES = {
    'soumis': 'Votre candidature a bien été soumise.',
    'sous_examen': 'Votre candidature est en cours d\'examen par la commission.',
    'preselectionne': '🎉 Félicitations ! Vous êtes présélectionné(e) pour la phase d\'audit.',
    'en_attente_dossier': '📂 Veuillez déposer votre dossier numérique dans les délais impartis.',
    'dossier_depose': '✅ Votre dossier a bien été reçu. Merci !',
    'en_attente': 'Votre dossier est en attente de traitement.',
    'selectionne': '🏆 Excellente nouvelle ! Vous êtes admis(e).',
    'inscrit': '🎓 Vous êtes inscrit(e). Bienvenue à l\'ISIMM !',
    'annule': 'Votre candidature a été annulée.',
    'rejete': 'Votre candidature n\'a pas été retenue. Nous vous souhaitons bonne continuation.',
}


class CandidaturesConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer with two channel groups:
    - Global broadcast group : 'candidatures_updates'
    - Per-user group          : 'user_{user_id}' (personalized alerts)

    The front-end connects via /ws/candidatures/ — the URL routing
    passes the user_id from the JWT token (see routing.py).
    """

    global_group = 'candidatures_updates'

    async def connect(self):
        # Join the global broadcast group
        await self.channel_layer.group_add(self.global_group, self.channel_name)

        # Join the per-user personal group if user_id is available
        self.user_id = self.scope.get('user_id') or (
            str(self.scope['user'].id) if self.scope.get('user') and self.scope['user'].is_authenticated else None
        )
        if self.user_id:
            self.personal_group = f'user_{self.user_id}'
            await self.channel_layer.group_add(self.personal_group, self.channel_name)
        else:
            self.personal_group = None

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.global_group, self.channel_name)
        if self.personal_group:
            await self.channel_layer.group_discard(self.personal_group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                payload = json.loads(text_data)
                if isinstance(payload, dict) and payload.get('type') == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
                    return
            except Exception:
                return

    # ──────────────────────────────────────────────────────
    # Handlers called by channel_layer.group_send(...)
    # ──────────────────────────────────────────────────────

    async def candidature_status_changed(self, event):
        """Broadcast or personal notification when a candidature status changes."""
        new_status = event.get('new_status', '')
        message = STATUS_MESSAGES.get(new_status, f'Statut mis à jour : {new_status}')

        await self.send(
            text_data=json.dumps({
                'type': 'candidature_status_changed',
                'candidature_id': event.get('candidature_id'),
                'candidate_user_id': event.get('candidate_user_id'),
                'new_status': new_status,
                'message': message,
                'updated_at': event.get('updated_at'),
            })
        )

    async def preselection_closed(self, event):
        """Fired when a responsable validates the présélection session."""
        await self.send(
            text_data=json.dumps({
                'type': 'preselection_closed',
                'commission_id': event.get('commission_id'),
                'message': event.get('message', 'La session de présélection a été clôturée.'),
                'timestamp': event.get('timestamp'),
            })
        )

    async def notification_push(self, event):
        """Generic push notification (title + body + level)."""
        await self.send(
            text_data=json.dumps({
                'type': 'notification_push',
                'titre': event.get('titre', 'Notification'),
                'message': event.get('message', ''),
                'level': event.get('level', 'info'),
                'timestamp': event.get('timestamp'),
            })
        )
