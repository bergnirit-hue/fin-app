import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

interface UploadRecord {
  id: string;
  fileName: string;
  uploadDate: string;
  transactionCount: number;
  sourceType: string;
  billingTotal: number | null;
  cardLabel: string | null;
  fileSize: number | null;
  hasFile: boolean;
}

export default function Upload() {
  const router = useRouter();
  const { t, formatMoney, formatDate } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [sourceType, setSourceType] = useState('bank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'archive'>('upload');
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/uploads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUploads(data);
      }
    } catch {
      // silent
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchUploads();
    }
  }, [activeTab, fetchUploads]);

  const handleDelete = async (uploadId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/uploads/${uploadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        setSuccess(t('upload.archiveDeleted'));
      }
    } catch {
      setError(t('upload.error'));
    } finally {
      setDeleteConfirm(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles).filter(
      (f) =>
        f.name.endsWith('.csv') ||
        f.name.endsWith('.xlsx') ||
        f.name.endsWith('.xls')
    );
    if (incoming.length === 0) return;
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
    setError('');
    setSuccess('');
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError(t('upload.errorSelect'));
      return;
    }

    setLoading(true);
    setError('');
    setPreview([]);

    let totalSaved = 0;
    let totalDuplicates = 0;
    let allPreview: any[] = [];
    const errors: string[] = [];

    try {
      const token = localStorage.getItem('token');

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sourceType', sourceType);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          errors.push(`${file.name}: ${data.message || t('upload.errorUpload')}`);
          continue;
        }

        totalSaved += data.savedCount ?? data.transactionCount ?? 0;
        totalDuplicates += data.duplicateCount ?? 0;

        if (data.transactions) {
          allPreview = allPreview.concat(data.transactions);
        }
      }

      if (allPreview.length > 0) {
        setPreview(allPreview.slice(0, 5));
      }

      if (errors.length > 0 && errors.length === files.length) {
        setError(errors.join('\n'));
        setLoading(false);
        return;
      }

      if (errors.length > 0) {
        setError(errors.join('\n'));
      }

      setSuccess(
        t('upload.successMulti', {
          count: totalSaved,
          files: files.length - errors.length,
        })
      );
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setLoading(false);

      setTimeout(() => router.push('/'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.error'));
      setLoading(false);
    }
  };

  const sourceOptions = [
    { id: 'bank', icon: '🏦' },
    { id: 'bit', icon: <BitLogo /> },
    { id: 'paypal', icon: <PayPalLogo /> },
    { id: 'google_pay', icon: <GooglePayLogo /> },
    { id: 'apple_pay', icon: <ApplePayLogo /> },
    { id: 'credit_card', icon: '💳' },
  ];

  return (
    <>
      <Head>
        <title>{t('upload.title')} - ElastiCash</title>
      </Head>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-5xl font-black mb-3 bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            {t('upload.title')}
          </h1>
          <p className="text-slate-400 text-lg">{t('upload.subtitle')}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300 ${
              activeTab === 'upload'
                ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            📤 {t('upload.tabUpload')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`flex-1 px-6 py-3 rounded-lg font-bold text-sm transition-all duration-300 ${
              activeTab === 'archive'
                ? 'bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-violet-300 border border-violet-500/30 shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            🗄️ {t('upload.tabArchive')}
          </button>
        </div>

        {activeTab === 'upload' ? (
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">
              📊 {t('upload.selectSource')}
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
                  <div className="h-8 flex items-center justify-center mb-1 text-2xl">
                    {source.icon}
                  </div>
                  <div className="text-sm">{t(`sources.${source.id}`)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload Drop Zone */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-4 uppercase tracking-wide">
              📁 {t('upload.fileLabel')}
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
                  : files.length > 0
                  ? 'border-cyan-400 bg-cyan-600/10'
                  : 'border-slate-600 bg-slate-800/30 hover:border-violet-400 hover:bg-violet-600/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="space-y-3">
                <p className={`text-5xl transition-transform ${dragActive ? 'scale-125' : ''}`}>
                  {files.length > 0 ? '✅' : '📤'}
                </p>
                <p className="text-slate-200 font-bold text-lg">
                  {files.length > 0
                    ? t('upload.filesSelected', { count: files.length })
                    : t('upload.dragDrop')}
                </p>
                <p className="text-slate-400 text-sm">{t('upload.orClick')}</p>
              </div>
            </div>

            {/* Selected file list */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((f, idx) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between bg-slate-700/40 rounded-lg px-4 py-2"
                  >
                    <span className="text-slate-200 text-sm truncate">
                      📄 {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="text-slate-400 hover:text-rose-400 transition-colors ms-3 shrink-0"
                      aria-label={t('upload.removeFile')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                <span>👀</span> {t('upload.previewTitle')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b-2 border-slate-600">
                    <tr className="text-slate-300">
                      <th className="text-start py-3 font-semibold">{t('upload.thDate')}</th>
                      <th className="text-start py-3 font-semibold">{t('upload.thMerchant')}</th>
                      <th className="text-end py-3 font-semibold">{t('upload.thAmount')}</th>
                      <th className="text-start py-3 font-semibold">{t('upload.thCategory')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {preview.map((tx, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-600/30 transition-colors"
                      >
                        <td className="py-3 text-slate-300">
                          {formatDate(tx.date)}
                        </td>
                        <td className="py-3 text-slate-200 font-medium">
                          {tx.merchant}
                        </td>
                        <td className="text-end py-3 text-slate-200 font-semibold">
                          {formatMoney(Math.abs(tx.amount))}
                        </td>
                        <td className="py-3">
                          <span className="px-3 py-1 bg-emerald-600/30 text-emerald-200 text-xs font-semibold rounded-full">
                            {tx.category
                              ? t(`categories.${tx.category}`)
                              : t('upload.uncategorized')}
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
            disabled={files.length === 0 || loading}
            className="w-full px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500 hover:from-emerald-600 hover:via-cyan-600 hover:to-violet-600 text-white rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-lg hover:shadow-2xl"
          >
            {loading ? (
              <span dir="ltr" className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> {t('upload.processing')}
              </span>
            ) : (
              <span dir="ltr" className="flex items-center justify-center gap-2">
                📤 {t('upload.uploadProcess')}
              </span>
            )}
          </button>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InfoCard
              icon="💾"
              title={t('upload.info1Title')}
              description={t('upload.info1Desc')}
              color="emerald"
            />
            <InfoCard
              icon="🔒"
              title={t('upload.info2Title')}
              description={t('upload.info2Desc')}
              color="cyan"
            />
            <InfoCard
              icon="✨"
              title={t('upload.info3Title')}
              description={t('upload.info3Desc')}
              color="violet"
            />
          </div>
        </form>
        ) : (
        /* ── Archive Tab ── */
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{t('upload.archiveTitle')}</h2>
            <p className="text-slate-400 text-sm">{t('upload.archiveSub')}</p>
          </div>

          {archiveLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="animate-spin text-3xl">⏳</span>
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-slate-400 text-lg">{t('upload.archiveEmpty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-start px-5 py-4 font-semibold">{t('upload.archiveFile')}</th>
                    <th className="text-start px-5 py-4 font-semibold">{t('upload.archiveDate')}</th>
                    <th className="text-start px-5 py-4 font-semibold">{t('upload.archiveRows')}</th>
                    <th className="text-start px-5 py-4 font-semibold">{t('upload.archiveSource')}</th>
                    <th className="text-start px-5 py-4 font-semibold">{t('upload.archiveSize')}</th>
                    <th className="text-end px-5 py-4 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {uploads.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {u.fileName.endsWith('.csv') ? '📄' : '📊'}
                          </span>
                          <span className="text-slate-200 font-medium truncate max-w-[200px]" title={u.fileName}>
                            {u.fileName}
                          </span>
                        </div>
                        {u.cardLabel && (
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{u.cardLabel}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {formatDate(new Date(u.uploadDate))}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 text-xs font-semibold rounded-full">
                          {u.transactionCount}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 bg-violet-500/10 text-violet-300 text-xs font-semibold rounded-full">
                          {t(`sources.${u.sourceType}`)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 text-xs">
                        {formatFileSize(u.fileSize)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {u.hasFile ? (
                            <a
                              href={`/api/uploads/${u.id}`}
                              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-300 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                const token = localStorage.getItem('token');
                                fetch(`/api/uploads/${u.id}`, {
                                  headers: { Authorization: `Bearer ${token}` },
                                })
                                  .then((r) => r.blob())
                                  .then((blob) => {
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = u.fileName;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  });
                              }}
                            >
                              ⬇️ {t('upload.archiveDownload')}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-600">{t('upload.archiveNoFile')}</span>
                          )}
                          {deleteConfirm === u.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(u.id)}
                                className="px-3 py-1.5 bg-red-500/20 text-red-300 text-xs font-semibold rounded-lg hover:bg-red-500/30 transition-colors"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1.5 bg-slate-600/20 text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-600/30 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(u.id)}
                              className="px-3 py-1.5 bg-red-500/10 text-red-300 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-colors"
                            >
                              🗑️ {t('upload.archiveDelete')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
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

/* Brand logos for the payment-source selector. Inline SVGs so we
   don't depend on a brand-icon package (and to cover Bit, which
   icon libraries don't include). */

function PayPalLogo() {
  return (
    <svg viewBox="0 0 384 512" className="h-6 w-6" role="img" aria-label="PayPal">
      <path
        fill="#003087"
        d="M111.4 295.9c-3.5 19.2-17.4 108.7-21.5 134-.3 1.8-1 2.5-3 2.5H12.3c-7.6 0-13.1-6.6-12.1-13.9L58.8 46.6c1.5-9.6 10.1-16.9 20-16.9 152.3 0 165.1-3.7 204 11.4 60.1 23.3 65.6 79.5 44 140.3-21.5 62.6-72.5 89.5-140.1 90.3-43.4.7-69.5-7-75.3 24.2z"
      />
      <path
        fill="#0070e0"
        d="M357.1 152c-1.8-1.3-2.5-1.8-3 1.3-2 11.4-5.1 22.5-8.8 33.6-39.9 113.8-150.5 103.9-204.5 103.9-6.1 0-10.1 3.3-10.9 9.4-22.6 140.4-27.1 169.7-27.1 169.7-1 7.1 3.5 12.9 10.6 12.9h63.5c8.6 0 15.7-6.3 17.4-14.9.7-5.4-1.1 6.1 14.4-91.3 4.6-22 14.3-19.7 29.3-19.7 71 0 126.4-28.8 142.9-112.3 6.5-34.8 4.6-71.4-23.3-92.3z"
      />
    </svg>
  );
}

function GooglePayLogo() {
  return (
    <svg viewBox="0 0 533.5 544.3" className="h-6 w-6" role="img" aria-label="Google Pay">
      <path
        fill="#4285F4"
        d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z"
      />
      <path
        fill="#34A853"
        d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z"
      />
      <path
        fill="#FBBC04"
        d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z"
      />
      <path
        fill="#EA4335"
        d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z"
      />
    </svg>
  );
}

function ApplePayLogo() {
  return (
    <svg viewBox="0 0 384 512" className="h-6 w-6" role="img" aria-label="Apple Pay">
      <path
        fill="#ffffff"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </svg>
  );
}

function BitLogo() {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#06303A] text-sm font-extrabold lowercase tracking-tight text-[#34E0EF]">
      bit
    </span>
  );
}
