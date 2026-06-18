import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  classification: string;
  sourceType: string;
}

export default function Transactions() {
  const router = useRouter();
  const { t, formatMoney, formatDate } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] =
    useState<'all' | 'must_have' | 'luxury'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const categories = [
    'all',
    'Groceries',
    'Dining',
    'Shopping',
    'Transportation',
    'Entertainment',
    'Health',
    'Utilities',
    'Housing',
    'Education',
    'Other',
  ];

  // Full category set offered by the inline re-categorization editor —
  // matches the keys the ClassificationEngine knows about so the
  // must-have / luxury type is re-derived correctly on save.
  const CATEGORY_OPTIONS = [
    'Groceries',
    'Dining',
    'Shopping',
    'Transportation',
    'Travel',
    'Entertainment',
    'Subscriptions',
    'Health',
    'Utilities',
    'Housing',
    'Insurance',
    'Education',
    'Personal Care',
    'Pets',
    'Gifts',
    'Office',
    'Other',
  ];

  const handleCategorize = async (id: string, category: string) => {
    setEditingId(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`/api/transactions/${id}/categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? data.transaction : t))
      );
    } catch {
      // keep the existing value on failure
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (classificationFilter !== 'all')
      params.set('classification', classificationFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    (async () => {
      try {
        const res = await fetch(`/api/transactions?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }
        const data = await res.json();
        setTransactions(data.transactions ?? []);
      } catch {
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [router, selectedCategory, classificationFilter, startDate, endDate]);

  // Merchant search is applied client-side for instant feedback; category,
  // classification, and date filters are handled server-side by the API.
  const filteredTransactions = searchQuery
    ? transactions.filter((t) =>
        t.merchant.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions;

  // Translate a source type (e.g. "bank" -> "בנק"), falling back to the raw
  // value for compound sources like "bank+bit".
  const sourceLabel = (source: string) => {
    const label = t(`sources.${source}`);
    return label === `sources.${source}` ? source : label;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-slate-300">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{t('transactions.title')} - ElastiCash</title>
      </Head>

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            {t('transactions.title')}
          </h1>
          <p className="text-slate-400 text-lg">{t('transactions.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder={t('transactions.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-5 py-3 ps-12 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            <span className="absolute start-4 top-3.5 text-xl">🔍</span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all'
                  ? `📊 ${t('transactions.allCategories')}`
                  : t(`categories.${cat}`)}
              </option>
            ))}
          </select>

          {/* Classification Filter */}
          <select
            value={classificationFilter}
            onChange={(e) =>
              setClassificationFilter(
                e.target.value as 'all' | 'must_have' | 'luxury'
              )
            }
            className="px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
          >
            <option value="all">🔹 {t('transactions.allTypes')}</option>
            <option value="must_have">🏠 {t('transactions.mustHave')}</option>
            <option value="luxury">✨ {t('transactions.luxury')}</option>
          </select>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white [color-scheme:dark]">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="From date"
              className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none"
            />
            <span className="text-slate-500">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="To date"
              className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl overflow-hidden shadow-xl">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">🚫</p>
              <p className="text-slate-400 text-lg">{t('transactions.none')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50 border-b border-slate-600/50">
                  <tr>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      📅 {t('transactions.thDate')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      🛍️ {t('transactions.thMerchant')}
                    </th>
                    <th className="text-end px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      💵 {t('transactions.thAmount')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      📂 {t('transactions.thCategory')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      🏷️ {t('transactions.thType')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      📍 {t('transactions.thSource')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-600/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-slate-300">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-6 py-4 text-slate-100 font-semibold">
                        {tx.merchant}
                      </td>
                      <td className="px-6 py-4 text-end font-bold text-slate-100">
                        {formatMoney(Math.abs(tx.amount))}
                      </td>
                      <td className="px-6 py-4">
                        {editingId === tx.id ? (
                          <select
                            autoFocus
                            value={tx.category}
                            onChange={(e) =>
                              handleCategorize(tx.id, e.target.value)
                            }
                            onBlur={() => setEditingId(null)}
                            className="px-3 py-2 bg-slate-700 border border-emerald-500/50 rounded-lg text-emerald-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                          >
                            {CATEGORY_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {t(`categories.${c}`)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingId(tx.id)}
                            title={t('transactions.reCategorize')}
                            className="px-4 py-2 bg-emerald-600/30 text-emerald-200 text-xs font-semibold rounded-full hover:bg-emerald-600/50 transition-colors cursor-pointer"
                          >
                            {t(`categories.${tx.category}`)} ✎
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-4 py-2 text-xs font-semibold rounded-full ${
                            tx.classification === 'must_have'
                              ? 'bg-cyan-600/30 text-cyan-200'
                              : 'bg-violet-600/30 text-violet-200'
                          }`}
                        >
                          {tx.classification === 'must_have'
                            ? `🏠 ${t('transactions.mustHave')}`
                            : `✨ ${t('transactions.luxury')}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm font-medium">
                        {sourceLabel(tx.sourceType)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {filteredTransactions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon="📊"
              label={t('transactions.totalTransactions')}
              value={filteredTransactions.length.toString()}
              color="emerald"
            />
            <StatCard
              icon="💸"
              label={t('transactions.totalAmount')}
              value={formatMoney(
                Math.abs(
                  filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0)
                )
              )}
              color="rose"
            />
            <StatCard
              icon="📈"
              label={t('transactions.avgTransaction')}
              value={formatMoney(
                Math.abs(
                  filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0)
                ) / filteredTransactions.length
              )}
              color="cyan"
            />
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: 'emerald' | 'rose' | 'cyan';
}) {
  const colorGradients = {
    emerald: 'from-emerald-600/10 to-emerald-600/5 border-emerald-500/30',
    rose: 'from-rose-600/10 to-rose-600/5 border-rose-500/30',
    cyan: 'from-cyan-600/10 to-cyan-600/5 border-cyan-500/30',
  };

  const colorValues = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    cyan: 'text-cyan-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorGradients[color]} backdrop-blur border rounded-2xl p-6 hover:shadow-lg transition-all`}>
      <p className="text-slate-400 text-sm font-semibold uppercase tracking-wide">{label}</p>
      <p className={`text-4xl font-black mt-3 ${colorValues[color]}`}>
        {icon} {value}
      </p>
    </div>
  );
}
