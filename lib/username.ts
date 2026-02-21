/**
 * Normalize a username coming from the profiles table.
 * Always prefers the `username` column, falling back to the email prefix when needed.
 * 
 * Priority:
 * 1. profile.username (if not empty)
 * 2. Email prefix (part before @)
 * 3. 'User' as last fallback
 */
export function normalizeProfileUsername(profile?: { username?: string | null; email?: string | null }): string {
  // First try the username field
  const fromUsername = profile?.username?.trim();
  if (fromUsername && fromUsername.length > 0) {
    return fromUsername;
  }

  // Try to extract username from email
  const email = profile?.email?.trim();
  if (email && email.includes('@')) {
    const emailPrefix = email.split('@')[0]?.trim();
    if (emailPrefix && emailPrefix.length > 0) {
      return emailPrefix;
    }
  }

  // Last resort fallback
  return 'User';
}

/**
 * Get display name for a user, with a custom fallback option.
 */
export function getDisplayUsername(profile?: { username?: string | null; email?: string | null }, fallback = 'User'): string {
  const normalized = normalizeProfileUsername(profile);
  return normalized === 'User' ? fallback : normalized;
}


