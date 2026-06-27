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
  notes?: string | null;
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
    useState<'all' | 'fixed' | 'variable' | 'savings_debt' | 'income'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Array<{ name: string; classification: string; isCustom: boolean }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForTxId, setAddForTxId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'fixed' | 'variable' | 'savings_debt' | 'income'>('variable');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [sortColumn, setSortColumn] = useState<'date' | 'merchant' | 'amount' | 'category' | 'classification' | 'sourceType'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Load categories from API (built-in + custom)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/categories');
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

    try {
      const res = await fetch(`/api/transactions/${id}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const { category: newCat, classification: newClass } = data.transaction;
      const merchantName = data.transaction.merchant;
      const didBulk = (data.bulkUpdated ?? 0) > 0;

      const applyBulkToDetails = (details?: Transaction[]) =>
        details?.map((d) =>
          d.merchant === merchantName ? { ...d, category: newCat, classification: newClass } : d
        );

      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            const details = didBulk ? applyBulkToDetails(t.details) : t.details;
            return { ...t, ...data.transaction, details };
          }
          if (t.details) {
            const idx = t.details.findIndex((d) => d.id === id);
            if (idx !== -1) {
              const updated = didBulk
                ? applyBulkToDetails(t.details)!
                : [...t.details];
              if (!didBulk) updated[idx] = { ...updated[idx], ...data.transaction };
              return { ...t, details: updated };
            }
          }
          if (didBulk && t.merchant === merchantName) {
            return { ...t, category: newCat, classification: newClass, details: applyBulkToDetails(t.details) };
          }
          if (didBulk && t.details?.some((d) => d.merchant === merchantName)) {
            return { ...t, details: applyBulkToDetails(t.details) };
          }
          return t;
        })
      );
    } catch {
      // keep the existing value on failure
    }
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;

    try {
      const catRes = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    setNewCatType('variable');
  };

  const startEditNote = (tx: Transaction) => {
    setEditingNoteId(tx.id);
    setNoteText(tx.notes || '');
  };

  const saveNote = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions/${id}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteText }),
      });
      if (!res.ok) return;
      const data = await res.json();

      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id === id) return { ...t, notes: data.notes };
          if (t.details) {
            const idx = t.details.findIndex((d) => d.id === id);
            if (idx !== -1) {
              const updated = [...t.details];
              updated[idx] = { ...updated[idx], notes: data.notes };
              return { ...t, details: updated };
            }
          }
          return t;
        })
      );
    } catch {
      // keep existing on failure
    } finally {
      setEditingNoteId(null);
      setNoteText('');
    }
  };

  useEffect(() => {
    // On auto-exported pages the router is not ready on the first render.
    // Wait until `isReady` before reading query params or navigating.
    if (!router.isReady) return;

    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (classificationFilter !== 'all')
      params.set('classification', classificationFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    (async () => {
      try {
        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (!res.ok) return;
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

  // Merchant + notes search is applied client-side for instant feedback;
  // category, classification, and date filters are handled server-side by the API.
  const searched = searchQuery
    ? transactions.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
          t.merchant.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
        );
      })
    : transactions;

  const compareTx = (a: { date: string; merchant: string; amount: number; category?: string; classification?: string; sourceType: string }, b: typeof a) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'date':
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'merchant':
        cmp = a.merchant.localeCompare(b.merchant);
        break;
      case 'amount':
        cmp = a.amount - b.amount;
        break;
      case 'category':
        cmp = (a.category ?? '').localeCompare(b.category ?? '');
        break;
      case 'classification':
        cmp = (a.classification ?? '').localeCompare(b.classification ?? '');
        break;
      case 'sourceType':
        cmp = a.sourceType.localeCompare(b.sourceType);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  };

  const filteredTransactions = [...searched].sort(compareTx);

  const toggleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDir(col === 'amount' ? 'desc' : 'asc');
    }
  };

  const sortIndicator = (col: typeof sortColumn) =>
    sortColumn === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

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
            className="px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition [color-scheme:dark] [&>option]:bg-slate-800 [&>option]:text-white"
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
                e.target.value as 'all' | 'fixed' | 'variable' | 'savings_debt' | 'income'
              )
            }
            className="px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition [color-scheme:dark] [&>option]:bg-slate-800 [&>option]:text-white"
          >
            <option value="all">🔹 {t('transactions.allTypes')}</option>
            <option value="income">💰 {t('transactions.income')}</option>
            <option value="fixed">📌 {t('transactions.fixed')}</option>
            <option value="variable">📊 {t('transactions.variable')}</option>
            <option value="savings_debt">🏦 {t('transactions.savingsDebt')}</option>
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
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide cursor-pointer hover:text-emerald-300 transition-colors select-none" onClick={() => toggleSort('date')}>
                      📅 {t('transactions.thDate')}{sortIndicator('date')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide cursor-pointer hover:text-emerald-300 transition-colors select-none" onClick={() => toggleSort('merchant')}>
                      🛍️ {t('transactions.thMerchant')}{sortIndicator('merchant')}
                    </th>
                    <th className="text-end px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide cursor-pointer hover:text-emerald-300 transition-colors select-none" onClick={() => toggleSort('amount')}>
                      💵 {t('transactions.thAmount')}{sortIndicator('amount')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide cursor-pointer hover:text-emerald-300 transition-colors select-none" onClick={() => toggleSort('category')}>
                      📂 {t('transactions.thCategory')}{sortIndicator('category')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide cursor-pointer hover:text-emerald-300 transition-colors select-none" onClick={() => toggleSort('classification')}>
                      🏷️ {t('transactions.thType')}{sortIndicator('classification')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide cursor-pointer hover:text-emerald-300 transition-colors select-none" onClick={() => toggleSort('sourceType')}>
                      📍 {t('transactions.thSource')}{sortIndicator('sourceType')}
                    </th>
                    <th className="text-start px-6 py-4 font-bold text-slate-200 uppercase text-xs tracking-wide">
                      📝 {t('transactions.thNotes')}
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
                            {expandable ? (
                              <span className="text-slate-500 text-xs italic">{t('transactions.seeCharges')}</span>
                            ) : editingId === tx.id ? (
                              <select
                                autoFocus
                                value={tx.category}
                                onChange={(e) =>
                                  handleCategorize(tx.id, e.target.value)
                                }
                                onBlur={() => setTimeout(() => setEditingId(null), 150)}
                                className="px-3 py-2 bg-slate-700 border border-emerald-500/50 rounded-lg text-emerald-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark] [&>option]:bg-slate-800 [&>option]:text-white"
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
                            {expandable ? (
                              <span className="text-slate-500 text-xs italic">{t('transactions.seeCharges')}</span>
                            ) : (
                              <ClassificationBadge classification={tx.classification} t={t} />
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-sm font-medium">
                            {tx.sourceType === 'bit' ? `${sourceLabel('bit')} (יתרה)` : sourceLabel(tx.sourceType)}
                          </td>
                          <td className="px-6 py-4">
                            {editingNoteId === tx.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveNote(tx.id);
                                    if (e.key === 'Escape') setEditingNoteId(null);
                                  }}
                                  autoFocus
                                  className="bg-slate-700/50 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 w-32 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                  placeholder={t('transactions.addNote')}
                                />
                                <button
                                  type="button"
                                  onClick={() => saveNote(tx.id)}
                                  className="text-emerald-400 hover:text-emerald-300 text-sm"
                                >✓</button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="text-slate-500 hover:text-slate-400 text-sm"
                                >✕</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditNote(tx)}
                                className={`text-sm transition-colors ${
                                  tx.notes
                                    ? 'text-cyan-300 hover:text-cyan-200'
                                    : 'text-slate-600 hover:text-slate-400'
                                }`}
                                title={tx.notes || t('transactions.addNote')}
                              >
                                {tx.notes ? (
                                  <span className="flex items-center gap-1">
                                    <span>📝</span>
                                    <span className="truncate max-w-[100px]">{tx.notes}</span>
                                  </span>
                                ) : (
                                  <span>＋</span>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* ── Expanded CC detail rows ── */}
                        {isExpanded &&
                          [...tx.details!].sort(compareTx).map((d) => (
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
                              <td className={`px-6 py-3 text-end text-sm font-semibold ${d.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                <span dir="ltr">{d.amount >= 0 ? '+' : '−'}{formatMoney(Math.abs(d.amount))}</span>
                              </td>
                              <td className="px-6 py-3">
                                {editingId === d.id ? (
                                  <select
                                    autoFocus
                                    value={d.category}
                                    onChange={(e) => handleCategorize(d.id, e.target.value)}
                                    onBlur={() => setTimeout(() => setEditingId(null), 150)}
                                    className="px-2 py-1 bg-slate-700 border border-emerald-500/50 rounded-lg text-emerald-100 text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark] [&>option]:bg-slate-800 [&>option]:text-white"
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
                                    onClick={(e) => { e.stopPropagation(); setEditingId(d.id); }}
                                    title={t('transactions.reCategorize')}
                                    className="px-3 py-1 bg-emerald-600/20 text-emerald-300 text-[10px] font-semibold rounded-full hover:bg-emerald-600/40 transition-colors cursor-pointer"
                                  >
                                    {t(`categories.${d.category}`) !== `categories.${d.category}` ? t(`categories.${d.category}`) : d.category} ✎
                                  </button>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                <ClassificationBadge classification={d.classification} t={t} small />
                              </td>
                              <td className="px-6 py-3 text-slate-500 text-xs">
                                {sourceLabel(d.sourceType)}
                              </td>
                              <td className="px-6 py-3">
                                {editingNoteId === d.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={noteText}
                                      onChange={(e) => setNoteText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveNote(d.id);
                                        if (e.key === 'Escape') setEditingNoteId(null);
                                      }}
                                      autoFocus
                                      className="bg-slate-700/50 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 w-28 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                      placeholder={t('transactions.addNote')}
                                    />
                                    <button type="button" onClick={() => saveNote(d.id)} className="text-emerald-400 text-xs">✓</button>
                                    <button type="button" onClick={() => setEditingNoteId(null)} className="text-slate-500 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditNote(d)}
                                    className={`text-xs transition-colors ${d.notes ? 'text-cyan-300 hover:text-cyan-200' : 'text-slate-600 hover:text-slate-400'}`}
                                    title={d.notes || t('transactions.addNote')}
                                  >
                                    {d.notes ? (
                                      <span className="flex items-center gap-1"><span>📝</span><span className="truncate max-w-[80px]">{d.notes}</span></span>
                                    ) : '＋'}
                                  </button>
                                )}
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
                  onChange={(e) => setNewCatType(e.target.value as 'fixed' | 'variable' | 'savings_debt' | 'income')}
                  className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition [color-scheme:dark]"
                >
                  <option value="income">💰 {t('transactions.income')}</option>
                  <option value="fixed">📌 {t('transactions.fixed')}</option>
                  <option value="variable">📊 {t('transactions.variable')}</option>
                  <option value="savings_debt">🏦 {t('transactions.savingsDebt')}</option>
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
                  setNewCatType('variable');
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

function ClassificationBadge({
  classification,
  t,
  small,
}: {
  classification: string;
  t: (key: string) => string;
  small?: boolean;
}) {
  const config: Record<string, { icon: string; bg: string; text: string; label: string }> = {
    income: { icon: '💰', bg: 'bg-emerald-600/30', text: 'text-emerald-200', label: t('transactions.income') },
    fixed: { icon: '📌', bg: 'bg-cyan-600/30', text: 'text-cyan-200', label: t('transactions.fixed') },
    variable: { icon: '📊', bg: 'bg-violet-600/30', text: 'text-violet-200', label: t('transactions.variable') },
    savings_debt: { icon: '🏦', bg: 'bg-amber-600/30', text: 'text-amber-200', label: t('transactions.savingsDebt') },
  };
  const c = config[classification] || config.variable;

  if (small) {
    return (
      <span className={`text-xs text-slate-500`}>
        {c.icon} {c.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap ${c.bg} ${c.text}`}>
      <span>{c.icon}</span> {c.label}
    </span>
  );
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
