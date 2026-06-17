# FinFlow - Development Guide

A comprehensive personal finance dashboard for tracking expenses, analyzing spending patterns, and managing household finances.

## Project Structure

```
fin-app/
├── lib/
│   ├── core/                          # Core business logic
│   │   ├── parser.ts                 # Excel/CSV parser
│   │   ├── deduplication.ts          # Transaction deduplication & payment service mapping
│   │   ├── categorization.ts         # Automatic categorization engine
│   │   ├── classification.ts         # Must-have vs luxury classification
│   │   └── calculations.ts           # Monthly/yearly metrics
│   └── utils/
│       ├── db.ts                     # Prisma client singleton
│       └── auth.ts                   # JWT & password utilities
├── pages/
│   ├── _app.tsx                      # App wrapper & navigation
│   ├── index.tsx                     # Dashboard
│   ├── login.tsx                     # Login page
│   ├── signup.tsx                    # Signup page
│   ├── upload.tsx                    # File upload & preview
│   ├── transactions.tsx              # Transaction list & filters
│   ├── settings.tsx                  # User settings & preferences
│   └── api/
│       ├── upload.ts                 # File upload API
│       └── auth/
│           ├── login.ts              # Login endpoint
│           └── signup.ts             # Signup endpoint
├── prisma/
│   └── schema.prisma                 # Database schema
├── styles/
│   └── globals.css                   # Tailwind styles
└── data/
    └── categorization-rules.json     # Default categorization rules (optional)
```

## Core Features

### 1. Transaction Parser (`lib/core/parser.ts`)
- Supports Excel (.xlsx, .xls) and CSV formats
- Auto-detects column mapping
- User-configurable column selection
- Handles various date and amount formats

### 2. Deduplication Engine (`lib/core/deduplication.ts`)
**Smart Payment Service Mapping:**
- Detects payment service transactions (Bit, PayPal, Google Pay, Apple Pay)
- Links bank statement entries ("Bit Payment") with actual merchant data ("Pilates")
- Fuzzy matching: amount (±0.01), date (±1 day)
- Confidence scoring (95%+ auto-matches, lower = user review)
- Conflict resolution for ambiguous matches

**Exact Match Deduplication:**
- Prevents duplicate entries from re-uploads
- Matches on: amount, date, merchant name

### 3. Categorization Engine (`lib/core/categorization.ts`)
- 60+ predefined merchant-to-category rules
- Regex pattern matching (case-insensitive)
- User custom rules override defaults
- Supports: Groceries, Dining, Shopping, Transportation, Entertainment, Health, Utilities, Housing, Education, etc.

### 4. Classification Engine (`lib/core/classification.ts`)
- Categorizes as "Must-Have" or "Luxury"
- Pre-configured defaults per category
- User can override per category
- Helps identify discretionary spending

### 5. Calculation Engine (`lib/core/calculations.ts`)
- Monthly metrics: income, expenses, savings, savings %
- Category breakdowns with percentages
- Classification totals (must-have vs luxury)
- Yearly trends and comparisons
- Top categories, spending trends
- Flexible data scaling (shows data when available, yearly charts at 12mo)

## Database Schema

### Models
- **User**: Authentication & preferences
- **Household**: Shared family budget
- **HouseholdMember**: Multi-user linking
- **Transaction**: Individual expense/income entry
  - `sourceType`: bank, bit, paypal, google_pay, apple_pay, etc.
  - `linkedToId`: Cross-source mapping
  - `isDuplicate`, `duplicateOfId`: Deduplication tracking
- **Upload**: File upload history
- **CategorizationRule**: Custom user rules
- **Classification**: Must-have/luxury mappings

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/signup` - Create new account

### File Upload
- `POST /api/upload` - Upload and process transactions
  - Request: multipart/form-data (file, sourceType, columnMapping)
  - Response: parsed transactions with dedup/categorization

### Dashboard
- `GET /api/dashboard` - Monthly metrics & charts data
- `GET /api/dashboard/yearly` - Yearly comparison

### Transactions
- `GET /api/transactions` - List with filters (category, date, classification)
- `GET /api/transactions/:id` - Individual transaction
- `POST /api/transactions/:id/categorize` - Manual category edit
- `POST /api/transactions/:id/classify` - Manual classification edit

### Settings
- `GET /api/settings/rules` - Get categorization rules
- `POST /api/settings/rules` - Add/update rule
- `GET /api/settings/classifications` - Get classification mappings
- `POST /api/settings/classifications/:category` - Update classification

### Household
- `POST /api/household` - Create household
- `POST /api/household/invite` - Invite spouse
- `GET /api/household/members` - List members

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone and setup environment**
```bash
cd /Users/nirit/Projects/fin-app
npm install
cp .env.example .env.local
```

2. **Configure database**
```bash
# Update .env.local with your PostgreSQL connection
DATABASE_URL="postgresql://user:password@localhost:5432/fin-app"
JWT_SECRET="your-secret-key-here"
```

3. **Setup database**
```bash
npx prisma migrate dev --name init
npx prisma db push
```

4. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:3000/login` to get started.

## Development Workflow

### Adding a New Feature

1. **Implement business logic** in `lib/core/`
2. **Create database models** in `prisma/schema.prisma` if needed
3. **Build API endpoint** in `pages/api/`
4. **Create/update UI** in `pages/`
5. **Test integration** across the flow

### Testing the Payment Service Mapper

Example test case:
```
Bank CSV:
- 2024-06-17, $50.00, "Bit Payment"

Bit CSV:
- 2024-06-17, $50.00, "Pilates Studio"

Result:
- Merged transaction with merchant="Pilates Studio", sourceType="bank+bit"
- Single calculation entry
- Categorized as "Health" (from Pilates)
```

### Running Prisma Migrations

```bash
# Create migration
npx prisma migrate dev --name <migration_name>

# Reset database (dev only)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

## Multi-User Setup

### Household Flow
1. User A signs up and creates account
2. User A invites User B (spouse) with email
3. User B accepts and joins household
4. Both see combined transactions
5. Each can upload personal data
6. Deduplication works across both accounts within same household

### Data Visibility
- Personal transactions visible to user who uploaded
- Household transactions visible to all members
- Shared view shows combined spending
- Optional: Personal expenses can be tagged as private

## Deployment Checklist

- [ ] Database migration to production
- [ ] Environment variables configured
- [ ] Auth secrets generated
- [ ] SSL certificates (HTTPS only)
- [ ] Payment service API keys (if Phase 2 APIs added)
- [ ] Backup strategy
- [ ] Rate limiting configured
- [ ] Error logging setup

## Phase 2 Roadmap

- PDF bank statement parsing (OCR)
- Payment service API direct sync (Bit, PayPal, Google Pay)
- ML-based categorization learning
- Recurring transaction detection
- Budget alerts & spending forecasts
- Yearly comparison charts
- Export reports (PDF, CSV)
- Mobile app (React Native)
- SaaS monetization (subscription tiers)

## Troubleshooting

**Issue**: Prisma client not found
```bash
npx prisma generate
```

**Issue**: Column mapping errors
Check that Excel/CSV headers match the columns you're mapping to.

**Issue**: Duplicate detection not working
Verify date format and amount precision (should match within 0.01)

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

MIT
