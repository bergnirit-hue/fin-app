import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

interface CategoryItem {
  id?: string;
  name: string;
  classification: string;
  isCustom: boolean;
}

interface RuleItem {
  id: string;
  merchantPattern: string;
  targetCategory: string;
  isActive: boolean;
  createdAt: string;
}

export default function Settings() {
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('general');
  const [showHouseholdForm, setShowHouseholdForm] = useState(false);
  const [householdCode, setHouseholdCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [newRuleMerchant, setNewRuleMerchant] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormClassification, setCategoryFormClassification] = useState('variable');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Decode user from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
    } catch (e) {
      console.error('Invalid token');
    }
  }, [router]);

  const loadCategories = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
      }
    } catch {}
  }, []);

  const loadRules = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === 'categories') loadCategories();
    if (activeTab === 'rules') loadRules();
  }, [activeTab, loadCategories, loadRules]);

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormName('');
    setCategoryFormClassification('variable');
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCategoryFormName(cat.name);
    setCategoryFormClassification(cat.classification);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    const name = categoryFormName.trim();
    if (!name || !categoryFormClassification) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      if (editingCategory?.isCustom && editingCategory.id) {
        const res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, classification: categoryFormClassification }),
        });
        if (res.ok) {
          const data = await res.json();
          setCategories((prev) =>
            prev.map((c) => (c.id === editingCategory.id ? data.category : c))
          );
        }
      } else {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, classification: categoryFormClassification }),
        });
        if (res.ok) {
          const data = await res.json();
          setCategories((prev) => {
            const filtered = prev.filter((c) => c.name !== name);
            return [...filtered, data.category].sort((a, b) => a.name.localeCompare(b.name));
          });
        }
      }
    } catch {}

    setShowCategoryModal(false);
    setCategoryFormName('');
    setCategoryFormClassification('variable');
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {}
  };

  const handleDeleteRule = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
      }
    } catch {}
  };

  const handleAddRule = async () => {
    const merchant = newRuleMerchant.trim();
    const category = newRuleCategory.trim();
    if (!merchant || !category) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ merchantPattern: merchant, targetCategory: category }),
      });
      if (res.ok) {
        const data = await res.json();
        setRules((prev) => [data.rule, ...prev]);
      }
    } catch {}
    setShowAddRuleModal(false);
    setNewRuleMerchant('');
    setNewRuleCategory('');
  };

  const handleInviteSpouse = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Inviting', inviteEmail);
    setInviteEmail('');
    // TODO: Implement household invite logic
  };

  return (
    <>
      <Head>
        <title>{t('settings.title')} - ElastiCash</title>
      </Head>

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            {t('settings.title')}
          </h1>
          <p className="text-slate-400 text-lg">{t('settings.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl overflow-hidden shadow-lg">
              <nav className="flex flex-col divide-y divide-slate-700/50">
                {[
                  { id: 'general', label: t('settings.tabGeneral'), icon: '⚙️' },
                  { id: 'household', label: t('settings.tabHousehold'), icon: '👥' },
                  { id: 'categories', label: t('settings.tabCategories'), icon: '📂' },
                  { id: 'rules', label: t('settings.tabRules'), icon: '🔗' },
                  { id: 'notifications', label: t('settings.tabNotifications'), icon: '🔔' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-start px-6 py-4 font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-emerald-600/20 to-emerald-600/5 text-emerald-400 border-s-4 border-emerald-400'
                        : 'text-slate-300 hover:bg-slate-600/30 border-s-4 border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-lg">{tab.icon}</span>
                      {tab.label}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl p-8 space-y-6 shadow-lg">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <span>⚙️</span> {t('settings.generalTitle')}
                  </h2>
                  <p className="text-slate-400">{t('settings.generalSub')}</p>
                </div>

                <div className="space-y-5 pt-4">
                  <SettingField
                    label={t('settings.emailAddress')}
                    icon="📧"
                    disabled
                    value={user?.email || ''}
                  />

                  <SettingSelect
                    label={t('settings.currency')}
                    icon="💱"
                    options={[
                      { value: 'ils', label: 'ILS (₪)' },
                      { value: 'usd', label: 'USD ($)' },
                      { value: 'eur', label: 'EUR (€)' },
                      { value: 'gbp', label: 'GBP (£)' },
                    ]}
                  />

                  <SettingSelect
                    label={t('settings.dateFormat')}
                    icon="📅"
                    options={[
                      { value: 'ddmmyyyy', label: 'DD/MM/YYYY' },
                      { value: 'mmddyyyy', label: 'MM/DD/YYYY' },
                      { value: 'yyyymmdd', label: 'YYYY-MM-DD' },
                    ]}
                  />
                </div>

                <button className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 mt-6">
                  <span dir="ltr">💾 {t('settings.saveChanges')}</span>
                </button>
              </div>
            )}

            {/* Household Settings */}
            {activeTab === 'household' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 backdrop-blur border border-emerald-500/30 rounded-2xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                    <span>👥</span> {t('settings.inviteTitle')}
                  </h3>
                  <p className="text-slate-400 mb-6">{t('settings.inviteSub')}</p>

                  <form onSubmit={handleInviteSpouse} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-3">
                        {t('settings.spouseEmail')}
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="spouse@example.com"
                        className="w-full px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105"
                    >
                      <span dir="ltr">📨 {t('settings.sendInvite')}</span>
                    </button>
                  </form>
                </div>

                <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl p-8 shadow-lg">
                  <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>👫</span> {t('settings.membersTitle')}
                  </h3>
                  <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
                    <p className="text-slate-400 text-center py-6">
                      📌 {t('settings.membersEmpty')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Categories Settings */}
            {activeTab === 'categories' && (
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl p-8 space-y-6 shadow-lg">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <span>📂</span> {t('settings.customCategories')}
                  </h2>
                  <p className="text-slate-400">{t('settings.customCategoriesSub')}</p>
                </div>

                <div className="space-y-3 pt-4">
                  {categories.length === 0 ? (
                    <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
                      <p className="text-slate-400 text-center py-6">
                        📌 {t('settings.noCustomCategories')}
                      </p>
                    </div>
                  ) : (
                    categories.map((cat) => {
                      const label = t(`categories.${cat.name}`) !== `categories.${cat.name}`
                        ? t(`categories.${cat.name}`)
                        : cat.name;
                      return (
                        <div
                          key={cat.id || cat.name}
                          className="flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl border border-slate-600/50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {cat.classification === 'income' ? '💰' : cat.classification === 'fixed' ? '📌' : cat.classification === 'savings_debt' ? '🏦' : '📊'}
                            </span>
                            <div>
                              <p className="text-white font-semibold">{label}</p>
                              <p className="text-slate-400 text-sm">
                                {cat.classification === 'income'
                                  ? t('transactions.income')
                                  : cat.classification === 'fixed'
                                  ? t('transactions.fixed')
                                  : cat.classification === 'savings_debt'
                                  ? t('transactions.savingsDebt')
                                  : t('transactions.variable')}
                                {' · '}
                                <span className={`text-xs font-semibold ${cat.isCustom ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {cat.isCustom ? t('settings.customBadge') : t('settings.builtInBadge')}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditCategory(cat)}
                              className="text-slate-400 hover:text-cyan-400 transition opacity-0 group-hover:opacity-100 text-lg"
                              title={t('settings.editCategory')}
                            >
                              ✎
                            </button>
                            {cat.isCustom && cat.id && (
                              <button
                                onClick={() => handleDeleteCategory(cat.id!)}
                                className="text-slate-400 hover:text-rose-400 transition opacity-0 group-hover:opacity-100 text-xl"
                                title={t('settings.deleteCategory')}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={openAddCategory}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 mt-4"
                >
                  <span dir="ltr">➕ {t('settings.addCategory')}</span>
                </button>
              </div>
            )}

            {/* Category Add/Edit Modal */}
            {showCategoryModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 rounded-2xl p-8 shadow-2xl w-full max-w-md mx-4">
                  <h3 className="text-2xl font-bold text-white mb-6">
                    {editingCategory ? t('settings.editCategoryTitle') : t('settings.addCategoryTitle')}
                  </h3>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        {t('settings.categoryName')}
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={categoryFormName}
                        onChange={(e) => setCategoryFormName(e.target.value)}
                        placeholder={t('settings.categoryName')}
                        className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        {t('settings.categoryType')}
                      </label>
                      <select
                        value={categoryFormClassification}
                        onChange={(e) => setCategoryFormClassification(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition [color-scheme:dark]"
                      >
                        <option value="fixed">{t('transactions.fixed')}</option>
                        <option value="variable">{t('transactions.variable')}</option>
                        <option value="savings_debt">{t('transactions.savingsDebt')}</option>
                        <option value="income">{t('transactions.income')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={handleSaveCategory}
                      disabled={!categoryFormName.trim()}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all transform hover:scale-105"
                    >
                      <span dir="ltr">💾 {t('settings.saveCategory')}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowCategoryModal(false);
                        setCategoryFormName('');
                        setCategoryFormClassification('variable');
                        setEditingCategory(null);
                      }}
                      className="flex-1 px-6 py-3 bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 rounded-xl font-semibold transition-all"
                    >
                      {t('settings.cancelCategory')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rules Settings */}
            {activeTab === 'rules' && (
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl p-8 space-y-6 shadow-lg">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <span>🔗</span> {t('settings.rulesTitle')}
                  </h2>
                  <p className="text-slate-400">{t('settings.rulesSub')}</p>
                </div>

                <div className="space-y-3 pt-4">
                  {rules.length === 0 ? (
                    <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600/50">
                      <p className="text-slate-400 text-center py-6">
                        📌 {t('settings.noRules')}
                      </p>
                    </div>
                  ) : (
                    rules.map((rule) => {
                      const catLabel = t(`categories.${rule.targetCategory}`) !== `categories.${rule.targetCategory}`
                        ? t(`categories.${rule.targetCategory}`)
                        : rule.targetCategory;
                      return (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl border border-slate-600/50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🏷️</span>
                            <div>
                              <p className="text-white font-semibold">{rule.merchantPattern}</p>
                              <p className="text-slate-400 text-sm">
                                → {catLabel}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-slate-400 hover:text-rose-400 transition opacity-0 group-hover:opacity-100 text-xl"
                            title={t('settings.deleteRule')}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={() => {
                    if (categories.length === 0) loadCategories();
                    setShowAddRuleModal(true);
                  }}
                  className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 mt-4"
                >
                  <span dir="ltr">➕ {t('settings.addRule')}</span>
                </button>
              </div>
            )}

            {/* Add Rule Modal */}
            {showAddRuleModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 rounded-2xl p-8 shadow-2xl w-full max-w-md mx-4">
                  <h3 className="text-2xl font-bold text-white mb-6">
                    {t('settings.addRuleTitle')}
                  </h3>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        {t('settings.merchantName')}
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={newRuleMerchant}
                        onChange={(e) => setNewRuleMerchant(e.target.value)}
                        placeholder={t('settings.merchantName')}
                        className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">
                        {t('settings.targetCategory')}
                      </label>
                      <select
                        value={newRuleCategory}
                        onChange={(e) => setNewRuleCategory(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-600/50 border border-slate-500/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition [color-scheme:dark]"
                      >
                        <option value="">{t('settings.selectCategory')}</option>
                        {categories.filter((c) => c.name !== 'Other').map((c) => {
                          const label = t(`categories.${c.name}`) !== `categories.${c.name}`
                            ? t(`categories.${c.name}`)
                            : c.name;
                          return (
                            <option key={c.name} value={c.name}>{label}</option>
                          );
                        })}
                        <option value="Other">{t('categories.Other')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={handleAddRule}
                      disabled={!newRuleMerchant.trim() || !newRuleCategory}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all transform hover:scale-105"
                    >
                      <span dir="ltr">💾 {t('settings.saveRule')}</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddRuleModal(false);
                        setNewRuleMerchant('');
                        setNewRuleCategory('');
                      }}
                      className="flex-1 px-6 py-3 bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 rounded-xl font-semibold transition-all"
                    >
                      {t('settings.cancelRule')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl p-8 space-y-6 shadow-lg">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <span>🔔</span> {t('settings.notifTitle')}
                  </h2>
                  <p className="text-slate-400">{t('settings.notifSub')}</p>
                </div>

                <div className="space-y-3 pt-4">
                  {[
                    {
                      name: t('settings.notifBudget'),
                      description: t('settings.notifBudgetDesc'),
                      icon: '⚠️',
                    },
                    {
                      name: t('settings.notifWeekly'),
                      description: t('settings.notifWeeklyDesc'),
                      icon: '📊',
                    },
                    {
                      name: t('settings.notifNew'),
                      description: t('settings.notifNewDesc'),
                      icon: '📥',
                    },
                  ].map((notif, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl border border-slate-600/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{notif.icon}</span>
                        <div>
                          <p className="text-white font-semibold">{notif.name}</p>
                          <p className="text-slate-400 text-sm">
                            {notif.description}
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="sr-only"
                          />
                          <div className="w-10 h-6 bg-emerald-600 rounded-full shadow-inner"></div>
                          <div className="absolute start-1 top-1 bg-white w-4 h-4 rounded-full shadow transition-transform"></div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                <button className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all transform hover:scale-105 mt-6">
                  <span dir="ltr">💾 {t('settings.savePrefs')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SettingField({
  label,
  icon,
  value,
  disabled,
}: {
  label: string;
  icon: string;
  value: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <span>{icon}</span> {label}
      </label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        className="w-full px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-400 cursor-not-allowed focus:outline-none"
      />
    </div>
  );
}

function SettingSelect({
  label,
  icon,
  options,
}: {
  label: string;
  icon: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <span>{icon}</span> {label}
      </label>
      <select className="w-full px-5 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
