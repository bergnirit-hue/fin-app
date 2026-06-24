import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import {
  CalculationEngine,
  TransactionWithCategory,
} from '@/lib/core/calculations';
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

  const rows = await prisma.transaction.findMany({
    where: { userId: auth.userId, isDuplicate: false, linkedToId: null },
    orderBy: { date: 'asc' },
  });

  if (rows.length === 0) {
    return res.status(200).json(EMPTY);
  }

  const transactions: TransactionWithCategory[] = rows.map((r) => ({
    date: r.date,
    amount: r.amount,
    merchant: r.merchant,
    description: r.description ?? undefined,
    sourceType: r.sourceType,
    category: r.category ?? 'Other',
    classification: (r.classification as ClassificationType) ?? 'variable',
  }));

  // Reuse CalculationEngine over every year present in the data for the
  // headline income / expense / savings / classification figures.
  const years = Array.from(
    new Set(transactions.map((t) => t.date.getFullYear()))
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  let fixed = 0;
  let variable = 0;
  let savingsDebt = 0;
  let incomeClassification = 0;

  for (const year of years) {
    const yearly = CalculationEngine.calculateYearly(transactions, year);
    totalIncome += yearly.totalIncome;
    totalExpenses += yearly.totalExpenses;
    for (const month of yearly.months) {
      fixed += month.byClassification.fixed;
      variable += month.byClassification.variable;
      savingsDebt += month.byClassification.savings_debt;
      incomeClassification += month.byClassification.income;
    }
  }

  const savings = totalIncome - totalExpenses;
  const savingsPercentage =
    totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

  // Expense-only category breakdown. The engine's byCategory also folds in
  // income (it sums abs amounts for every transaction), which would make
  // income categories like "Salary" appear as top spending — so build this
  // directly from the outgoing transactions instead.
  const byCategory: { [category: string]: number } = {};
  for (const tx of transactions) {
    if (tx.amount < 0) {
      byCategory[tx.category] =
        (byCategory[tx.category] ?? 0) + Math.abs(tx.amount);
    }
  }

  // ── Monthly trend (income vs expenses per month) ──
  const monthlyMap: Record<string, { income: number; expenses: number }> = {};
  for (const tx of transactions) {
    const m = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0 };
    if (tx.amount >= 0) monthlyMap[m].income += tx.amount;
    else monthlyMap[m].expenses += Math.abs(tx.amount);
  }
  const monthlyTrend: MonthlyTrendItem[] = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, income: v.income, expenses: v.expenses }));

  // ── Top merchants by spend ──
  const merchantMap: Record<string, { amount: number; count: number }> = {};
  for (const tx of transactions) {
    if (tx.amount < 0) {
      const key = tx.merchant;
      if (!merchantMap[key]) merchantMap[key] = { amount: 0, count: 0 };
      merchantMap[key].amount += Math.abs(tx.amount);
      merchantMap[key].count += 1;
    }
  }
  const topMerchants: TopMerchantItem[] = Object.entries(merchantMap)
    .map(([merchant, v]) => ({ merchant, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // ── Category trend (top 5 categories per month) ──
  const topCats = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([c]) => c);

  const catTrendMap: Record<string, Record<string, number>> = {};
  for (const tx of transactions) {
    if (tx.amount < 0 && topCats.includes(tx.category)) {
      const m = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, '0')}`;
      if (!catTrendMap[m]) catTrendMap[m] = {};
      catTrendMap[m][tx.category] = (catTrendMap[m][tx.category] ?? 0) + Math.abs(tx.amount);
    }
  }
  const categoryTrend: CategoryTrendItem[] = Object.entries(catTrendMap)
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
    transactionCount: transactions.length,
    monthlyTrend,
    topMerchants,
    categoryTrend,
  });
}
