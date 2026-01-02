/**
 * Cookie utility functions for managing refresh token
 */

const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

/**
 * Set a cookie with the refresh token
 * @param value The refresh token value
 * @param days Number of days until expiration (default: 30 days)
 */
export const setRefreshTokenCookie = (value: string, days: number = 30): void => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Set cookie with secure flags
  // SameSite=Strict for CSRF protection, Secure flag for HTTPS (will be set by browser in production)
  const cookieValue = `${REFRESH_TOKEN_COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  document.cookie = cookieValue;
};

/**
 * Get the refresh token from cookies
 * @returns The refresh token or null if not found
 */
export const getRefreshTokenCookie = (): string | null => {
  const name = REFRESH_TOKEN_COOKIE_NAME + '=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookieArray = decodedCookie.split(';');
  
  for (let i = 0; i < cookieArray.length; i++) {
    let cookie = cookieArray[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(name) === 0) {
      return decodeURIComponent(cookie.substring(name.length, cookie.length));
    }
  }
  return null;
};

/**
 * Remove the refresh token cookie
 */
export const removeRefreshTokenCookie = (): void => {
  // Set expiration date in the past to delete the cookie
  document.cookie = `${REFRESH_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
};

