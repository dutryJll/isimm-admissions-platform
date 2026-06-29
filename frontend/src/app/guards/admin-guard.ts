import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const userStr = localStorage.getItem('currentUser');

  if (!userStr) {
    router.navigate(['/login']);
    return false;
  }

  const user = JSON.parse(userStr);
  const userRole = user.role?.toLowerCase();


  // âœ… AJOUT DES NOUVEAUX RÃ”LES
  const adminRoles = ['admin', 'commission', 'directeur', 'secretaire_general'];

  if (adminRoles.includes(userRole)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
