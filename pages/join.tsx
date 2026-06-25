import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { useI18n } from '@/lib/i18n';
import { useAuth } from './_app';

export default function JoinHousehold() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, refreshAuth } = useAuth();
  const { token } = router.query;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (router.isReady && !token) {
      setError(t('join.invalidLink'));
    }
  }, [router.isReady, token, t]);

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/household/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        setLoading(false);
        return;
      }

      setSuccess(data.household?.name || '');
      await refreshAuth();
      setTimeout(() => router.push('/'), 2000);
    } catch {
      setError(t('join.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <>
        <Head>
          <title>{t('join.title')} - ElastiCash</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-2xl p-8 text-center space-y-4">
              <h2 className="text-xl font-bold text-white">{t('join.loginFirst')}</h2>
              <p className="text-slate-400">{t('join.loginFirstSub')}</p>
              <Link
                href={`/login?redirect=/join?token=${token}`}
                className="block w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white rounded-lg font-medium text-center transition"
              >
                {t('login.signIn')}
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
        <title>{t('join.title')} - ElastiCash</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-slate-700/50 backdrop-blur border border-slate-600 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                ElastiCash
              </h1>
              <p className="text-slate-400 mt-2">{t('join.subtitle')}</p>
            </div>

            {success ? (
              <div className="bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 px-4 py-4 rounded-lg text-sm text-center">
                {t('join.success').replace('{name}', success)}
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-slate-300 text-center">
                  {t('join.prompt')}
                </p>

                {error && (
                  <div className="bg-rose-600/20 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAccept}
                  disabled={loading || !token}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                >
                  {loading ? t('join.joining') : t('join.accept')}
                </button>

                <Link
                  href="/"
                  className="block text-center text-slate-400 hover:text-slate-300 transition text-sm"
                >
                  {t('join.skip')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
