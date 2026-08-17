export type RegistrationErrorReason = 'email_taken' | 'phone_taken';

/**
 * Thrown by AuthService.registerEmployee for the specific, user-fixable
 * duplicate cases (already-registered email or phone number) so the
 * registration form can show a targeted message instead of a generic
 * failure toast. See employee-registration.component.ts's submit() catch.
 */
export class RegistrationError extends Error {
  constructor(readonly reason: RegistrationErrorReason) {
    super(`Registration failed: ${reason}`);
    this.name = 'RegistrationError';
  }
}
