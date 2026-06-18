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

  // Re-derive the must-have / luxury classification from the new category.
  const classification = new ClassificationEngine().classify(category);

  const updated = await prisma.transaction.update({
    where: { id },
    data: { category, classification },
  });

  const transaction: TransactionDTO = {
    id: updated.id,
    date: updated.date.toISOString(),
    merchant: updated.merchant,
    amount: updated.amount,
    category: updated.category ?? 'Other',
    classification: updated.classification ?? 'luxury',
    sourceType: updated.sourceType,
  };

  return res.status(200).json({ transaction });
}
