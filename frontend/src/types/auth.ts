export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Mirror of AuthResponse record from auth-service */
export interface AuthResponse {
  token: string;
  /** ISO-8601 instant string */
  expiresAt: string;
}

/** Mirror of UserResponse record from auth-service */
export interface UserResponse {
  id: string;
  email: string;
  roles: string;
  /** ISO-8601 instant string */
  createdAt: string;
}

/** Decoded JWT payload — only the claims we inspect client-side */
export interface JwtPayload {
  sub: string;
  email: string;
  roles: string;
  /** Unix epoch seconds */
  exp: number;
  iat: number;
}
