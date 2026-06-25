import Database from 'better-sqlite3';
import { PrismaClient } from '@prisma/client';

const sqlite = new Database('prisma/dev.db', { readonly: true });
const prisma = new PrismaClient();

async function migrate() {
  console.log('Reading from SQLite...');

  const users = sqlite.prepare('SELECT * FROM users').all() as any[];
  const households = sqlite.prepare('SELECT * FROM households').all() as any[];
  const householdMembers = sqlite.prepare('SELECT * FROM household_members').all() as any[];
  const uploads = sqlite.prepare('SELECT * FROM uploads').all() as any[];
  const transactions = sqlite.prepare('SELECT * FROM transactions').all() as any[];
  const rules = sqlite.prepare('SELECT * FROM categorization_rules').all() as any[];
  const classifications = sqlite.prepare('SELECT * FROM classifications').all() as any[];
  const invites = sqlite.prepare('SELECT * FROM household_invites').all() as any[];
  const resetTokens = sqlite.prepare('SELECT * FROM password_reset_tokens').all() as any[];

  console.log(`Found: ${users.length} users, ${households.length} households, ${uploads.length} uploads, ${transactions.length} transactions, ${rules.length} rules, ${classifications.length} classifications`);

  console.log('Writing to Postgres...');

  for (const u of users) {
    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      },
    });
  }
  console.log(`  ✓ ${users.length} users`);

  for (const h of households) {
    await prisma.household.create({
      data: {
        id: h.id,
        name: h.name,
        createdBy: h.createdBy,
        createdAt: new Date(h.createdAt),
        updatedAt: new Date(h.updatedAt),
      },
    });
  }
  console.log(`  ✓ ${households.length} households`);

  for (const m of householdMembers) {
    await prisma.householdMember.create({
      data: {
        id: m.id,
        householdId: m.householdId,
        userId: m.userId,
        role: m.role,
        joinedAt: new Date(m.joinedAt),
      },
    });
  }
  console.log(`  ✓ ${householdMembers.length} household members`);

  for (const u of uploads) {
    await prisma.upload.create({
      data: {
        id: u.id,
        userId: u.userId,
        householdId: u.householdId,
        fileName: u.fileName,
        uploadDate: new Date(u.uploadDate),
        transactionCount: u.transactionCount,
        sourceType: u.sourceType,
        billingTotal: u.billingTotal,
        cardLabel: u.cardLabel,
        fileData: u.fileData,
        fileSize: u.fileSize,
      },
    });
  }
  console.log(`  ✓ ${uploads.length} uploads`);

  const uploadIds = new Set(uploads.map((u: any) => u.id));
  const txIds = new Set(transactions.map((t: any) => t.id));

  for (const t of transactions) {
    await prisma.transaction.create({
      data: {
        id: t.id,
        userId: t.userId,
        householdId: t.householdId,
        date: new Date(t.date),
        amount: t.amount,
        merchant: t.merchant,
        description: t.description,
        category: t.category,
        classification: t.classification,
        sourceType: t.sourceType,
        isDuplicate: t.isDuplicate === 1 || t.isDuplicate === true,
        duplicateOfId: t.duplicateOfId,
        notes: t.notes,
        uploadId: t.uploadId && uploadIds.has(t.uploadId) ? t.uploadId : null,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      },
    });
  }
  const linked = transactions.filter((t: any) => t.linkedToId && txIds.has(t.linkedToId));
  for (const t of linked) {
    await prisma.transaction.update({
      where: { id: t.id },
      data: { linkedToId: t.linkedToId },
    });
  }
  console.log(`  ✓ ${transactions.length} transactions (${linked.length} linked)`);

  for (const r of rules) {
    await prisma.categorizationRule.create({
      data: {
        id: r.id,
        householdId: r.householdId,
        userId: r.userId,
        merchantPattern: r.merchantPattern,
        targetCategory: r.targetCategory,
        isActive: r.isActive === 1 || r.isActive === true,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      },
    });
  }
  console.log(`  ✓ ${rules.length} categorization rules`);

  for (const c of classifications) {
    await prisma.classification.create({
      data: {
        id: c.id,
        householdId: c.householdId,
        userId: c.userId,
        category: c.category,
        type: c.type,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      },
    });
  }
  console.log(`  ✓ ${classifications.length} classifications`);

  for (const i of invites) {
    await prisma.householdInvite.create({
      data: {
        id: i.id,
        householdId: i.householdId,
        email: i.email,
        invitedBy: i.invitedBy,
        token: i.token,
        expiresAt: new Date(i.expiresAt),
        acceptedAt: i.acceptedAt ? new Date(i.acceptedAt) : null,
        createdAt: new Date(i.createdAt),
      },
    });
  }
  console.log(`  ✓ ${invites.length} household invites`);

  for (const r of resetTokens) {
    await prisma.passwordResetToken.create({
      data: {
        id: r.id,
        userId: r.userId,
        token: r.token,
        expiresAt: new Date(r.expiresAt),
        usedAt: r.usedAt ? new Date(r.usedAt) : null,
        createdAt: new Date(r.createdAt),
      },
    });
  }
  console.log(`  ✓ ${resetTokens.length} password reset tokens`);

  console.log('\nMigration complete!');
}

migrate()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    sqlite.close();
  });
