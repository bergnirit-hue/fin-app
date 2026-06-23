import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/utils/db';
import { extractUserFromRequest } from '@/lib/utils/auth';
import {
  CalculationEngine,
  TransactionWithCategory,
} from '@/lib/core/calculations';
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
  });
}
