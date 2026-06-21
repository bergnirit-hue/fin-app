import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { ClassificationEngine } from '@/lib/core/classification';
import type { TransactionDTO } from '../index';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ transaction: TransactionDTO } | { message: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Invalid transaction id' });
  }

  const category = (req.body?.category ?? '').toString().trim();
  if (!category) {
    return res.status(400).json({ message: 'category is required' });
  }

  // Only allow editing transactions that belong to the authenticated user.
  const existing = await prisma.transaction.findFirst({
    where: { id, userId: auth.userId },
  });
  if (!existing) {
    return res.status(404).json({ message: 'Transaction not found' });
  }

  // Re-derive the classification from the new category.
  // Check user-defined classifications first, then fall back to defaults.
  const userClassification = await prisma.classification.findFirst({
    where: { userId: auth.userId, category },
  });
  const classification = userClassification
    ? userClassification.type
    : new ClassificationEngine().classify(category);

  const updated = await prisma.transaction.update({
    where: { id },
    data: { category, classification },
  });

  // Auto-create a categorization rule: merchant → category.
  // Uses the exact merchant name as the pattern so future uploads of the
  // same merchant are categorized automatically.
  const createRule = req.body?.createRule !== false; // default true
  if (createRule && existing.merchant) {
    const pattern = existing.merchant.trim();
    const existingRule = await prisma.categorizationRule.findFirst({
      where: { userId: auth.userId, merchantPattern: pattern },
    });
    if (existingRule) {
      await prisma.categorizationRule.update({
        where: { id: existingRule.id },
        data: { targetCategory: category, isActive: true },
      });
    } else {
      await prisma.categorizationRule.create({
        data: {
          userId: auth.userId,
          merchantPattern: pattern,
          targetCategory: category,
        },
      });
    }
  }

  // Bulk-update all other transactions with the same merchant name.
  let bulkUpdated = 0;
  if (createRule && existing.merchant) {
    const result = await prisma.transaction.updateMany({
      where: {
        userId: auth.userId,
        merchant: existing.merchant.trim(),
        id: { not: id },
      },
      data: { category, classification },
    });
    bulkUpdated = result.count;
  }

  const transaction: TransactionDTO = {
    id: updated.id,
    date: updated.date.toISOString(),
    merchant: updated.merchant,
    amount: updated.amount,
    category: updated.category ?? 'Other',
    classification: updated.classification ?? 'variable',
    sourceType: updated.sourceType,
  };

  return res.status(200).json({ transaction, bulkUpdated });
}
