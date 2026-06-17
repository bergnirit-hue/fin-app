import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Decode and set user from token
      try {
        const payload = JSON.parse(
          atob(token.split('.')[1])
        );
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {isAuthenticated && !isAuthPage && (
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  FinFlow
                </Link>
              </div>

              <div className="flex space-x-1">
                <Link
                  href="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/upload"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/upload'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Upload
                </Link>
                <Link
                  href="/transactions"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/transactions'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Transactions
                </Link>
                <Link
                  href="/settings"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    router.pathname === '/settings'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Settings
                </Link>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-slate-300 text-sm">
                  {user?.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className={isAuthPage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
        <Component {...pageProps} user={user} />
      </main>
    </div>
  );
}
