import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.getCurrentUser();


  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  const allowedRoles = route.data['roles'] as string[];

  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const userRole = (currentUser.role ?? '').toString().trim().toLowerCase();
  const normalizedAllowedRoles = (allowedRoles ?? []).map((role) =>
    role.toString().trim().toLowerCase(),
  );
  const isAllowed = normalizedAllowedRoles.includes(userRole);


  if (isAllowed) {
    return true;
  }


  // âœ… CORRECTION : Redirection selon le rÃ´le
  switch (userRole) {
    case 'candidat':
      router.navigate(['/candidat/dashboard']);
      break;
    case 'commission':
    case 'responsable_commission':
      router.navigate(['/commission/dashboard']);
      break;
    case 'admin':
      router.navigate(['/admin/dashboard']); // âœ… CORRIGÃ‰
      break;
    default:
      router.navigate(['/']);
  }

  return false;
};
