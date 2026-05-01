'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  restaurantId: string | null;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type Order = {
  id: string;
  code: string;
  status: string;
  total: string;
  createdAt: string;
  branch?: {
    name: string;
  };
};

const ORDER_STATUS_OPTIONS = [
  { value: 'ACCEPTED', label: 'Kabul Et' },
  { value: 'PREPARING', label: 'Hazırlamaya Al' },
  { value: 'READY', label: 'Hazır Yap' },
  { value: 'ON_DELIVERY', label: 'Yola Çıkar' },
  { value: 'DELIVERED', label: 'Teslim Et' },
  { value: 'CANCELLED', label: 'İptal Et' },
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  ACCEPTED: 'Kabul Edildi',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
  ON_DELIVERY: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  STAFF: 'Personel',
  COURIER: 'Kurye',
  CUSTOMER: 'Müşteri',
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  async function loadOrders(token: string) {
    const ordersResponse = await fetch('/api/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const ordersData = ordersResponse.ok ? await ordersResponse.json() : [];
    setOrders(ordersData);
  }

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem('accessToken');

      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const meResponse = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!meResponse.ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }

        const meData = await meResponse.json();

        setUser(meData);
        await loadOrders(token);
      } catch {
        setError('Dashboard verileri yüklenirken hata oluştu');
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  async function updateOrderStatus(orderId: string, status: string) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş durumu güncellenemedi');
        return;
      }

      await loadOrders(token);
    } catch {
      setError('Sipariş durumu güncellenirken hata oluştu');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-slate-300">Dashboard yükleniyor...</p>
      </main>
    );
  }

  const roleLabel = user ? USER_ROLE_LABELS[user.role] || user.role : '-';

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Restoran SaaS
            </p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-300">
              {user ? `${user.name} • ${user.email} • ${roleLabel}` : 'Kullanıcı bilgisi yok'}
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Çıkış Yap
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-400">API Oturumu</p>
            <p className="mt-2 text-2xl font-bold text-emerald-400">Aktif</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-400">Rol</p>
            <p className="mt-2 text-2xl font-bold">{roleLabel}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-400">Sipariş Sayısı</p>
            <p className="mt-2 text-2xl font-bold text-sky-400">{orders.length}</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-bold">Son Siparişler</h2>

          {orders.length === 0 ? (
            <p className="mt-4 text-slate-400">Henüz sipariş yok.</p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Kod</th>
                    <th className="px-4 py-3">Şube</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Toplam</th>
                    <th className="px-4 py-3">Durum Güncelle</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const statusLabel =
                      ORDER_STATUS_LABELS[order.status] || order.status;

                    return (
                      <tr key={order.id} className="border-t border-white/10 align-top">
                        <td className="px-4 py-3 font-semibold">{order.code}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {order.branch?.name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{order.total} TL</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {ORDER_STATUS_OPTIONS.map((status) => (
                              <button
                                key={status.value}
                                type="button"
                                disabled={
                                  updatingOrderId === order.id ||
                                  order.status === status.value
                                }
                                onClick={() => updateOrderStatus(order.id, status.value)}
                                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
