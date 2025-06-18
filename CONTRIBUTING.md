# Contributing to Algolia Salesforce B2C Commerce

This document explains the steps required to get the project running, run the automated test-suite, and submit changes in a way that is easy for the maintainers to review.

## 1. Prerequisites

Before you start, make sure you:

- Access to a **Salesforce B2C Commerce sandbox** that contains the *RefArch* storefront
- Have an **Algolia application** with an Admin API key.

## 2. Project layout (quick tour)

- `cartridges/` – server-side cartridge sources.
- `cypress/` – end-to-end test suite.
- `scripts/` – helper scripts run by npm tasks.
- `test/` - includes test files

## 3. Environment variables

The test-suite and some scripts rely on a few secrets that **must not be committed to the repository**.
Create a `.env` file at the project root (it is already in `.gitignore`) by using `.env.example` file.

### 3.1 Creating the test shopper (one-time)

Storefront User credentials
```
"test@algolia.com",
"password":"Algolia2025!"
```

Cypress logs in with the email/password above.
If that account doesn't exist on your sandbox yet, you can create it:

1. Open the storefront ➜ *My Account* ➜ *Register* and sign up **manually** using the following credentisals

## 5. Useful npm scripts

- `npm run lint:js` – ESLint, Stylelint, and Prettier checks.
- `npm test:unit` – Jest unit tests.
- `npm run test:frontend` – run Cypress tests headlessly (CI default).
- `npm run test:e2e` - run E2E tests

## 6. Commit messages

For commit messages, we follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (e.g. `feat: add OCAPI script to create test user`).  This helps automate changelog generation.

## 7. Pull request checklist

Before requesting review, please ensure:

1. Tests & linter pass (`npm run test:e2e` on your machine).
3. Documentation is updated (README, this file, or inline JSDoc).
4. No secrets or large binaries are committed.
5. A Clear PR description that explains what is changed.

## 8. Questions?

If anything is unclear or you run into issues, feel free to open an issue or start a discussion.
Happy coding!