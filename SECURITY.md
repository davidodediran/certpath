# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | Yes |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in CertPath, report it privately by emailing:

**david.odediran@amalitechtraining.org**

Include the following in your report:

- A clear description of the vulnerability
- Steps to reproduce it (proof of concept if possible)
- The potential impact you see
- Your suggested fix (optional but appreciated)

## What to Expect

- **Acknowledgement** within 48 hours of your report
- **Status update** within 7 days — we will confirm whether we can reproduce the issue
- **Resolution** as quickly as possible, typically within 30 days for critical issues
- **Credit** in the changelog and release notes if you wish to be named (your choice)

We ask that you:

- Give us reasonable time to fix the issue before public disclosure
- Avoid accessing or modifying data that does not belong to you during research
- Do not perform denial-of-service testing

## Known Security Design Decisions

- All exam sessions are scoped to the authenticated student — cross-session access is blocked server-side
- JWT secrets must be rotated if compromised; there is no token revocation list in the current version
- MFA is TOTP-based (RFC 6238) via `otplib`; backup codes are not yet implemented
- File uploads (question bank) are restricted to CSV, PDF, and DOCX; uploaded files are stored server-side and not served directly to students

## Out of Scope

The following are considered out of scope for this project's security policy:

- Vulnerabilities in third-party dependencies (report those upstream)
- Social engineering attacks
- Physical attacks against infrastructure
- Issues in forked or self-hosted deployments that have modified the source code
