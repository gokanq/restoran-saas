'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    restaurantId: string | null;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    restaurant?: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
    } | null;
  };
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('manager@demo.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Giriş başarısız');
        return;
      }

      const loginData = data as LoginResponse;

      localStorage.setItem('accessToken', loginData.accessToken);
      localStorage.setItem('user', JSON.stringify(loginData.user));

      router.push('/dashboard');
    } catch {
      setError('Sunucuya bağlanırken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Restoran SaaS
          </p>
          <h1 className="mt-3 text-3xl font-bold">Yönetim Paneli Girişi</h1>
          <p className="mt-3 text-sm text-slate-300">
            Demo kullanıcı ile giriş yaparak dashboard ekranını test edebilirsin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-300" htmlFor="email">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              placeholder="manager@demo.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300" htmlFor="password">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              placeholder="Şifre"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </main>
  );
}
