# Contributing to CertPath

Thank you for taking the time to contribute! This document explains how to get started, what kinds of contributions are welcome, and how the review process works.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Message Style](#commit-message-style)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

By participating in this project you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

---

## Ways to Contribute

- Fix a bug
- Improve documentation
- Add or improve AWS exam questions (via the admin panel, not directly in code)
- Add new exam types or domains
- Improve UI/UX
- Write tests
- Review pull requests

---

## Getting Started

### 1. Fork and clone

```bash
# Fork via GitHub UI, then:
git clone https://github.com/<your-username>/certpath.git
cd certpath
git remote add upstream https://github.com/davidodediran/certpath.git
```

### 2. Set up your environment

```bash
cp backend/.env.example backend/.env
# Fill in your local values — see README for details
```

### 3. Start the app locally

```bash
docker compose up --build
# In a separate terminal:
docker compose exec app node src/db/migrate.js
```

App runs at **http://localhost:3001**

### 4. Keep your fork up to date

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

---

## Development Workflow

1. **Create a branch** from `main`:

```bash
git checkout -b feat/my-feature   # new feature
git checkout -b fix/bug-description  # bug fix
git checkout -b docs/update-readme   # documentation
```

Branch naming conventions:

| Prefix | Use for |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Tooling, config, dependencies |
| `refactor/` | Code changes with no behaviour change |

2. **Make your changes**, keeping commits small and focused.

3. **Test your changes** — run the app, check affected routes/pages manually.

4. **Push and open a PR** against the `main` branch of the upstream repo.

---

## Commit Message Style

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short summary>

Optional longer description explaining WHY, not what.
```

Examples:

```
feat: add CSV export for teacher question bank
fix: enforce session ownership on exam recovery endpoint
docs: add EC2 deployment steps to README
chore: remove stale Railway workflow files
```

Keep the summary line under **72 characters**.

---

## Pull Request Process

1. Ensure your branch is up to date with `main` before opening the PR.
2. Fill in the PR template — describe **what** changed and **why**.
3. Keep PRs focused — one feature or fix per PR.
4. A maintainer will review your PR, leave comments if needed, and merge when ready.
5. PRs that break existing functionality or introduce security issues will be rejected until fixed.

---

## Reporting Bugs

Open a [Bug Report](https://github.com/davidodediran/certpath/issues/new?template=bug_report.md) and include:

- Steps to reproduce
- Expected vs actual behaviour
- Your environment (OS, browser, Node version)
- Screenshots or logs if relevant

---

## Suggesting Features

Open a [Feature Request](https://github.com/davidodediran/certpath/issues/new?template=feature_request.md) describing:

- The problem you are trying to solve
- Your proposed solution
- Any alternatives you considered

---

## Questions?

Open a [GitHub Discussion](https://github.com/davidodediran/certpath/discussions) or file an issue with the `question` label.
