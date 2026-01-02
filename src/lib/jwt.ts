/**
 * JWT Decode Utility
 * Decodes JWT tokens without verification (client-side only)
 */

import { getRefreshTokenCookie } from './cookies';

export interface DecodedRefreshToken {
  sub: string;
  user_id: number;
  role: 'admin' | 'staff' | 'super_admin';
  full_name: string;
  clinic_id: number | null;
  clinic_name: string | null;
  exp: number;
  type: 'refresh';
}

/**
 * Decodes a JWT token and returns the payload
 * Note: This does NOT verify the token signature - it only decodes it
 */
export function decodeJWT<T = unknown>(token: string): T | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    
    // Base64 URL decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload) as T;
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Decodes the refresh token and returns user role information
 */
export function decodeRefreshToken(): DecodedRefreshToken | null {
  const refreshToken = getRefreshTokenCookie();
  if (!refreshToken) {
    return null;
  }

  return decodeJWT<DecodedRefreshToken>(refreshToken);
}

/**
 * Gets the user role from the refresh token
 */
export function getUserRole(): 'admin' | 'staff' | 'super_admin' | null {
  const decoded = decodeRefreshToken();
  return decoded?.role || null;
}

/**
 * Checks if the user is a super admin
 */
export function isSuperAdmin(): boolean {
  const role = getUserRole();
  return role === 'super_admin';
}

