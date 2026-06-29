// src/app/services/auth.ts

export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  first_name?: string;
  last_name?: string;
  cin?: string;
  telephone?: string;
  is_validated?: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
  cin?: string;
  telephone?: string;
}

export enum Role {
  CANDIDAT = 'CANDIDAT',
  COMMISSION_RESP = 'COMMISSION_RESP',
  COMMISSION_MEMBRE = 'COMMISSION_MEMBRE',
  GESTIONNAIRE = 'GESTIONNAIRE',
  SECRETAIRE = 'SECRETAIRE',
  DIRECTEUR = 'DIRECTEUR',
}
