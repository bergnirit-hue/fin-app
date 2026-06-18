import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LanguageProvider, useI18n } from '@/lib/i18n';

function AppShell({ Component, pageProps }: AppProps) {
  const { t, dir, lang, toggle } = useI18n();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (e) {
        console.error('Invalid token');
        localStorage.removeItem('token');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  };

  const isAuthPage =
    router.pathname === '/login' || router.pathname === '/signup';

  const navLinks = [
    { href: '/', label: t('nav.dashboard') },
    { href: '/upload', label: t('nav.upload') },
    { href: '/transactions', label: t('nav.transactions') },
    { href: '/settings', label: t('nav.settings') },
  ];

  const LanguageToggle = () => (
    <button
      onClick={toggle}
      aria-label="Switch language"
      className="px-3 py-2 rounded-md text-sm font-bold bg-slate-700 text-slate-100 hover:bg-slate-600 transition"
    >
      🌐 {t('nav.switchTo')}
    </button>
  );

  return (
    <div
      dir={dir}
      lang={lang}
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
    >
      {isAuthenticated && !isAuthPage && (
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
                >
                  FinFlow
                </Link>
              </div>

              <div className="flex gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      router.pathname === link.href
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <LanguageToggle />
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition"
                >
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Language toggle for the auth pages (login/signup), which have no nav */}
      {isAuthPage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex justify-end">
          <LanguageToggle />
        </div>
      )}

      <main
        className={
          isAuthPage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'
        }
      >
        <Component {...pageProps} user={user} />
      </main>
    </div>
  );
}

export default function App(props: AppProps) {
  return (
    <LanguageProvider>
      <AppShell {...props} />
    </LanguageProvider>
  );
}
