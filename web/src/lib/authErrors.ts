const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed before finishing.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow popups and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for the project.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/requires-recent-login': 'Please sign in again to continue.',
  'auth/admin-restricted-operation': 'This operation is not allowed.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
};

export function friendlyAuthError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '');
    if (MESSAGES[code]) return MESSAGES[code];
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function friendlyVerificationError(
  error: unknown,
  fallback = 'Could not send the verification email. Please try again.'
): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? '');
    if (code === 'auth/too-many-requests') {
      return 'Too many verification emails requested. Please wait a few minutes before trying again.';
    }
  }
  return friendlyAuthError(error, fallback);
}
