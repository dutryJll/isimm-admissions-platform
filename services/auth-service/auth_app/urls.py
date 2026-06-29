from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('verify-email/<uuid:token>/', views.verify_email, name='verify_email'),
    path('profile/', views.get_profile, name='get_profile'),
    path('profile/update/', views.update_profile, name='update_profile'),
    path('profile/two-factor/', views.toggle_two_factor, name='toggle_two_factor'),
    
    
    path('users/', views.list_users, name='list_users'),
    path('users/create/', views.create_user, name='create_user'),
    path('users/<int:user_id>/', views.user_detail_update, name='user_detail_update'),
    path('users/<int:user_id>/account-status/', views.update_user_account_status, name='update_user_account_status'),
    path('users/<int:user_id>/delete/', views.delete_user, name='delete_user'),

    path('create-commission-member/', views.create_commission_member),
    path('commission-members/<int:user_id>/delete/', views.delete_commission_member, name='delete_commission_member'),
    path('set-password/<uuid:token>/', views.set_password_with_token),
    path('commission-members/', views.list_commission_members),
    path('verify-token/<uuid:token>/', views.verify_token, name='verify_token'),
    path('admin/action-roles/matrix/', views.action_roles_matrix, name='action_roles_matrix'),
    path('admin/action-roles/matrix/update/', views.update_action_roles_matrix, name='update_action_roles_matrix'),
    path('my-actions/', views.my_enabled_actions, name='my_enabled_actions'),
    
   
    path('my-commissions/', views.my_commissions, name='my_commissions'),
    path('select-commission/', views.select_commission, name='select_commission'),
    path('password-reset/', views.password_reset, name='password_reset'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password_reset_confirm'),
]