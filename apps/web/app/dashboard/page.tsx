'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  restaurantId: string | null;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type Branch = {
  id: string;
  name: string;
};

type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'ON_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

type OrderType = 'TABLE' | 'DELIVERY' | 'TAKEAWAY';

type OrderFilter = 'ALL' | OrderStatus;

type Order = {
  id: string;
  code: string;
  type?: OrderType | string;
  status: OrderStatus | string;
  total: string | number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  note?: string | null;
  createdAt: string;
  branch?: {
    name: string;
  } | null;
};

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DELIVERY', label: 'Paket' },
  { value: 'TABLE', label: 'Masa' },
  { value: 'TAKEAWAY', label: 'Gel-al' },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Paket',
  TABLE: 'Masa',
  TAKEAWAY: 'Gel-al',
};

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'ACCEPTED', label: 'Kabul Et' },
  { value: 'PREPARING', label: 'Hazırlamaya Al' },
  { value: 'READY', label: 'Hazır Yap' },
  { value: 'ON_DELIVERY', label: 'Yola Çıkar' },
  { value: 'DELIVERED', label: 'Teslim Et' },
  { value: 'CANCELLED', label: 'İptal Et' },
];

const ORDER_FILTER_OPTIONS: { value: OrderFilter; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'PENDING', label: 'Bekliyor' },
  { value: 'ACCEPTED', label: 'Kabul Edildi' },
  { value: 'PREPARING', label: 'Hazırlanıyor' },
  { value: 'READY', label: 'Hazır' },
  { value: 'ON_DELIVERY', label: 'Yolda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
  { value: 'CANCELLED', label: 'İptal Edildi' },
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

const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  PENDING: 'border-yellow-400/30 bg-yellow-500/10 text-yellow-200',
  ACCEPTED: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
  PREPARING: 'border-orange-400/30 bg-orange-500/10 text-orange-200',
  READY: 'border-purple-400/30 bg-purple-500/10 text-purple-200',
  ON_DELIVERY: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  DELIVERED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  CANCELLED: 'border-red-400/30 bg-red-500/10 text-red-200',
};

const ORDER_ACTION_BUTTON_CLASSES: Record<string, string> = {
  ACCEPTED: 'border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20',
  PREPARING: 'border-orange-400/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20',
  READY: 'border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20',
  ON_DELIVERY: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20',
  DELIVERED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
  CANCELLED: 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20',
};

const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  STAFF: 'Personel',
  COURIER: 'Kurye',
  CUSTOMER: 'Müşteri',
};

function generateNextOrderCode(orders: Order[]) {
  const maxNumber = orders.reduce((max, order) => {
    const match = order.code.match(/(\d+)$/);
    const orderNumber = match ? Number(match[1]) : 0;

    return Number.isFinite(orderNumber) && orderNumber > max ? orderNumber : max;
  }, 0);

  return `ORD-${String(maxNumber + 1).padStart(4, '0')}`;
}

function getOrderNumericTotal(total: string | number) {
  const normalizedTotal = String(total).replace(',', '.');
  const numericTotal = Number(normalizedTotal);

  return Number.isFinite(numericTotal) ? numericTotal : 0;
}

function isTodayOrder(createdAt: string) {
  const orderDate = new Date(createdAt);

  if (Number.isNaN(orderDate.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    orderDate.getFullYear() === today.getFullYear() &&
    orderDate.getMonth() === today.getMonth() &&
    orderDate.getDate() === today.getDate()
  );
}

function formatOrderDate(createdAt: string) {
  const orderDate = new Date(createdAt);

  if (Number.isNaN(orderDate.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(orderDate);
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [orderTotal, setOrderTotal] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'ALL') {
      return orders;
    }

    return orders.filter((order) => order.status === orderFilter);
  }, [orders, orderFilter]);

  const orderCountsByStatus = useMemo(() => {
    return orders.reduce<Record<string, number>>((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {});
  }, [orders]);

  const operationalSummary = useMemo(() => {
    const todayOrders = orders.filter((order) => isTodayOrder(order.createdAt));

    return {
      pending: orderCountsByStatus.PENDING || 0,
      preparing: orderCountsByStatus.PREPARING || 0,
      onDelivery: orderCountsByStatus.ON_DELIVERY || 0,
      todayOrderCount: todayOrders.length,
      todayRevenue: todayOrders.reduce((total, order) => total + getOrderNumericTotal(order.total), 0),
    };
  }, [orders, orderCountsByStatus]);

  const selectedFilterLabel =
    ORDER_FILTER_OPTIONS.find((filter) => filter.value === orderFilter)?.label || 'Tümü';

  const formattedTodayRevenue = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(operationalSummary.todayRevenue);

  async function loadOrders(token: string) {
    const ordersResponse = await fetch('/api/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const ordersData = ordersResponse.ok ? await ordersResponse.json() : [];
    const safeOrders = Array.isArray(ordersData) ? ordersData : [];

    setOrders(safeOrders);
    setOrderCode((currentCode) => currentCode || generateNextOrderCode(safeOrders));

    return safeOrders;
  }

  async function loadBranches(token: string) {
    const branchesResponse = await fetch('/api/branches', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const branchesData = branchesResponse.ok ? await branchesResponse.json() : [];
    const safeBranches = Array.isArray(branchesData) ? branchesData : [];

    setBranches(safeBranches);

    if (safeBranches.length > 0) {
      setSelectedBranchId((currentBranchId) => currentBranchId || safeBranches[0].id);
    }
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
        await Promise.all([loadBranches(token), loadOrders(token)]);
      } catch {
        setError('Dashboard verileri yüklenirken hata oluştu');
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');

    if (!selectedBranchId) {
      setError('Lütfen şube seçin');
      return;
    }

    if (!orderCode.trim()) {
      setError('Sipariş kodu zorunludur');
      return;
    }

    if (!orderTotal.trim()) {
      setError('Toplam tutar zorunludur');
      return;
    }

    const numericOrderTotal = getOrderNumericTotal(orderTotal);

    if (!Number.isFinite(numericOrderTotal) || numericOrderTotal <= 0) {
      setError('Toplam tutar 0’dan büyük olmalıdır');
      return;
    }

    setIsCreatingOrder(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: selectedBranchId,
          code: orderCode.trim(),
          type: orderType,
          total: numericOrderTotal,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          note: orderNote.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş oluşturulamadı');
        return;
      }

      setOrderType('DELIVERY');
      setOrderTotal('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderNote('');
      setSuccess('Sipariş oluşturuldu');

      const latestOrders = await loadOrders(token);
      setOrderCode(generateNextOrderCode(latestOrders));
    } catch {
      setError('Sipariş oluşturulurken hata oluştu');
    } finally {
      setIsCreatingOrder(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');
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

      const latestOrders = await loadOrders(token);
      const latestSelectedOrder = latestOrders.find((order) => order.id === orderId);

      setSelectedOrder((currentOrder) => {
        if (!currentOrder || currentOrder.id !== orderId) {
          return currentOrder;
        }

        return latestSelectedOrder || data;
      });

      setSuccess('Sipariş durumu güncellendi');
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
        <p className="text-lg font-semibold">Dashboard yükleniyor...</p>
      </main>
    );
  }

  const roleLabel = user ? USER_ROLE_LABELS[user.role] || user.role : '-';

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
              Restoran SaaS
            </p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-300">
              {user ? `${user.name} • ${user.email} • ${roleLabel}` : 'Kullanıcı bilgisi yok'}
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400"
          >
            Çıkış Yap
          </button>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => setOrderFilter('PENDING')}
            className="rounded-3xl border border-yellow-400/20 bg-yellow-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-yellow-500/20"
          >
            <p className="text-sm font-semibold text-yellow-200">Bekleyen</p>
            <p className="mt-2 text-3xl font-black text-yellow-100">{operationalSummary.pending}</p>
            <p className="mt-1 text-xs text-yellow-100/70">Aksiyon bekleyen sipariş</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('PREPARING')}
            className="rounded-3xl border border-orange-400/20 bg-orange-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-orange-500/20"
          >
            <p className="text-sm font-semibold text-orange-200">Hazırlanıyor</p>
            <p className="mt-2 text-3xl font-black text-orange-100">{operationalSummary.preparing}</p>
            <p className="mt-1 text-xs text-orange-100/70">Mutfakta olan sipariş</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('ON_DELIVERY')}
            className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-cyan-500/20"
          >
            <p className="text-sm font-semibold text-cyan-200">Yolda</p>
            <p className="mt-2 text-3xl font-black text-cyan-100">{operationalSummary.onDelivery}</p>
            <p className="mt-1 text-xs text-cyan-100/70">Kurye teslimatında</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('ALL')}
            className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-emerald-500/20"
          >
            <p className="text-sm font-semibold text-emerald-200">Bugünkü Sipariş</p>
            <p className="mt-2 text-3xl font-black text-emerald-100">
              {operationalSummary.todayOrderCount}
            </p>
            <p className="mt-1 text-xs text-emerald-100/70">Bugün oluşturulan sipariş</p>
          </button>

          <div className="rounded-3xl border border-purple-400/20 bg-purple-500/10 p-5 shadow-xl shadow-black/10">
            <p className="text-sm font-semibold text-purple-200">Bugünkü Ciro</p>
            <p className="mt-2 text-3xl font-black text-purple-100">{formattedTodayRevenue}</p>
            <p className="mt-1 text-xs text-purple-100/70">Bugünkü sipariş toplamı</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/10">
          <h2 className="text-xl font-bold">Yeni Sipariş</h2>

          <form onSubmit={createOrder} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block text-sm font-semibold text-slate-200">
              Şube
              <select
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                {branches.length === 0 ? (
                  <option value="">Şube yok</option>
                ) : (
                  branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Sipariş Tipi
              <select
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as OrderType)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                {ORDER_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Sipariş Kodu
              <input
                value={orderCode}
                onChange={(event) => setOrderCode(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                placeholder="Otomatik oluşturulur"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Toplam Tutar
              <input
                value={orderTotal}
                onChange={(event) => setOrderTotal(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                placeholder="180"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Müşteri Adı
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                placeholder="Ahmet Yılmaz"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Telefon
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                placeholder="05xx xxx xx xx"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200 xl:col-span-2">
              Adres
              <input
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                placeholder="Mahalle, sokak, bina, daire"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200 md:col-span-2 xl:col-span-3">
              Not
              <input
                value={orderNote}
                onChange={(event) => setOrderNote(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                placeholder="Zil çalışmıyor, acısız olsun, kapıya bırak vb."
              />
            </label>

            <button
              type="submit"
              disabled={isCreatingOrder}
              className="mt-7 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingOrder ? 'Oluşturuluyor...' : 'Sipariş Oluştur'}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold">Son Siparişler</h2>
              <p className="mt-1 text-sm text-slate-400">
                Aktif filtre: {selectedFilterLabel} • Gösterilen: {filteredOrders.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {ORDER_FILTER_OPTIONS.map((filter) => {
                const isActive = orderFilter === filter.value;
                const count =
                  filter.value === 'ALL'
                    ? orders.length
                    : orderCountsByStatus[filter.value] || 0;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setOrderFilter(filter.value)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-bold transition ${
                      isActive
                        ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                        : 'border-white/10 bg-slate-900 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {filter.label}
                    <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
                Henüz sipariş yok.
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
                Bu filtrede sipariş yok.
              </div>
            ) : (
              <table className="w-full min-w-[1200px] overflow-hidden rounded-2xl text-left text-sm">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Kod</th>
                    <th className="px-4 py-3">Tip</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Şube</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Toplam</th>
                    <th className="px-4 py-3">Detay</th>
                    <th className="px-4 py-3">Durum Güncelle</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredOrders.map((order) => {
                    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                    const typeLabel = ORDER_TYPE_LABELS[order.type || ''] || '-';
                    const statusBadgeClass =
                      ORDER_STATUS_BADGE_CLASSES[order.status] ||
                      'border-slate-400/30 bg-slate-500/10 text-slate-200';

                    return (
                      <tr key={order.id} className="bg-slate-950/40 transition hover:bg-white/5">
                        <td className="px-4 py-4 font-bold">{order.code}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-200">
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold">{order.customerName || '-'}</div>
                          {order.customerAddress ? (
                            <div className="mt-1 max-w-[220px] truncate text-xs text-slate-400">
                              {order.customerAddress}
                            </div>
                          ) : null}
                          {order.note ? (
                            <div className="mt-1 max-w-[220px] truncate text-xs text-amber-200">
                              Not: {order.note}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">{order.customerPhone || '-'}</td>
                        <td className="px-4 py-4">{order.branch?.name || '-'}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold">{order.total} TL</td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            Detay
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {ORDER_STATUS_OPTIONS.map((status) => {
                              const actionClass =
                                ORDER_ACTION_BUTTON_CLASSES[status.value] ||
                                'border-white/10 bg-slate-900 text-slate-200 hover:bg-white/10';

                              return (
                                <button
                                  key={status.value}
                                  type="button"
                                  onClick={() => updateOrderStatus(order.id, status.value)}
                                  disabled={
                                    updatingOrderId === order.id || order.status === status.value
                                  }
                                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${actionClass}`}
                                >
                                  {status.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  Sipariş Detayı
                </p>
                <h3 className="mt-2 text-2xl font-black">{selectedOrder.code}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {formatOrderDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sipariş Tipi
                </p>
                <p className="mt-2 text-lg font-bold">
                  {ORDER_TYPE_LABELS[selectedOrder.type || ''] || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Durum
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${
                    ORDER_STATUS_BADGE_CLASSES[selectedOrder.status] ||
                    'border-slate-400/30 bg-slate-500/10 text-slate-200'
                  }`}
                >
                  {ORDER_STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Müşteri
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.customerName || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Telefon
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.customerPhone || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Şube
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.branch?.name || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Toplam
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.total} TL</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Adres
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {selectedOrder.customerAddress || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Not
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-100">
                  {selectedOrder.note || '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-3 text-sm font-bold text-slate-300">Durum Güncelle</p>

              <div className="flex flex-wrap gap-2">
                {ORDER_STATUS_OPTIONS.map((status) => {
                  const actionClass =
                    ORDER_ACTION_BUTTON_CLASSES[status.value] ||
                    'border-white/10 bg-slate-900 text-slate-200 hover:bg-white/10';

                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => updateOrderStatus(selectedOrder.id, status.value)}
                      disabled={
                        updatingOrderId === selectedOrder.id ||
                        selectedOrder.status === status.value
                      }
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${actionClass}`}
                    >
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
