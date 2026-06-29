import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const actionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  const requiredActions = (route.data?.['actions'] as string[] | undefined) || [];

  if (!requiredActions.length) {
    return true;
  }

  return authService.getMyEnabledActions().pipe(
    map(() => {
      const hasPermission = authService.hasMyAction(requiredActions);
      if (hasPermission) {
        return true;
      }

      const user = authService.getCurrentUser();
      const role = (user?.role || '').toLowerCase();
      const fallback =
        role === 'candidat'
          ? '/candidat/dashboard'
          : role === 'commission' || role === 'responsable_commission'
            ? '/commission/dashboard'
            : '/';

      toastService.show('Accès refusé: action non autorisée pour votre rôle.', 'warning');
      return router.createUrlTree([fallback]);
    }),
    catchError(() => {
      if (authService.isLoggedIn()) {
        toastService.show(
          'Service de permissions indisponible, accès autorisé temporairement.',
          'warning',
        );
        return of(true);
      }

      toastService.show('Impossible de vérifier les permissions pour le moment.', 'error');
      return of(router.createUrlTree(['/login']));
    }),
  );
};
