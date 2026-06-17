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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
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
        setError(
          data.message || 'Error uploading file'
        );
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

      // Navigate to dashboard after 2 seconds
      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An error occurred'
      );
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Upload - FinFlow</title>
      </Head>

      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-2">
          Upload Transactions
        </h1>
        <p className="text-slate-400 mb-8">
          Upload your bank statements or payment service exports to analyze
          your spending
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-4">
              Data Source
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { id: 'bank', label: 'Bank' },
                { id: 'bit', label: 'Bit' },
                { id: 'paypal', label: 'PayPal' },
                { id: 'google_pay', label: 'Google Pay' },
                { id: 'apple_pay', label: 'Apple Pay' },
                { id: 'credit_card', label: 'Credit Card' },
              ].map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSourceType(source.id)}
                  className={`px-4 py-3 rounded-lg font-medium transition ${
                    sourceType === source.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {source.label}
                </button>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Select File
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-500 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-slate-700/30 transition"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="space-y-2">
                <p className="text-4xl">📄</p>
                <p className="text-slate-300 font-medium">
                  {file
                    ? `Selected: ${file.name}`
                    : 'Click to select or drag file here'}
                </p>
                <p className="text-slate-400 text-sm">
                  CSV or Excel files
                </p>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-rose-600/20 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Preview (first 5 rows)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-600">
                    <tr>
                      <th className="text-left py-2 text-slate-300">
                        Date
                      </th>
                      <th className="text-left py-2 text-slate-300">
                        Merchant
                      </th>
                      <th className="text-right py-2 text-slate-300">
                        Amount
                      </th>
                      <th className="text-left py-2 text-slate-300">
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((tx, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-600 hover:bg-slate-600/30"
                      >
                        <td className="py-2 text-slate-300">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="py-2 text-slate-300">
                          {tx.merchant}
                        </td>
                        <td className="text-right py-2 text-slate-300">
                          ${Math.abs(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-2">
                          <span className="px-3 py-1 bg-emerald-600/30 text-emerald-200 text-xs rounded-full">
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
            className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Upload & Process'}
          </button>
        </form>

        {/* Info Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-2">
              💾 Supported Formats
            </h3>
            <p className="text-slate-400 text-sm">
              CSV and Excel files from any bank or payment service
            </p>
          </div>
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-2">
              🔒 Your Data
            </h3>
            <p className="text-slate-400 text-sm">
              All transactions are processed securely and stored encrypted
            </p>
          </div>
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-2">
              ✨ Auto-Categorized
            </h3>
            <p className="text-slate-400 text-sm">
              Transactions are automatically categorized and can be manually
              adjusted
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
