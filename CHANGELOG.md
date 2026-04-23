# Changelog

All notable changes to CertPath are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-04-23

### Added

**Core exam platform**
- Timed exam mode with AWS-style scoring (700/1000 pass threshold)
- Practice mode with instant per-question feedback, explanations, and reference links
- Post-exam review mode showing correct answers, explanations, and unscored question badges
- 15 unscored research questions injected per exam session (transparent to students)
- Multi-select question detection from question text (`Choose two.`, `Select three.`, etc.) with checkbox UI

**Question bank**
- Bulk question import via CSV, PDF, and DOCX uploads
- Per-exam-type filtering (Cloud Practitioner, Solutions Architect, etc.)
- CSV export of full question bank
- Admin and teacher question management dashboards

**Role system**
- Student — register via cohort code, take exams and practice sessions
- Teacher — manage cohorts, upload questions, view student progress and results
- Admin — oversee question bank, manage teachers and cohorts platform-wide
- Superuser — manage admins, view platform-wide stats, enforce MFA

**Authentication and security**
- JWT-based authentication with bcrypt password hashing
- TOTP multi-factor authentication (RFC 6238 via otplib) for students, teachers, and superusers
- Session ownership enforcement — students cannot access other students' exam sessions
- Cohort-scoped student login (email + cohort code)

**Qualification tracking**
- Dual-path qualification logic: >10 passing attempts at ≥750, or >8 passing attempts at ≥800
- Per-student progress visible to teachers and admins

**UI and UX**
- Full light/dark theme support
- Responsive layout for desktop and tablet
- Domain score breakdown on exam result screen (mirrors real AWS CLF-C02 scorecard layout)

**Infrastructure**
- Docker Compose local development setup (frontend + backend + PostgreSQL, zero configuration)
- EC2 UserData bootstrap script (`scripts/ec2-setup.sh`) for Amazon Linux 2023 + Supabase deployment
- `docker-compose.ec2.yml` for production deployment against an external PostgreSQL database
- Automatic database migration and admin/superuser seeding on first run
- `backend/.env.example` for environment variable documentation

**Open source**
- MIT licence
- `CONTRIBUTING.md` with branch naming conventions and PR process
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- GitHub issue templates (bug report, feature request)
- GitHub pull request template
- `SECURITY.md` with responsible disclosure policy

---

[1.0.0]: https://github.com/davidodediran/certpath/releases/tag/v1.0.0
