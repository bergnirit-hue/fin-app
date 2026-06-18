import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';

export default function Signup() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || t('signup.failed'));
        setLoading(false);
        return;
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      router.push('/');
    } catch (err) {
      setError(t('signup.error'));
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t('signup.title')} - ElastiCash</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-2xl p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                ElastiCash
              </h1>
              <p className="text-slate-400 mt-2">{t('signup.subtitle')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('signup.fullName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  placeholder={t('signup.fullNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('signup.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('signup.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('signup.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
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
                {loading ? t('signup.creatingAccount') : t('signup.createAccount')}
              </button>
            </form>

            {/* Login Link */}
            <p className="text-center text-slate-400 mt-6">
              {t('signup.haveAccount')}{' '}
              <Link
                href="/login"
                className="text-emerald-400 hover:text-emerald-300 font-medium transition"
              >
                {t('signup.signIn')}
              </Link>
            </p>

            {/* Demo Note */}
            <div className="mt-8 p-4 bg-slate-600/50 rounded-lg border border-slate-500/50">
              <p className="text-xs text-slate-400 text-center">{t('signup.demo')}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
