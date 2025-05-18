/**
 * Session Helper: Utility functions to check user authentication status
 */

/**
 * Check if the user has an active session
 * Examines local storage, session storage, and cookies
 */
export function isLoggedIn(): boolean {
  // Check local storage for session
  const localSession = localStorage.getItem('session');
  
  // Check session storage for session
  const sessionStorageSession = sessionStorage.getItem('session');
  
  // Check for session cookies
  const hasCookie = document.cookie.split(';').some(item => {
    return item.trim().startsWith('connect.sid=');
  });

  // Also check if we have stored user data
  const userDataString = localStorage.getItem('userData') || sessionStorage.getItem('userData');
  
  return !!(localSession || sessionStorageSession || hasCookie || userDataString);
}

/**
 * Navigate to the appropriate page based on authentication status
 */
export function navigateBasedOnAuth(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    window.location.href = '/dashboard';
  } else {
    window.location.href = '/auth';
  }
}

/**
 * Store user data after successful authentication
 */
export function storeUserSession(userData: any): void {
  // Store in local storage for persistence
  localStorage.setItem('userData', JSON.stringify(userData));
  localStorage.setItem('session', 'true');
}

/**
 * Clear user session on logout
 */
export function clearUserSession(): void {
  localStorage.removeItem('userData');
  localStorage.removeItem('session');
  localStorage.removeItem('selectedWebsiteId');
  sessionStorage.removeItem('userData');
  sessionStorage.removeItem('session');
}

/**
 * Store selected website ID in localStorage
 */
export function storeSelectedWebsiteId(websiteId: number): void {
  localStorage.setItem('selectedWebsiteId', websiteId.toString());
}

/**
 * Get selected website ID from localStorage
 */
export function getSelectedWebsiteId(): number | null {
  const storedId = localStorage.getItem('selectedWebsiteId');
  return storedId ? parseInt(storedId, 10) : null;
}