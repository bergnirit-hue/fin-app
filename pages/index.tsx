import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

interface DashboardMetrics {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsPercentage: number;
  byCategory: { [key: string]: number };
}

export default function Dashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // For now, show placeholder data
    setMetrics({
      totalIncome: 5000,
      totalExpenses: 3500,
      savings: 1500,
      savingsPercentage: 30,
      byCategory: {
        Groceries: 800,
        Dining: 600,
        Transportation: 400,
        Entertainment: 350,
        Shopping: 500,
        Utilities: 300,
        Other: 150,
      },
    });

    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-slate-300">Loading...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-200 mb-4">
          No data yet
        </h2>
        <p className="text-slate-400 mb-6">
          Start by uploading your first file
        </p>
        <button
          onClick={() => router.push('/upload')}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
        >
          Upload File
        </button>
      </div>
    );
  }

  const topCategories = Object.entries(metrics.byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / metrics.totalExpenses) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <>
      <Head>
        <title>Dashboard - FinFlow</title>
      </Head>

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Dashboard
          </h1>
          <p className="text-slate-400">
            Track your finances and spending patterns
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Income"
            value={`$${metrics.totalIncome.toFixed(2)}`}
            change={`+${metrics.totalIncome.toFixed(2)}`}
            color="emerald"
          />
          <MetricCard
            title="Total Expenses"
            value={`$${metrics.totalExpenses.toFixed(2)}`}
            change={`-${metrics.totalExpenses.toFixed(2)}`}
            color="rose"
          />
          <MetricCard
            title="Savings"
            value={`$${metrics.savings.toFixed(2)}`}
            change={`${metrics.savingsPercentage.toFixed(1)}%`}
            color="cyan"
          />
          <MetricCard
            title="Savings Rate"
            value={`${metrics.savingsPercentage.toFixed(1)}%`}
            change="of income"
            color="violet"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Categories */}
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Top Spending Categories
            </h2>
            <div className="space-y-4">
              {topCategories.map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 font-medium">
                      {cat.category}
                    </span>
                    <span className="text-slate-200 font-semibold">
                      ${cat.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-2 rounded-full"
                      style={{
                        width: `${cat.percentage}%`,
                      }}
                    ></div>
                  </div>
                  <div className="text-right text-sm text-slate-400 mt-1">
                    {cat.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-br from-emerald-600/10 to-cyan-600/10 backdrop-blur border border-emerald-400/20 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Summary
            </h2>
            <div className="space-y-4">
              <SummaryRow
                label="Income"
                value={`$${metrics.totalIncome.toFixed(2)}`}
                color="emerald"
              />
              <SummaryRow
                label="Must-Have Expenses"
                value={`$${(metrics.totalExpenses * 0.6).toFixed(2)}`}
                color="cyan"
              />
              <SummaryRow
                label="Luxury Expenses"
                value={`$${(metrics.totalExpenses * 0.4).toFixed(2)}`}
                color="violet"
              />
              <div className="border-t border-slate-600 pt-4 mt-4">
                <SummaryRow
                  label="Net Savings"
                  value={`$${metrics.savings.toFixed(2)}`}
                  color="emerald"
                  isBold
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            Ready to add more data?
          </h3>
          <p className="text-slate-400 mb-6">
            Upload transactions from multiple sources to get a complete
            picture of your finances
          </p>
          <button
            onClick={() => router.push('/upload')}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-lg font-medium transition"
          >
            Upload New File
          </button>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  title,
  value,
  change,
  color,
}: {
  title: string;
  value: string;
  change: string;
  color: string;
}) {
  const colorClasses = {
    emerald: 'from-emerald-600/20 to-emerald-600/5 border-emerald-400/20',
    rose: 'from-rose-600/20 to-rose-600/5 border-rose-400/20',
    cyan: 'from-cyan-600/20 to-cyan-600/5 border-cyan-400/20',
    violet: 'from-violet-600/20 to-violet-600/5 border-violet-400/20',
  };

  return (
    <div
      className={`bg-gradient-to-br ${
        colorClasses[color as keyof typeof colorClasses]
      } backdrop-blur border rounded-lg p-6`}
    >
      <p className="text-slate-400 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold text-white mt-2">{value}</p>
      <p className="text-sm text-slate-400 mt-2">{change}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  color,
  isBold,
}: {
  label: string;
  value: string;
  color: string;
  isBold?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${isBold ? 'font-semibold' : ''} text-slate-300`}>
        {label}
      </span>
      <span
        className={`font-bold ${
          color === 'emerald'
            ? 'text-emerald-400'
            : color === 'cyan'
            ? 'text-cyan-400'
            : 'text-violet-400'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
