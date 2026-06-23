import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

interface DashboardMetrics {
  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsPercentage: number;
  fixed: number;
  variable: number;
  savingsDebt: number;
  incomeClassification: number;
  byCategory: { [key: string]: number };
}

type PeriodKey = '1m' | '3m' | '6m' | '1y' | 'all' | 'custom';

function periodDates(key: Exclude<PeriodKey, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === 'all') return { from: '', to: '' };
  const from = new Date(now);
  if (key === '1m') from.setMonth(from.getMonth() - 1);
  else if (key === '3m') from.setMonth(from.getMonth() - 3);
  else if (key === '6m') from.setMonth(from.getMonth() - 6);
  else if (key === '1y') from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to };
}

function dateRangeToQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set('from', new Date(from).toISOString());
  if (to) params.set('to', new Date(to + 'T23:59:59').toISOString());
  return params.toString();
}

// Color system from Figma design
const colors = {
  emerald: '#0bbf94',
  cyan: '#06b6d4',
  violet: '#a78bfa',
  rose: '#e11d48',
  amber: '#fdb022',
};

const PERIOD_I18N: Record<PeriodKey, string> = {
  '1m': 'dashboard.periodLastMonth',
  '3m': 'dashboard.periodLast3',
  '6m': 'dashboard.periodLast6',
  '1y': 'dashboard.periodLastYear',
  all: 'dashboard.periodAll',
  custom: 'dashboard.periodCustom',
};

export default function Dashboard() {
  const router = useRouter();
  const { t, formatMoney } = useI18n();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('1m');
  const initialDates = periodDates('1m');
  const [fromDate, setFromDate] = useState(initialDates.from);
  const [toDate, setToDate] = useState(initialDates.to);

  function handlePeriodChange(key: PeriodKey) {
    setPeriod(key);
    if (key !== 'custom') {
      const d = periodDates(key);
      setFromDate(d.from);
      setToDate(d.to);
    }
  }

  function handleDateChange(which: 'from' | 'to', value: string) {
    if (which === 'from') setFromDate(value);
    else setToDate(value);
    setPeriod('custom');
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const qs = dateRangeToQuery(fromDate, toDate);

        const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        const data = await res.json();

        if (!data.hasData) {
          setMetrics(null);
        } else {
          setMetrics({
            totalIncome: data.totalIncome,
            totalExpenses: data.totalExpenses,
            savings: data.savings,
            savingsPercentage: data.savingsPercentage,
            fixed: data.fixed,
            variable: data.variable,
            savingsDebt: data.savingsDebt,
            incomeClassification: data.incomeClassification,
            byCategory: data.byCategory,
          });
        }
      } catch (err) {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, fromDate, toDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-slate-300">{t('common.loading')}</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-200 mb-4">
          {t('dashboard.noData')}
        </h2>
        <p className="text-slate-400 mb-6">{t('dashboard.noDataSub')}</p>
        <button
          onClick={() => router.push('/upload')}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-lg font-medium transition transform hover:scale-105"
        >
          {t('dashboard.uploadFile')}
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
        <title>{t('dashboard.title')} - ElastiCash</title>
      </Head>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Header with gradient */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              {t('dashboard.title')}
            </h1>
            <p className="text-slate-400 text-lg">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value as PeriodKey)}
              className="px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm font-semibold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [color-scheme:dark] cursor-pointer"
            >
              <option value="1m">{t('dashboard.periodLastMonth')}</option>
              <option value="3m">{t('dashboard.periodLast3')}</option>
              <option value="6m">{t('dashboard.periodLast6')}</option>
              <option value="1y">{t('dashboard.periodLastYear')}</option>
              <option value="all">{t('dashboard.periodAll')}</option>
              {period === 'custom' && (
                <option value="custom">{t('dashboard.periodCustom')}</option>
              )}
            </select>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white [color-scheme:dark]">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleDateChange('from', e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none"
              />
              <span className="text-slate-500">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleDateChange('to', e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Key Metrics Grid - 4 Cards with Different Colors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title={t('dashboard.totalIncome')}
            value={formatMoney(metrics.totalIncome)}
            change={`+${formatMoney(metrics.totalIncome)}`}
            icon="💰"
            color="emerald"
            accentColor="from-emerald-600/20 to-emerald-600/5 border-emerald-500/30"
          />
          <MetricCard
            title={t('dashboard.totalExpenses')}
            value={formatMoney(metrics.totalExpenses)}
            change={`−${formatMoney(metrics.totalExpenses)}`}
            icon="💸"
            color="rose"
            accentColor="from-rose-600/20 to-rose-600/5 border-rose-500/30"
          />
          <MetricCard
            title={t('dashboard.totalSavings')}
            value={formatMoney(metrics.savings)}
            change={t('dashboard.pctOfIncome', {
              pct: metrics.savingsPercentage.toFixed(1),
            })}
            icon="🎯"
            color="cyan"
            accentColor="from-cyan-600/20 to-cyan-600/5 border-cyan-500/30"
          />
          <MetricCard
            title={t('dashboard.savingsRate')}
            value={`${metrics.savingsPercentage.toFixed(1)}%`}
            change={t(PERIOD_I18N[period])}
            icon="📈"
            color="violet"
            accentColor="from-violet-600/20 to-violet-600/5 border-violet-500/30"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Top Categories - 2 columns width */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur-lg border border-slate-600/50 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                📊 {t('dashboard.topCategories')}
              </h2>
              <div className="text-sm text-slate-400">
                {t(PERIOD_I18N[period])}
              </div>
            </div>

            <div className="space-y-5">
              {topCategories.map((cat, idx) => {
                const categoryColors = [
                  { bar: 'from-emerald-500 to-emerald-400', accent: 'emerald' },
                  { bar: 'from-cyan-500 to-cyan-400', accent: 'cyan' },
                  { bar: 'from-violet-500 to-violet-400', accent: 'violet' },
                  { bar: 'from-rose-500 to-rose-400', accent: 'rose' },
                  { bar: 'from-amber-500 to-amber-400', accent: 'amber' },
                ];
                const theme = categoryColors[idx % categoryColors.length];

                return (
                  <div key={cat.category} className="group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-200 font-semibold text-sm">
                        {t(`categories.${cat.category}`)}
                      </span>
                      <span className="text-slate-100 font-bold text-lg">
                        {formatMoney(cat.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
                      <div
                        className={`bg-gradient-to-r ${theme.bar} h-3 rounded-full transition-all duration-500 group-hover:shadow-lg`}
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <div className="text-end text-xs text-slate-400 mt-1">
                      {t('dashboard.pctOfExpenses', {
                        pct: cat.percentage.toFixed(1),
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Summary Card - 1 column width */}
          <div className="bg-gradient-to-br from-emerald-600/10 via-cyan-600/10 to-violet-600/10 backdrop-blur-lg border border-emerald-500/20 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              💡 {t('dashboard.summary')}
            </h2>

            <div className="space-y-4">
              <SummaryRow
                label={t('dashboard.income')}
                value={formatMoney(metrics.incomeClassification)}
                color="emerald"
                icon="💰"
              />
              <SummaryRow
                label={t('dashboard.fixed')}
                value={formatMoney(metrics.fixed)}
                color="cyan"
                icon="📌"
              />
              <SummaryRow
                label={t('dashboard.variable')}
                value={formatMoney(metrics.variable)}
                color="violet"
                icon="📊"
              />
              <SummaryRow
                label={t('dashboard.savingsDebt')}
                value={formatMoney(metrics.savingsDebt)}
                color="emerald"
                icon="🏦"
              />

              <div className="border-t border-slate-600/50 pt-4 mt-6">
                <SummaryRow
                  label={t('dashboard.netSavings')}
                  value={formatMoney(metrics.savings)}
                  color="emerald"
                  icon="🎉"
                  isBold
                />
              </div>
            </div>
          </div>
        </div>

        {/* Call-to-Action Section */}
        <div className="bg-gradient-to-r from-emerald-600/20 via-cyan-600/20 to-violet-600/20 backdrop-blur-lg border border-emerald-400/30 rounded-2xl p-8 text-center shadow-2xl">
          <h3 className="text-3xl font-bold text-white mb-3">
            ✨ {t('dashboard.ctaTitle')}
          </h3>
          <p className="text-slate-300 mb-8 text-lg">{t('dashboard.ctaSub')}</p>
          <button
            onClick={() => router.push('/upload')}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95"
          >
            <span dir="ltr">📤 {t('dashboard.uploadNew')}</span>
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
  icon,
  color,
  accentColor,
}: {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  accentColor: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br ${accentColor} backdrop-blur border rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer group`}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wide">{title}</p>
        <span className="text-3xl group-hover:scale-125 transition-transform">{icon}</span>
      </div>
      <p className={`text-4xl font-black mb-2 ${
        color === 'emerald' ? 'text-emerald-400' :
        color === 'rose' ? 'text-rose-400' :
        color === 'cyan' ? 'text-cyan-400' :
        'text-violet-400'
      }`}>
        {value}
      </p>
      <p className="text-sm text-slate-400"><span dir="ltr">{change}</span></p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  color,
  icon,
  isBold,
}: {
  label: string;
  value: string;
  color: string;
  icon?: string;
  isBold?: boolean;
}) {
  const colorMap = {
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/20 hover:bg-slate-700/40 transition-colors">
      <span className={`${isBold ? 'font-bold' : 'font-medium'} text-slate-300 flex items-center gap-2`}>
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className={`font-bold text-lg ${colorMap[color as keyof typeof colorMap]}`}>
        {value}
      </span>
    </div>
  );
}
