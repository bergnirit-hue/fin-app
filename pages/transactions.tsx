import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] =
    useState<'all' | 'must_have' | 'luxury'>('all');

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load demo transactions
    const demoTransactions: Transaction[] = [
      {
        id: '1',
        date: new Date(Date.now() - 86400000 * 5).toISOString(),
        merchant: 'Whole Foods',
        amount: -125.42,
        category: 'Groceries',
        classification: 'must_have',
        sourceType: 'bank',
      },
      {
        id: '2',
        date: new Date(Date.now() - 86400000 * 4).toISOString(),
        merchant: 'Starbucks',
        amount: -6.25,
        category: 'Dining',
        classification: 'luxury',
        sourceType: 'bank',
      },
      {
        id: '3',
        date: new Date(Date.now() - 86400000 * 3).toISOString(),
        merchant: 'Amazon',
        amount: -45.99,
        category: 'Shopping',
        classification: 'luxury',
        sourceType: 'bank',
      },
      {
        id: '4',
        date: new Date(Date.now() - 86400000 * 2).toISOString(),
        merchant: 'Gym Membership',
        amount: -50.0,
        category: 'Health',
        classification: 'must_have',
        sourceType: 'bank',
      },
      {
        id: '5',
        date: new Date(Date.now() - 86400000).toISOString(),
        merchant: 'Restaurant XYZ',
        amount: -85.5,
        category: 'Dining',
        classification: 'luxury',
        sourceType: 'bank',
      },
    ];

    setTransactions(demoTransactions);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    let filtered = transactions;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }

    if (classificationFilter !== 'all') {
      filtered = filtered.filter(
        (t) => t.classification === classificationFilter
      );
    }

    if (searchQuery) {
      filtered = filtered.filter((t) =>
        t.merchant.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, selectedCategory, classificationFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl text-slate-300">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Transactions - FinFlow</title>
      </Head>

      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Transactions
          </h1>
          <p className="text-slate-400">
            Review and manage your transactions
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search by merchant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
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
            className="px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Types</option>
            <option value="must_have">Must-Have</option>
            <option value="luxury">Luxury</option>
          </select>
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-600/50 border-b border-slate-600">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold text-slate-300">
                      Date
                    </th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-300">
                      Merchant
                    </th>
                    <th className="text-right px-6 py-4 font-semibold text-slate-300">
                      Amount
                    </th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-300">
                      Category
                    </th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-300">
                      Type
                    </th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-300">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  {filteredTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-600/30 transition"
                    >
                      <td className="px-6 py-4 text-slate-300">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-slate-200 font-medium">
                        {tx.merchant}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-300">
                        ${Math.abs(tx.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-emerald-600/30 text-emerald-200 text-xs rounded-full">
                          {tx.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 text-xs rounded-full ${
                            tx.classification === 'must_have'
                              ? 'bg-cyan-600/30 text-cyan-200'
                              : 'bg-violet-600/30 text-violet-200'
                          }`}
                        >
                          {tx.classification === 'must_have'
                            ? 'Must-Have'
                            : 'Luxury'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {tx.sourceType}
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
            <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <p className="text-slate-400 text-sm">Total Transactions</p>
              <p className="text-3xl font-bold text-white mt-2">
                {filteredTransactions.length}
              </p>
            </div>
            <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <p className="text-slate-400 text-sm">Total Amount</p>
              <p className="text-3xl font-bold text-rose-400 mt-2">
                $
                {Math.abs(
                  filteredTransactions.reduce((sum, t) => sum + t.amount, 0)
                ).toFixed(2)}
              </p>
            </div>
            <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
              <p className="text-slate-400 text-sm">Average Transaction</p>
              <p className="text-3xl font-bold text-cyan-400 mt-2">
                $
                {(
                  Math.abs(
                    filteredTransactions.reduce((sum, t) => sum + t.amount, 0)
                  ) / filteredTransactions.length
                ).toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
