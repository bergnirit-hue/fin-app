import type { NextApiRequest, NextApiResponse } from 'next';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { isCreditCardMerchant } from '@/lib/core/reconciliation';

export interface TransactionDTO {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  classification: string;
  sourceType: string;
  /** Nested credit-card details (only present for expandable rows). */
  details?: TransactionDTO[];
  /** `true` when this bank row looks like a CC charge but no detail has
   *  been uploaded yet. */
  detailMissing?: boolean;
  /** Card label for matched CC entries, e.g. "כרטיס 5560 ע״ש נירית ברג". */
  cardLabel?: string;
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

  const where: Prisma.TransactionWhereInput = {
    userId: auth.userId,
    // Exclude linked (child) transactions — they appear nested under
    // their parent bank entry instead.
    linkedToId: null,
  };

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

  // Main transactions (parents + standalone).
  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  // Fetch all linked (child) transactions for expansion.
  const linkedRows = await prisma.transaction.findMany({
    where: { userId: auth.userId, linkedToId: { not: null } },
    orderBy: { date: 'desc' },
  });

  // Group children by their parent ID.
  const detailsMap = new Map<string, TransactionDTO[]>();
  for (const r of linkedRows) {
    const parentId = r.linkedToId!;
    if (!detailsMap.has(parentId)) detailsMap.set(parentId, []);
    detailsMap.get(parentId)!.push({
      id: r.id,
      date: r.date.toISOString(),
      merchant: r.merchant,
      amount: r.amount,
      category: r.category ?? 'Other',
      classification: r.classification ?? 'variable',
      sourceType: r.sourceType,
    });
  }

  const transactions: TransactionDTO[] = rows.map((r) => {
    const details = detailsMap.get(r.id);
    const isNegativeBank = r.sourceType === 'bank' && r.amount < 0;
    const looksLikeCC = isNegativeBank && isCreditCardMerchant(r.merchant);

    return {
      id: r.id,
      date: r.date.toISOString(),
      merchant: r.merchant,
      amount: r.amount,
      category: r.category ?? 'Other',
      classification: r.classification ?? 'variable',
      sourceType: r.sourceType,
      ...(details ? { details } : {}),
      ...(looksLikeCC && !details ? { detailMissing: true } : {}),
      ...(looksLikeCC && r.description ? { cardLabel: r.description } : {}),
    };
  });

  return res.status(200).json({ transactions });
}
