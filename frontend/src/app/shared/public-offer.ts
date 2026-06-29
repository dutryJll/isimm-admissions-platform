export interface PublicOfferLike {
  statut?: string;
  actif?: boolean;
  est_cache?: boolean;
  est_visible?: boolean;
  publie_par_responsable?: boolean;
  published_by_responsable?: boolean;
  is_published?: boolean;
}

export function isPublicOffer(offer: PublicOfferLike | null | undefined): boolean {
  if (!offer) {
    return false;
  }

  if (
    offer.publie_par_responsable === false ||
    offer.published_by_responsable === false ||
    offer.is_published === false
  ) {
    return false;
  }

  if (offer.est_cache === true || offer.est_visible === false) {
    return false;
  }

  if (offer.actif === false) {
    return false;
  }

  return true;
}
