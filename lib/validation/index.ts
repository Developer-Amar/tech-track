/**
 * Validation helpers — shared between client and server.
 * Built out as needed in Phases 2–5.
 */

/** Check if an email is on the chitkara.edu.in domain. */
export function isChitkaraEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@chitkara.edu.in");
}

/** The super admin email — hardcoded per PRD Section 4. */
export const SUPER_ADMIN_EMAIL = "amar4594.ece25@chitkara.edu.in";

/** Supported languages for code submissions — must match the DB check constraint. */
export const SUPPORTED_LANGUAGES = ["c", "cpp", "python", "java"] as const;
