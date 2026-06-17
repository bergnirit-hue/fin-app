# FinFlow - Quick Start Card

## 🚀 Run the App
```bash
npm run dev
# Opens: http://localhost:3000
```

## 🔑 Login
- **Email:** any@example.com
- **Password:** anything
- **Mode:** Demo mode (accepts all)

## 📁 Key Directories

| Path | Purpose |
|------|---------|
| `lib/core/` | Business logic (parser, dedup, categorization) |
| `pages/` | All UI pages and API endpoints |
| `prisma/` | Database schema and migrations |
| `styles/` | Tailwind CSS styling |
| `public/` | Static assets |

## 💡 Key Files

| File | What It Does |
|------|-------------|
| `lib/core/parser.ts` | Parses Excel/CSV files |
| `lib/core/deduplication.ts` | Merges duplicate transactions |
| `lib/core/categorization.ts` | Auto-categorizes transactions |
| `lib/core/calculations.ts` | Calculates monthly/yearly metrics |
| `pages/index.tsx` | Dashboard |
| `pages/upload.tsx` | File upload |
| `pages/api/upload.ts` | Upload processing |
| `prisma/schema.prisma` | Database structure |

## 🔄 Common Tasks

### Start Dev Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### View Database UI
```bash
npx prisma studio
# Opens: localhost:5555
```

### Check TypeScript
```bash
npm run lint
```

### Reset Database (dev only)
```bash
npx prisma migrate reset
```

## 📊 What's Ready to Use

✅ **Fully Implemented:**
- Transaction parser (CSV/Excel)
- Deduplication with payment service mapping
- 60+ category rules
- Must-have vs luxury classification
- Monthly/yearly calculations
- Complete database schema
- Authentication system
- UI for all pages

⏳ **Need Connection:**
- Upload API → Database
- Dashboard → Real data
- Transactions → DB queries
- Settings → Store preferences

## 🎯 Next 30-Minute Task

1. Open `pages/api/upload.ts`
2. Add this after line 105 (in the response):
```typescript
// TODO: Save parsed transactions to database
const savedTransactions = await prisma.transaction.createMany({
  data: classified.map(tx => ({
    date: tx.date,
    amount: tx.amount,
    merchant: tx.merchant,
    category: tx.category,
    classification: tx.classification,
    sourceType: tx.sourceType,
    userId: user?.userId, // from auth
    household Id: null, // for now
  })),
});
```

3. Test: Upload a CSV file and check `npx prisma studio`

## 📝 Create Test CSV

Save as `test.csv`:
```csv
date,merchant,amount
2024-06-01,Whole Foods,-125.42
2024-06-02,Starbucks,-6.25
2024-06-03,Amazon,-45.99
2024-06-04,Gym,-50.00
2024-06-05,Restaurant,-85.50
```

Then upload in the app at `/upload`

## 🧪 Test Payment Service Mapping

1. Create two CSVs:
   - **bank.csv**: Contains "Bit Payment $50" entry
   - **bit.csv**: Contains "Pilates Studio $50" entry

2. Upload bank.csv first (sourceType=bank)
3. Upload bit.csv (sourceType=bit)
4. See them merge with "Pilates Studio" as final merchant

## 🐛 Quick Debug

**Issue: Can't start dev server**
```bash
# Kill any running next processes
pkill -f "next dev"
# Try again
npm run dev
```

**Issue: Database locked**
```bash
# Reset database
npx prisma migrate reset

# Regenerate client
npx prisma generate
```

**Issue: TypeScript errors**
```bash
# Update types
npm install --save-dev @types/node
npm run build
```

## 📈 Progress Checklist

- [x] Project setup complete
- [x] Core logic implemented
- [x] UI pages created
- [x] Database schema ready
- [ ] Connect upload to database (NEXT)
- [ ] Real dashboard data
- [ ] Household linking
- [ ] Payment service testing
- [ ] Charts & visualization
- [ ] Production deployment

## 🔗 Documentation Links

- **[README.md](README.md)** - Project overview
- **[SETUP.md](SETUP.md)** - Detailed setup
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Architecture
- **[STATUS.md](STATUS.md)** - Completion status

## 💬 Quick Help

| Problem | Solution |
|---------|----------|
| App won't start | Run `npm install`, then `npm run dev` |
| Database errors | Run `npx prisma migrate reset` |
| Can't find file | Check path with `ls -la path/` |
| TypeScript issues | Run `npm run build` to see full errors |
| Port 3000 in use | Kill process: `pkill -f "next dev"` |

## 🎯 Success Metrics

When complete:
- [x] App runs without errors
- [x] Can login with demo credentials
- [x] Can upload CSV/Excel files
- [x] File is parsed and displayed
- [ ] Transactions saved to database
- [ ] Dashboard shows real data
- [ ] Filters work on transactions
- [ ] Settings page works

---

**Last Updated:** 2026-06-17  
**Status:** ✅ Ready for Development
