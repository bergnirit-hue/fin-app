import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import { ClassificationType } from '@/lib/core/classification';

export interface MonthlyTrendItem {
  month: string; // "2025-01"
  income: number;
  expenses: number;
}

export interface TopMerchantItem {
  merchant: string;
  amount: number;
  count: number;
}

export interface CategoryTrendItem {
  month: string;
  [category: string]: string | number; // month is string, rest are numbers
}

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
  monthlyTrend: MonthlyTrendItem[];
  topMerchants: TopMerchantItem[];
  categoryTrend: CategoryTrendItem[];
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
  monthlyTrend: [],
  topMerchants: [],
  categoryTrend: [],
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

  // ── Monthly trend (income vs expenses per month) ──
  const monthlyMap: Record<string, { income: number; expenses: number }> = {};
  for (const r of rows) {
    const m = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0 };
    if (r.amount >= 0) monthlyMap[m].income += r.amount;
    else monthlyMap[m].expenses += Math.abs(r.amount);
  }
  const monthlyTrend = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, income: v.income, expenses: v.expenses }));

  // ── Top merchants by spend ──
  const merchantMap: Record<string, { amount: number; count: number }> = {};
  for (const r of rows) {
    if (r.amount < 0) {
      const key = r.merchant;
      if (!merchantMap[key]) merchantMap[key] = { amount: 0, count: 0 };
      merchantMap[key].amount += Math.abs(r.amount);
      merchantMap[key].count += 1;
    }
  }
  const topMerchants = Object.entries(merchantMap)
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // ── Category trend (top 5 categories per month) ──
  const topCats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([c]) => c);

  const catTrendMap: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const cat = r.category ?? 'Other';
    if (r.amount < 0 && topCats.includes(cat)) {
      const m = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
      if (!catTrendMap[m]) catTrendMap[m] = {};
      catTrendMap[m][cat] = (catTrendMap[m][cat] ?? 0) + Math.abs(r.amount);
    }
  }
  const categoryTrend = Object.entries(catTrendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cats]) => ({ month, ...cats }));

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
    monthlyTrend,
    topMerchants,
    categoryTrend,
  });
}
