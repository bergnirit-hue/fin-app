import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message);
        setLoading(false);
        return;
      }

      setSent(true);
      if (data.resetToken) {
        setResetToken(data.resetToken);
      }
    } catch {
      setError(t('forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t('forgotPassword.title')} - ElastiCash</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                ElastiCash
              </h1>
              <p className="text-slate-400 mt-2">{t('forgotPassword.subtitle')}</p>
            </div>

            {sent ? (
              <div className="space-y-6">
                <div className="bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 px-4 py-4 rounded-lg text-sm text-center">
                  {t('forgotPassword.sent')}
                </div>

                {resetToken && (
                  <div className="bg-slate-600/50 border border-slate-500/50 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-slate-400 text-center">{t('forgotPassword.devNote')}</p>
                    <Link
                      href={`/reset-password?token=${resetToken}`}
                      className="block text-center text-emerald-400 hover:text-emerald-300 font-medium transition text-sm"
                    >
                      {t('forgotPassword.resetLink')}
                    </Link>
                  </div>
                )}

                <Link
                  href="/login"
                  className="block text-center text-slate-400 hover:text-slate-300 transition"
                >
                  {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {t('forgotPassword.email')}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-rose-600/20 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {loading ? t('forgotPassword.sending') : t('forgotPassword.send')}
                </button>

                <Link
                  href="/login"
                  className="block text-center text-slate-400 hover:text-slate-300 transition text-sm"
                >
                  {t('forgotPassword.backToLogin')}
                </Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
