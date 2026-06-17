import { ParsedTransaction } from './parser';
import { ClassificationType } from './classification';

export interface TransactionWithCategory extends ParsedTransaction {
  category: string;
  classification: ClassificationType;
}

export interface MonthlyMetrics {
  year: number;
  month: number;
  income: number;
  expenses: number;
  savings: number;
  savingsPercentage: number;
  byCategory: {
    [category: string]: {
      amount: number;
      count: number;
      percentage: number;
    };
  };
  byClassification: {
    must_have: number;
    luxury: number;
  };
}

export interface YearlyMetrics {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  averageMonthlySavings: number;
  months: MonthlyMetrics[];
}

export class CalculationEngine {
  static calculateMonthly(
    transactions: TransactionWithCategory[],
    year: number,
    month: number
  ): MonthlyMetrics {
    const monthTransactions = transactions.filter(
      (tx) =>
        tx.date.getFullYear() === year &&
        tx.date.getMonth() + 1 === month
    );

    let income = 0;
    let expenses = 0;
    const byCategory: {
      [key: string]: { amount: number; count: number };
    } = {};
    const byClassification = { must_have: 0, luxury: 0 };

    for (const tx of monthTransactions) {
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        expenses += Math.abs(tx.amount);
      }

      // Category aggregation
      if (!byCategory[tx.category]) {
        byCategory[tx.category] = { amount: 0, count: 0 };
      }
      byCategory[tx.category].amount += Math.abs(tx.amount);
      byCategory[tx.category].count += 1;

      // Classification aggregation
      if (tx.amount < 0) {
        byClassification[tx.classification] += Math.abs(tx.amount);
      }
    }

    const savings = income - expenses;
    const savingsPercentage = income > 0 ? (savings / income) * 100 : 0;

    // Convert category amounts to percentages
    const categoryMetrics: {
      [key: string]: {
        amount: number;
        count: number;
        percentage: number;
      };
    } = {};

    for (const [category, data] of Object.entries(byCategory)) {
      categoryMetrics[category] = {
        amount: data.amount,
        count: data.count,
        percentage:
          expenses > 0 ? (data.amount / expenses) * 100 : 0,
      };
    }

    return {
      year,
      month,
      income,
      expenses,
      savings,
      savingsPercentage,
      byCategory: categoryMetrics,
      byClassification,
    };
  }

  static calculateYearly(
    transactions: TransactionWithCategory[],
    year: number
  ): YearlyMetrics {
    const yearTransactions = transactions.filter(
      (tx) => tx.date.getFullYear() === year
    );

    const months: MonthlyMetrics[] = [];
    let totalIncome = 0;
    let totalExpenses = 0;

    for (let month = 1; month <= 12; month++) {
      const monthMetrics = this.calculateMonthly(
        transactions,
        year,
        month
      );
      months.push(monthMetrics);
      totalIncome += monthMetrics.income;
      totalExpenses += monthMetrics.expenses;
    }

    const totalSavings = totalIncome - totalExpenses;
    const monthsWithData = months.filter(
      (m) => m.income > 0 || m.expenses > 0
    ).length;

    return {
      year,
      totalIncome,
      totalExpenses,
      totalSavings,
      averageMonthlyIncome: totalIncome / 12,
      averageMonthlyExpenses: totalExpenses / 12,
      averageMonthlySavings: totalSavings / 12,
      months,
    };
  }

  static getDateRange(
    transactions: TransactionWithCategory[]
  ): { start: Date; end: Date; monthCount: number } | null {
    if (transactions.length === 0) return null;

    const dates = transactions.map((tx) => tx.date);
    const start = new Date(Math.min(...dates.map((d) => d.getTime())));
    const end = new Date(Math.max(...dates.map((d) => d.getTime())));

    const monthCount =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1;

    return { start, end, monthCount };
  }

  static getTopCategories(
    metrics: MonthlyMetrics[],
    limit: number = 5
  ): Array<{ category: string; amount: number; percentage: number }> {
    const aggregated: {
      [key: string]: { amount: number; percentage: number };
    } = {};

    for (const month of metrics) {
      for (const [category, data] of Object.entries(
        month.byCategory
      )) {
        if (!aggregated[category]) {
          aggregated[category] = { amount: 0, percentage: 0 };
        }
        aggregated[category].amount += data.amount;
      }
    }

    const totalExpenses = Object.values(aggregated).reduce(
      (sum, cat) => sum + cat.amount,
      0
    );

    return Object.entries(aggregated)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage:
          totalExpenses > 0
            ? (data.amount / totalExpenses) * 100
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  static getSpendingTrend(
    metrics: MonthlyMetrics[]
  ): Array<{ month: string; income: number; expenses: number; savings: number }> {
    return metrics.map((m) => ({
      month: `${m.year}-${String(m.month).padStart(2, '0')}`,
      income: m.income,
      expenses: m.expenses,
      savings: m.savings,
    }));
  }
}
