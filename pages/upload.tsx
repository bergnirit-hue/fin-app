import { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Upload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState('bank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setSuccess('');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
      setSuccess('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceType', sourceType);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Error uploading file');
        setLoading(false);
        return;
      }

      if (data.transactions && data.transactions.length > 0) {
        setPreview(data.transactions.slice(0, 5));
      }

      setSuccess(
        `✓ File processed successfully! ${data.transactionCount} transactions found`
      );
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setLoading(false);

      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred'
      );
      setLoading(false);
    }
  };

  const sourceOptions = [
    { id: 'bank', label: 'Bank', icon: '🏦' },
    { id: 'bit', label: 'Bit', icon: '💳' },
    { id: 'paypal', label: 'PayPal', icon: '📱' },
    { id: 'google_pay', label: 'Google Pay', icon: '🔵' },
    { id: 'apple_pay', label: 'Apple Pay', icon: '🍎' },
    { id: 'credit_card', label: 'Credit Card', icon: '💰' },
  ];

  return (
    <>
      <Head>
        <title>Upload - FinFlow</title>
      </Head>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Upload Transactions
          </h1>
          <p className="text-slate-400 text-lg">
            Import your bank statements or payment service exports to analyze your spending
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">
              📊 Select Data Source
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {sourceOptions.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSourceType(source.id)}
                  className={`px-4 py-4 rounded-xl font-semibold transition-all duration-300 transform ${
                    sourceType === source.id
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:scale-102'
                  }`}
                >
                  <div className="text-2xl mb-1">{source.icon}</div>
                  <div className="text-sm">{source.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload Drop Zone */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">
              📁 Upload File
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-3 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 transform ${
                dragActive
                  ? 'border-emerald-400 bg-emerald-600/20 scale-105'
                  : file
                  ? 'border-cyan-400 bg-cyan-600/10'
                  : 'border-slate-600 bg-slate-800/30 hover:border-violet-400 hover:bg-violet-600/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="space-y-3">
                <p className={`text-5xl transition-transform ${dragActive ? 'scale-125' : ''}`}>
                  {file ? '✅' : '📤'}
                </p>
                <p className="text-slate-200 font-bold text-lg">
                  {file
                    ? `Selected: ${file.name}`
                    : 'Drag and drop your file here'}
                </p>
                <p className="text-slate-400 text-sm">
                  or click to browse • Supports CSV and Excel files
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="bg-rose-600/20 border border-rose-500/50 text-rose-200 px-5 py-4 rounded-xl flex items-center gap-3">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 px-5 py-4 rounded-xl flex items-center gap-3 animate-pulse">
              <span>✅</span>
              <span>{success}</span>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-gradient-to-br from-slate-700/50 to-slate-800/30 backdrop-blur border border-slate-600/50 rounded-2xl p-8 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>👀</span> Preview (first 5 transactions)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b-2 border-slate-600">
                    <tr className="text-slate-300">
                      <th className="text-left py-3 font-semibold">Date</th>
                      <th className="text-left py-3 font-semibold">Merchant</th>
                      <th className="text-right py-3 font-semibold">Amount</th>
                      <th className="text-left py-3 font-semibold">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {preview.map((tx, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-600/30 transition-colors"
                      >
                        <td className="py-3 text-slate-300">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-slate-200 font-medium">
                          {tx.merchant}
                        </td>
                        <td className="text-right py-3 text-slate-200 font-semibold">
                          ${Math.abs(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span className="px-3 py-1 bg-emerald-600/30 text-emerald-200 text-xs font-semibold rounded-full">
                            {tx.category || 'Uncategorized'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!file || loading}
            className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500 hover:from-emerald-600 hover:via-cyan-600 hover:to-violet-600 text-white rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-lg hover:shadow-2xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                📤 Upload & Process
              </span>
            )}
          </button>
        </form>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoCard
            icon="💾"
            title="Supported Formats"
            description="CSV and Excel files from any bank or payment service"
            color="emerald"
          />
          <InfoCard
            icon="🔒"
            title="Secure & Private"
            description="All transactions are processed securely and encrypted"
            color="cyan"
          />
          <InfoCard
            icon="✨"
            title="Auto-Categorized"
            description="Transactions are automatically categorized and editable"
            color="violet"
          />
        </div>
      </div>
    </>
  );
}

function InfoCard({
  icon,
  title,
  description,
  color,
}: {
  icon: string;
  title: string;
  description: string;
  color: 'emerald' | 'cyan' | 'violet';
}) {
  const colorGradients = {
    emerald: 'from-emerald-600/10 to-emerald-600/5 border-emerald-500/30',
    cyan: 'from-cyan-600/10 to-cyan-600/5 border-cyan-500/30',
    violet: 'from-violet-600/10 to-violet-600/5 border-violet-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorGradients[color]} backdrop-blur border rounded-2xl p-6 hover:shadow-lg transition-all group`}>
      <div className="text-4xl mb-4 group-hover:scale-125 transition-transform">{icon}</div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}
