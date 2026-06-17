import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Settings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('general');
  const [showHouseholdForm, setShowHouseholdForm] = useState(false);
  const [householdCode, setHouseholdCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
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

  const handleInviteSpouse = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Inviting', inviteEmail);
    setInviteEmail('');
    // TODO: Implement household invite logic
  };

  return (
    <>
      <Head>
        <title>Settings - FinFlow</title>
      </Head>

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Settings
          </h1>
          <p className="text-slate-400">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg overflow-hidden">
              <nav className="flex flex-col">
                {[
                  { id: 'general', label: 'General' },
                  { id: 'household', label: 'Household' },
                  { id: 'categories', label: 'Categories' },
                  { id: 'notifications', label: 'Notifications' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-left px-6 py-3 font-medium transition border-l-4 ${
                      activeTab === tab.id
                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-400'
                        : 'text-slate-300 hover:bg-slate-600/30 border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-8 space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  General Settings
                </h2>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Preferred Currency
                  </label>
                  <select className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>USD ($)</option>
                    <option>EUR (€)</option>
                    <option>GBP (£)</option>
                    <option>ILS (₪)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Date Format
                  </label>
                  <select className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>

                <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition">
                  Save Changes
                </button>
              </div>
            )}

            {/* Household Settings */}
            {activeTab === 'household' && (
              <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-8 space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Household Settings
                </h2>

                <div className="bg-slate-600/50 border border-slate-500 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Invite Your Spouse
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Create a shared household account to view combined finances
                  </p>

                  <form onSubmit={handleInviteSpouse} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Spouse Email
                      </label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="spouse@example.com"
                        className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
                    >
                      Send Invite
                    </button>
                  </form>
                </div>

                <div className="bg-slate-600/50 border border-slate-500 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">
                    Household Members
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Only you for now. Add a spouse to get started!
                  </p>
                </div>
              </div>
            )}

            {/* Categories Settings */}
            {activeTab === 'categories' && (
              <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-8 space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Category Rules
                </h2>
                <p className="text-slate-400 mb-6">
                  Customize how transactions are automatically categorized
                </p>

                <div className="space-y-4">
                  {[
                    { merchant: 'Starbucks', category: 'Dining' },
                    { merchant: 'Whole Foods', category: 'Groceries' },
                    { merchant: 'Netflix', category: 'Subscriptions' },
                  ].map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-600/50 rounded-lg border border-slate-500"
                    >
                      <div>
                        <p className="text-white font-medium">{rule.merchant}</p>
                        <p className="text-slate-400 text-sm">
                          → {rule.category}
                        </p>
                      </div>
                      <button className="text-slate-400 hover:text-red-400 transition">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition">
                  Add New Rule
                </button>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-8 space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Notifications
                </h2>

                <div className="space-y-4">
                  {[
                    {
                      name: 'Budget Alerts',
                      description: 'Notify when spending exceeds budget',
                    },
                    {
                      name: 'Weekly Summary',
                      description: 'Get a weekly summary of your spending',
                    },
                    {
                      name: 'New Transactions',
                      description:
                        'Notify when new transactions are imported',
                    },
                  ].map((notif, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-600/50 rounded-lg border border-slate-500"
                    >
                      <div>
                        <p className="text-white font-medium">{notif.name}</p>
                        <p className="text-slate-400 text-sm">
                          {notif.description}
                        </p>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="rounded"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <button className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition">
                  Save Preferences
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
