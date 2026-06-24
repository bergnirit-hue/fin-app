# FinFlow — Next Session Prompt

Copy everything in the code block below into a new Claude Code session to continue work.

---

```
I'm continuing work on FinFlow, a personal finance dashboard in /Users/nirit/Projects/fin-app.

## What exists and works
- Next.js 16 + TypeScript + Tailwind CSS v4 (PostCSS configured via @tailwindcss/postcss)
- Prisma 5 with SQLite (prisma/dev.db), schema has: User, Household, HouseholdMember,
  Transaction, Upload, CategorizationRule, Classification
- JWT auth in demo mode (any email/password works) — pages/api/auth/login.ts & signup.ts
- All 6 UI pages styled and building cleanly: dashboard (index), login, signup, upload,
  transactions, settings
- Core business logic fully written and unit-testable in lib/core/:
  - parser.ts (Excel/CSV), deduplication.ts (incl. payment-service mapping for
    Bit/PayPal/Google Pay), categorization.ts (60+ rules), classification.ts
    (must-have vs luxury), calculations.ts (monthly/yearly metrics)
- Pushed to https://github.com/bergnirit-hue/fin-app
- Dev server: use the preview tool with config "Next.js Dev Server" (.claude/launch.json)

## The gap
The UI shows hardcoded/sample data. The business logic is NOT yet wired to the database
or the frontend. Specifically:
- pages/api/upload.ts parses + dedupes + categorizes but does NOT save to the DB
- pages/index.tsx (dashboard) shows placeholder numbers, not real queries
- pages/transactions.tsx shows demo transactions, not DB data
- Household linking is UI-only (no backend)

## What I want to do next (in priority order)
1. Wire pages/api/upload.ts to persist parsed transactions via Prisma (lib/utils/db.ts),
   linked to the authenticated user, with the Upload record. Avoid re-inserting exact
   duplicates already in the DB.
2. Build GET /api/dashboard that runs CalculationEngine over the user's stored
   transactions, and make pages/index.tsx fetch from it instead of placeholder data.
3. Build GET /api/transactions (with category/classification/date filters) and wire
   pages/transactions.tsx to it.
4. Add manual re-categorization: POST /api/transactions/:id/categorize and an inline
   editor in the transactions table.

Please start with #1. Read STATUS.md and DEVELOPMENT.md for the full picture, and reuse
the existing engines in lib/core/ rather than rewriting logic. Verify by uploading a test
CSV and confirming rows appear in `npx prisma studio` and on the dashboard.

## Test CSV to use
date,merchant,amount
2024-06-01,Whole Foods,-125.42
2024-06-02,Starbucks,-6.25
2024-06-03,Bit Payment,-50.00
2024-06-04,Salary,5000.00
```

---

## Notes for whoever picks this up
- Don't recreate the core engines — they're done and tested by inspection. The work is
  integration (DB + API + fetch), not new algorithms.
- Tailwind is v4; class names work but there's no large custom theme — keep using utility
  classes directly.
- The dashboard's must-have/luxury split is currently a fake 60/40 — replace it with the
  real `byClassification` totals from CalculationEngine once data is live.
- Multi-user/household and PDF parsing are explicitly Phase 2; don't start them until the
  single-user data flow is solid end-to-end.
