import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

export default function ResetPassword() {
  const router = useRouter();
  const { t } = useI18n();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('signup.mismatch'));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data.message;
        const translated = t(`resetPassword.${msg}`);
        setError(translated !== `resetPassword.${msg}` ? translated : msg);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('resetPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <Head>
          <title>{t('resetPassword.title')} - ElastiCash</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-2xl p-8 text-center">
              <p className="text-rose-300 mb-4">{t('resetPassword.invalidLink')}</p>
              <Link href="/forgot-password" className="text-emerald-400 hover:text-emerald-300 transition">
                {t('resetPassword.requestNew')}
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{t('resetPassword.title')} - ElastiCash</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                ElastiCash
              </h1>
              <p className="text-slate-400 mt-2">{t('resetPassword.subtitle')}</p>
            </div>

            {success ? (
              <div className="space-y-6">
                <div className="bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 px-4 py-4 rounded-lg text-sm text-center">
                  {t('resetPassword.success')}
                </div>
                <Link
                  href="/login"
                  className="block w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white rounded-lg font-medium text-center transition"
                >
                  {t('resetPassword.goToLogin')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {t('resetPassword.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {t('resetPassword.confirmPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                    placeholder="••••••••"
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
                  {loading ? t('resetPassword.resetting') : t('resetPassword.reset')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
