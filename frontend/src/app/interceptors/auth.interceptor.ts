import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isPublicEndpoint =
    req.url.includes('/api/auth/login/') ||
    req.url.includes('/api/auth/register/') ||
    req.url.includes('/api/auth/refresh/') ||
    req.url.includes('/api/candidatures/masters/') ||
    req.url.includes('/api/candidatures/dossiers-ocr/') ||
    req.url.includes('/api/candidatures/offres-inscription/');

  // ne pas attacher le token sur les routes d'authentification
  // (login / register) car l'utilisateur n'est pas encore connecté
  if (isPublicEndpoint) {
    return next(req);
  }

  const token = localStorage.getItem('access_token');

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(cloned);
  }

  return next(req);
};
