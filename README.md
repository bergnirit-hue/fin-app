# FinFlow 💰

A comprehensive personal finance dashboard for tracking expenses, analyzing spending patterns, and managing household finances with your spouse.

![Status](https://img.shields.io/badge/status-MVP%20In%20Development-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### 💳 Transaction Management
- **Multi-source imports**: Upload transactions from banks, credit cards, Bit, PayPal, Google Pay
- **Format support**: Excel (.xlsx), CSV, and more
- **Auto-categorization**: Intelligent 60+ category rules with ML learning potential
- **Smart deduplication**: Detect and merge duplicate transactions
- **Payment service mapping**: Link "Bit Payment" bank entries with actual "Pilates" merchant data

### 📊 Financial Insights
- **Monthly metrics**: Income, expenses, savings, savings rate
- **Category breakdown**: See where your money goes
- **Must-have vs Luxury**: Understand essential vs discretionary spending
- **Yearly trends**: Track patterns over 12+ months
- **Visual charts**: Interactive dashboards with Tailwind-styled components

### 👥 Multi-User Support
- **Separate accounts**: Each spouse has their own login
- **Household view**: See combined finances when linked
- **Shared rules**: Apply categorization rules household-wide
- **Data transparency**: Full visibility of all household transactions

### 🔒 Smart Deduplication
**Exact Match Deduplication:**
- Amount, date, and merchant matching
- Prevents duplicate entries from re-uploads

**Payment Service Mapping:**
```
Bank Statement: "Bit Payment" → $50 on 6/17
Bit App Export: "Pilates Studio" → $50 on 6/17
Result: Single merged transaction "Pilates Studio" (Health category)
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# 1. Clone/navigate to project
cd /Users/nirit/Projects/fin-app

# 2. Install dependencies (already done, but for reference)
npm install

# 3. Setup database (already created, but for reference)
npx prisma migrate dev

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Login
- Email: any@example.com
- Password: any
- Mode: Demo mode accepts all credentials

## Project Structure

```
fin-app/
├── lib/
│   ├── core/              # Business logic
│   │   ├── parser.ts      # CSV/Excel parsing
│   │   ├── deduplication.ts  # Transaction merging
│   │   ├── categorization.ts # Auto-categorization
│   │   ├── classification.ts # Must-have/luxury
│   │   └── calculations.ts   # Monthly/yearly metrics
│   └── utils/
│       ├── db.ts          # Prisma client
│       └── auth.ts        # JWT & passwords
├── pages/
│   ├── _app.tsx           # App wrapper
│   ├── index.tsx          # Dashboard
│   ├── login.tsx          # Login page
│   ├── upload.tsx         # File upload
│   ├── transactions.tsx    # Transaction list
│   ├── settings.tsx       # Settings
│   └── api/               # API endpoints
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database versions
├── styles/
│   └── globals.css        # Tailwind CSS
└── public/                # Static files
```

## Key Capabilities

### 1. Transaction Parsing
Automatically detects and maps columns from Excel/CSV files:
- Date, amount, merchant, description
- Handles various formats (MM/DD/YYYY, D/M/Y, etc.)
- Supports negative amounts and various symbols ($, €, £)

### 2. Smart Categorization
```
Merchant → Category
"Starbucks" → Dining
"Whole Foods" → Groceries
"Netflix" → Subscriptions
"Gym" → Health
```
User can override and create custom rules.

### 3. Household Sync
- User A uploads bank data
- User A invites User B (spouse)
- User B joins household
- Both see combined dashboard
- Deduplication works across both accounts

### 4. Monthly Tracking
- Income vs Expenses
- Category breakdown
- Must-have vs Luxury split
- Savings calculation
- Yearly comparison (12mo+ data)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/signup` - Create account

### Files & Data
- `POST /api/upload` - Upload & process transactions
- `GET /api/dashboard` - Get metrics
- `GET /api/transactions` - List with filters

## Technology Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express-like API routes
- **Database**: SQLite (dev) / PostgreSQL (production)
- **ORM**: Prisma
- **Auth**: JWT
- **File Parsing**: XLSX, CSV Parser
- **Charts**: Recharts (ready to integrate)

## Development

### Build
```bash
npm run build
```

### Type Check
```bash
npm run lint
```

### Database
```bash
# View data browser
npx prisma studio

# Reset database (dev only)
npx prisma migrate reset

# Create migration
npx prisma migrate dev --name description
```

## Documentation

- **[SETUP.md](SETUP.md)** - Setup guide & next steps
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Architecture & implementation details

## Roadmap

### Phase 1 (MVP - Current)
- ✅ Transaction parsing & storage
- ✅ Auto-categorization
- ✅ Monthly metrics
- ⏳ Dashboard real data
- ⏳ Household linking
- ⏳ Payment service mapping testing

### Phase 2 (Enhancement)
- PDF bank statement parsing
- Payment service API sync (Bit, PayPal)
- ML-based categorization
- Recurring transactions
- Budget alerts

### Phase 3 (SaaS)
- Production deployment
- Subscription tiers
- Mobile app (React Native)
- Advanced reporting

## Contributing

This is a personal project. Fork and extend as needed!

## License

MIT

## Support

For questions or issues:
1. Check [SETUP.md](SETUP.md) for setup issues
2. Review [DEVELOPMENT.md](DEVELOPMENT.md) for architecture
3. Check database schema in `prisma/schema.prisma`

---

Built with ❤️ for managing personal finances with clarity and ease.
