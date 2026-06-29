from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from .models import UserProfile
from .serializers import UserProfileSerializer

class UserListView(generics.ListAPIView):
    """Liste tous les profils (SANS authentification pour tests)"""
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement

class UserProfileView(APIView):
    """Récupère le profil de l'utilisateur connecté"""
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement

    def get(self, request):
        try:
            # Récupérer l'email depuis le token ou query param
            email = request.query_params.get('email')
            if not email and request.user and request.user.is_authenticated:
                email = request.user.email
            
            if not email:
                return Response(
                    {'error': 'Email requis'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile = UserProfile.objects.get(email=email)
            serializer = UserProfileSerializer(profile)
            return Response(serializer.data)
        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Profil non trouvé'}, 
                status=status.HTTP_404_NOT_FOUND
            )

class UserProfileUpdateView(APIView):
    """Met à jour le profil"""
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement

    def put(self, request):
        try:
            email = request.data.get('email')
            if not email:
                return Response(
                    {'error': 'Email requis'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            profile = UserProfile.objects.get(email=email)
            serializer = UserProfileSerializer(profile, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except UserProfile.DoesNotExist:
            return Response(
                {'error': 'Profil non trouvé'}, 
                status=status.HTTP_404_NOT_FOUND
            )

class UserDeleteView(generics.DestroyAPIView):
    """Supprime un utilisateur"""
    queryset = UserProfile.objects.all()
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement


class AdminListResponsablesView(generics.ListAPIView):
    """Admin: List all responsables (commission leaders)"""
    queryset = UserProfile.objects.filter(role='responsable_commission')
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement


class AdminCreateResponsableView(generics.CreateAPIView):
    """Admin: Create a new responsable user"""
    serializer_class = UserProfileSerializer
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement
    
    def perform_create(self, serializer):
        # Ensure role is set to responsable_commission
        serializer.save(role='responsable_commission')


class AssignerCommissionView(APIView):
    """PATCH /responsables/<id>/assigner-commission/ — assigne un parcours à un responsable."""

    permission_classes = [AllowAny]  # TODO: restreindre aux admins

    VALID_COMMISSIONS = {'MPGL', 'MPDS', 'MP3I', 'MRGL', 'MRMI', 'ING'}

    def patch(self, request, pk):
        commission = (request.data.get('commission') or '').strip().upper()
        if not commission:
            return Response(
                {'error': "Le champ 'commission' est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if commission not in self.VALID_COMMISSIONS:
            return Response(
                {
                    'error': f"Commission invalide. Valeurs autorisées : "
                             f"{sorted(self.VALID_COMMISSIONS)}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = UserProfile.objects.get(pk=pk)
        except UserProfile.DoesNotExist:
            return Response(
                {'error': "Responsable introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if user.role not in ('responsable_commission', 'commission'):
            return Response(
                {'error': "Cet utilisateur n'est pas un responsable de commission."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.commission = commission
        user.save(update_fields=['commission', 'updated_at'])
        return Response(
            {
                'message': f"Commission {commission} assignée à {user.get_full_name()}.",
                'id': user.id,
                'commission': commission,
            },
            status=status.HTTP_200_OK,
        )


class AdminDeleteResponsableView(generics.DestroyAPIView):
    """Admin: Delete a responsable user"""
    queryset = UserProfile.objects.filter(role='responsable_commission')
    permission_classes = [AllowAny]  # ✅ DÉSACTIVÉ temporairement
    
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user_info = {
            'id': user.id,
            'email': user.email,
            'name': user.get_full_name()
        }
        user.delete()
        return Response({'message': f'Responsable {user_info["email"]} supprimé avec succès', 'user': user_info}, status=status.HTTP_200_OK)