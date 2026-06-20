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
  details?: Transaction[];
  detailMissing?: boolean;
  cardLabel?: string;
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
  const [allCategories, setAllCategories] = useState<Array<{ name: string; classification: string; isCustom: boolean }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForTxId, setAddForTxId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'must_have' | 'luxury'>('must_have');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load categories from API (built-in + custom)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/categories', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAllCategories(data.categories);
        }
      } catch {}
    })();
  }, []);

  const categoryNames = allCategories.map((c) => c.name);
  const filterCategories = ['all', ...categoryNames.filter((c) => c !== 'Other'), 'Other'].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  const handleCategorize = async (id: string, category: string) => {
    if (category === '__add__') {
      setAddForTxId(id);
      setShowAddModal(true);
      return;
    }

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

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // 1. Create the category
      const catRes = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, classification: newCatType }),
      });
      if (!catRes.ok) return;
      const catData = await catRes.json();

      // Add to local state
      setAllCategories((prev) => {
        const filtered = prev.filter((c) => c.name !== name);
        return [...filtered, catData.category].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });

      // 2. If triggered from a transaction, re-categorize it
      if (addForTxId) {
        await handleCategorize(addForTxId, name);
      }
    } catch {}

    setShowAddModal(false);
    setAddForTxId(null);
    setNewCatName('');
    setNewCatType('must_have');
  };

  useEffect(() => {
    // On auto-exported pages the router is not ready on the first render.
    // Wait until `isReady` before reading query params or navigating.
    if (!router.isReady) return;

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
  }, [router.isReady, selectedCategory, classificationFilter, startDate, endDate]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            {filterCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all'
                  ? `📊 ${t('transactions.allCategories')}`
                  : (t(`categories.${cat}`) !== `categories.${cat}` ? t(`categories.${cat}`) : cat)}
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
                  {filteredTransactions.map((tx) => {
                    const expandable = !!(tx.details && tx.details.length > 0);
                    const isExpanded = expandedIds.has(tx.id);

                    return (
                      <TransactionRows key={tx.id}>
                        {/* ── Main row ── */}
                        <tr
                          className={`hover:bg-slate-600/30 transition-colors ${
                            expandable || tx.detailMissing
                              ? 'cursor-pointer'
                              : ''
                          } ${isExpanded ? 'bg-slate-600/20' : ''}`}
                          onClick={
                            expandable
                              ? () => toggleExpand(tx.id)
                              : undefined
                          }
                        >
                          <td className="px-6 py-4 text-slate-300">
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-6 py-4 text-slate-100 font-semibold">
                            <div className="flex items-center gap-2 flex-wrap">
                              {expandable && (
                                <span
                                  className={`text-xs text-slate-400 transition-transform inline-block ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                >
                                  ▶
                                </span>
                              )}
                              <span>{tx.merchant}</span>
                              {tx.detailMissing && (
                                <span className="px-2 py-0.5 bg-amber-600/30 text-amber-300 text-[10px] font-bold rounded-full whitespace-nowrap">
                                  {t('transactions.detailMissing')}
                                </span>
                              )}
                              {expandable && (
                                <span className="px-2 py-0.5 bg-cyan-600/20 text-cyan-300 text-[10px] font-bold rounded-full whitespace-nowrap">
                                  💳 {tx.details!.length} {t('transactions.charges')}
                                </span>
                              )}
                              {tx.cardLabel && (
                                <span className="px-2 py-0.5 bg-violet-600/25 text-violet-300 text-[10px] font-bold rounded-full whitespace-nowrap">
                                  {tx.cardLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-end font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span dir="ltr">{tx.amount >= 0 ? '+' : '−'}{formatMoney(Math.abs(tx.amount))}</span>
                          </td>
                          <td className="px-6 py-4">
                            {editingId === tx.id ? (
                              <select
                                autoFocus
                                value={tx.category}
                                onChange={(e) =>
                                  handleCategorize(tx.id, e.target.value)
                                }
                                onBlur={() => setTimeout(() => setEditingId(null), 150)}
                                className="px-3 py-2 bg-slate-700 border border-emerald-500/50 rounded-lg text-emerald-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                              >
                                {categoryNames.filter((c) => c !== 'Other').map((c) => (
                                  <option key={c} value={c}>
                                    {t(`categories.${c}`) !== `categories.${c}` ? t(`categories.${c}`) : c}
                                  </option>
                                ))}
                                <option value="Other">{t('categories.Other')}</option>
                                <option value="__add__">➕ {t('transactions.addCategory')}</option>
                              </select>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditingId(tx.id); }}
                                title={t('transactions.reCategorize')}
                                className="px-4 py-2 bg-emerald-600/30 text-emerald-200 text-xs font-semibold rounded-full hover:bg-emerald-600/50 transition-colors cursor-pointer"
                              >
                                {t(`categories.${tx.category}`) !== `categories.${tx.category}` ? t(`categories.${tx.category}`) : tx.category} ✎
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

                        {/* ── Expanded CC detail rows ── */}
                        {isExpanded &&
                          tx.details!.map((d, idx) => (
                            <tr
                              key={d.id}
                              className="bg-slate-800/60 border-s-4 border-cyan-500/40"
                            >
                              <td className="px-6 py-3 text-slate-400 text-sm">
                                {formatDate(d.date)}
                              </td>
                              <td className="px-6 py-3 text-slate-300 text-sm ps-10">
                                ↳ {d.merchant}
                              </td>
                              <td className="px-6 py-3 text-end text-sm font-semibold text-rose-300">
                                <span dir="ltr">−{formatMoney(Math.abs(d.amount))}</span>
                              </td>
                              <td className="px-6 py-3">
                                <span className="px-3 py-1 bg-emerald-600/20 text-emerald-300 text-[10px] font-semibold rounded-full">
                                  {t(`categories.${d.category}`) !== `categories.${d.category}` ? t(`categories.${d.category}`) : d.category}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                <span className="text-xs text-slate-500">
                                  {d.classification === 'must_have'
                                    ? `🏠 ${t('transactions.mustHave')}`
                                    : `✨ ${t('transactions.luxury')}`}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-slate-500 text-xs">
                                💳
                              </td>
                            </tr>
                          ))}
                      </TransactionRows>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        {filteredTransactions.length > 0 && (() => {
          const totalIncome = filteredTransactions
            .filter((tx) => tx.amount >= 0)
            .reduce((sum, tx) => sum + tx.amount, 0);
          const totalExpense = filteredTransactions
            .filter((tx) => tx.amount < 0)
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
          const net = totalIncome - totalExpense;

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                icon="📥"
                label={t('dashboard.totalIncome')}
                value={`+${formatMoney(totalIncome)}`}
                color="emerald"
                ltr
              />
              <StatCard
                icon="📤"
                label={t('dashboard.totalExpenses')}
                value={`−${formatMoney(totalExpense)}`}
                color="rose"
                ltr
              />
              <StatCard
                icon={net >= 0 ? '📈' : '📉'}
                label={t('dashboard.netSavings')}
                value={`${net >= 0 ? '+' : '−'}${formatMoney(Math.abs(net))}`}
                color="cyan"
                ltr
              />
            </div>
          );
        })()}
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 rounded-2xl p-8 shadow-2xl w-full max-w-md mx-4">
            <h3 className="text-2xl font-bold text-white mb-6">
              {t('transactions.addCategoryTitle')}
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  {t('transactions.categoryName')}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder={t('transactions.categoryName')}
                  className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  {t('transactions.categoryType')}
                </label>
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as 'must_have' | 'luxury')}
                  className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition [color-scheme:dark]"
                >
                  <option value="must_have">🏠 {t('transactions.mustHave')}</option>
                  <option value="luxury">✨ {t('transactions.luxury')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all transform hover:scale-105"
              >
                <span dir="ltr">💾 {t('transactions.save')}</span>
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddForTxId(null);
                  setNewCatName('');
                  setNewCatType('must_have');
                  setEditingId(null);
                }}
                className="flex-1 px-6 py-3 bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 rounded-xl font-semibold transition-all"
              >
                {t('transactions.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Thin wrapper so we can return multiple `<tr>` elements from a `.map()`. */
function TransactionRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function StatCard({
  icon,
  label,
  value,
  color,
  ltr,
}: {
  icon: string;
  label: string;
  value: string;
  color: 'emerald' | 'rose' | 'cyan';
  ltr?: boolean;
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
        {icon} {ltr ? <span dir="ltr">{value}</span> : value}
      </p>
    </div>
  );
}
