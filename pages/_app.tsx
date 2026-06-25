import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LanguageProvider, useI18n } from '@/lib/i18n';

interface AuthUser {
  userId: string;
  email: string;
  householdId?: string;
  name?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  logout: async () => {},
  refreshAuth: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AppShell({ Component, pageProps }: AppProps) {
  const { t, dir, lang, toggle } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const isAuthPage =
    router.pathname === '/login' ||
    router.pathname === '/signup' ||
    router.pathname === '/forgot-password' ||
    router.pathname === '/reset-password' ||
    router.pathname === '/join';

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      router.replace('/login');
    }
  }, [loading, user, isAuthPage, router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  };

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

  const authContext: AuthContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    logout: handleLogout,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={authContext}>
      <div
        dir={dir}
        lang={lang}
        className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      >
        {user && !isAuthPage && (
          <nav className="bg-slate-800 border-b border-slate-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-4">
                  <Link
                    href="/"
                    className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
                  >
                    ElastiCash
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
          {(isAuthPage || user) && <Component {...pageProps} user={user} />}
        </main>
      </div>
    </AuthContext.Provider>
  );
}

export default function App(props: AppProps) {
  return (
    <LanguageProvider>
      <AppShell {...props} />
    </LanguageProvider>
  );
}
