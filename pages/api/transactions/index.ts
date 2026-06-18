import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';

export interface TransactionDTO {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  classification: string;
  sourceType: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ transactions: TransactionDTO[] } | { message: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { category, classification, startDate, endDate } = req.query;

  const where: Prisma.TransactionWhereInput = { userId: auth.userId };

  if (typeof category === 'string' && category && category !== 'all') {
    where.category = category;
  }
  if (
    typeof classification === 'string' &&
    classification &&
    classification !== 'all'
  ) {
    where.classification = classification;
  }
  if (
    (typeof startDate === 'string' && startDate) ||
    (typeof endDate === 'string' && endDate)
  ) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (typeof startDate === 'string' && startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (typeof endDate === 'string' && endDate) {
      // Include the whole end day.
      dateFilter.lte = new Date(`${endDate}T23:59:59.999`);
    }
    where.date = dateFilter;
  }

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  const transactions: TransactionDTO[] = rows.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    merchant: r.merchant,
    amount: r.amount,
    category: r.category ?? 'Other',
    classification: r.classification ?? 'luxury',
    sourceType: r.sourceType,
  }));

  return res.status(200).json({ transactions });
}
