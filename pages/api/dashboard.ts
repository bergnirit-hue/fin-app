import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { ClassificationType } from '@/lib/core/classification';

export interface DashboardResponse {
  hasData: boolean;
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsPercentage: number;
  fixed: number;
  variable: number;
  savingsDebt: number;
  incomeClassification: number;
  byCategory: { [category: string]: number };
  transactionCount: number;
}

const EMPTY: DashboardResponse = {
  hasData: false,
  totalIncome: 0,
  totalExpenses: 0,
  savings: 0,
  savingsPercentage: 0,
  fixed: 0,
  variable: 0,
  savingsDebt: 0,
  incomeClassification: 0,
  byCategory: {},
  transactionCount: 0,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DashboardResponse | { message: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const auth = extractUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const { from, to } = req.query;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (typeof from === 'string') dateFilter.gte = new Date(from);
  if (typeof to === 'string') dateFilter.lte = new Date(to);

  const rows = await prisma.transaction.findMany({
    where: {
      userId: auth.userId,
      isDuplicate: false,
      linkedToId: null,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    },
    orderBy: { date: 'asc' },
  });

  if (rows.length === 0) {
    return res.status(200).json(EMPTY);
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  let fixed = 0;
  let variable = 0;
  let savingsDebt = 0;
  let incomeClassification = 0;
  const byCategory: { [category: string]: number } = {};

  for (const r of rows) {
    const cls = (r.classification as ClassificationType) ?? 'variable';
    if (r.amount >= 0) {
      totalIncome += r.amount;
    } else {
      totalExpenses += Math.abs(r.amount);
      byCategory[r.category ?? 'Other'] =
        (byCategory[r.category ?? 'Other'] ?? 0) + Math.abs(r.amount);
    }
    if (cls === 'fixed') fixed += Math.abs(r.amount);
    else if (cls === 'variable') variable += Math.abs(r.amount);
    else if (cls === 'savings_debt') savingsDebt += Math.abs(r.amount);
    else if (cls === 'income') incomeClassification += r.amount;
  }

  const savings = totalIncome - totalExpenses;
  const savingsPercentage =
    totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  return res.status(200).json({
    hasData: true,
    totalIncome,
    totalExpenses,
    savings,
    savingsPercentage,
    fixed,
    variable,
    savingsDebt,
    incomeClassification,
    byCategory,
    transactionCount: rows.length,
  });
}
