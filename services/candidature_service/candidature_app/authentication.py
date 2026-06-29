from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings


class SharedJWTAuthentication(JWTAuthentication):
    """Accept JWT from auth-service and map/create a local Django user."""

    def get_user(self, validated_token):
        User = get_user_model()
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)
        email = (validated_token.get('email') or '').strip()
        username = (validated_token.get('username') or '').strip()

        user = None

        if user_id is not None:
            try:
                found = User.objects.get(**{api_settings.USER_ID_FIELD: user_id})
                # Validate email matches to prevent cross-service ID collisions
                if email and found.email.lower() != email.lower():
                    user = None
                else:
                    user = found
            except User.DoesNotExist:
                user = None

        if user is None and email:
            user = User.objects.filter(email__iexact=email).first()

        if user is None:
            if not username:
                username = email.split('@')[0] if email else ''
            if not username:
                raise InvalidToken('Token user identity is missing.')

            unique_username = username
            suffix = str(user_id) if user_id is not None else 'svc'
            if User.objects.filter(username=unique_username).exists():
                unique_username = f"{username}_{suffix}"

            user = User.objects.create(
                username=unique_username,
                email=email or f"{unique_username}@local.invalid",
                first_name=(validated_token.get('first_name') or '').strip(),
                last_name=(validated_token.get('last_name') or '').strip(),
                is_active=True,
            )
            user.set_unusable_password()
            user.save(update_fields=['password'])

        # Attach optional claims used by role checks in this service.
        setattr(user, 'role', validated_token.get('role'))
        return user
