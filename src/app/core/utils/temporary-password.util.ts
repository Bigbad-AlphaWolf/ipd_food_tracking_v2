// Charset avoids visually ambiguous characters (0/O, 1/l/I) since this is
// meant to be read off a screen and typed/copied by a human.
const PASSWORD_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

/** Generates a random temporary password for an admin-provisioned account. */
export function generateTemporaryPassword(length = 12): string {
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues, (value) => PASSWORD_CHARSET[value % PASSWORD_CHARSET.length]).join('');
}
