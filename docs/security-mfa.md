# Two-factor authentication policy and recovery

## Policy

`MFA_ENFORCEMENT` accepts:

- `off` — nobody is required to enrol.
- `staff` — gate, admin and CEO roles must enrol.
- `all` — every role must enrol.
- a comma-separated role list such as `staff,artists` — only those roles must enrol.

Production defaults to `staff,artists`. Development defaults to `off` so the seeded demo
accounts remain usable. The value is read on the server; a user cannot change it from the
browser.

Enforcement is server-side:

- Sign-in refuses to create a session for a required role that has not enrolled and sends
  the person to the enrolment challenge instead.
- Every protected page calls `requireUser` / `requireRolePage`, which redirect an enrolled
  but unsatisfied account to `/security`.
- An enrolled account is challenged for a 6-digit code on every new sign-in. TOTP codes are
  verified server-side, single-use, and replayed codes are rejected.

## Enrolment

1. Sign in with email and password.
2. Scan the QR code with Google Authenticator, 1Password, Authy or any TOTP app.
3. Enter the 6-digit code to confirm.
4. Store the eight one-time recovery codes offline.

## Recovery

- Recovery codes work once each at the sign-in verification step.
- Accounts whose role requires two-factor authentication cannot switch it off themselves.
- If an artist loses both the authenticator and the recovery codes, an administrator or CEO
  can use **Reset 2FA** in the admin users list. The reset clears the stored secret, signs
  out the artist's other sessions, writes an `auth.mfa_reset` audit entry, and the artist is
  required to enrol again at the next sign-in. Staff accounts cannot be reset this way.
- If staff lose their own second factor, another administrator must reset the account at the
  database level after verifying identity out of band; this is intentionally manual.

## What is not implemented

- No SMS or email one-time codes.
- No self-service "replace authenticator" flow for an account that still has its old device.
- No automatic recovery-code re-issue by the user; support must reset or re-enrol.
