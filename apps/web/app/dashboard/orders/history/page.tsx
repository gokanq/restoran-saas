'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'ON_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

type OrderType = 'TABLE' | 'DELIVERY' | 'TAKEAWAY';

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  note?: string | null;
};

type Order = {
  id: string;
  code: string;
  type?: OrderType | string;
  tableNumber?: string | null;
  status: OrderStatus | string;
  total: string | number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  note?: string | null;
  items?: OrderItem[];
  createdAt: string;
  branch?: {
    name: string;
  } | null;
};

type HistoryFilter = 'ALL' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'ON_DELIVERY' | 'DELIVERED' | 'CANCELLED';

const HISTORY_ORDER_STATUSES = new Set<string>([
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ON_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]);

const HISTORY_FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: 'ALL', label: 'Tümü' },
  { value: 'ACCEPTED', label: 'Kabul Edildi' },
  { value: 'PREPARING', label: 'Hazırlanıyor' },
  { value: 'READY', label: 'Hazır' },
  { value: 'ON_DELIVERY', label: 'Yolda' },
  { value: 'DELIVERED', label: 'Teslim Edildi' },
  { value: 'CANCELLED', label: 'İptal Edildi' },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Paket',
  TABLE: 'Masa',
  TAKEAWAY: 'Gel-al',
};

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

function getOrderNumericTotal(total: string | number) {
  const numericTotal = Number(String(total).replace(',', '.'));
  return Number.isFinite(numericTotal) ? numericTotal : 0;
}

function formatMoney(value: string | number) {
  const numericValue = Number(String(value).replace(',', '.'));

  if (!Number.isFinite(numericValue)) {
    return `${value} TL`;
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(numericValue);
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

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value || '').toLocaleLowerCase('tr-TR').trim();
}

function orderMatchesSearch(order: Order, searchValue: string) {
  if (!searchValue) {
    return true;
  }

  const searchableValues = [
    order.code,
    order.tableNumber,
    order.customerName,
    order.customerPhone,
    order.customerAddress,
    order.note,
    order.branch?.name,
    ORDER_STATUS_LABELS[order.status] || order.status,
    ORDER_TYPE_LABELS[order.type || ''] || order.type,
  ];

  return searchableValues.some((value) => normalizeSearchValue(value).includes(searchValue));
}

function getOrderTypeDisplay(order: Order) {
  const typeLabel = ORDER_TYPE_LABELS[order.type || ''] || '-';

  if (order.type === 'TABLE' && order.tableNumber) {
    return `${typeLabel} / Masa ${order.tableNumber}`;
  }

  return typeLabel;
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export default function OrderHistoryPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const historyOrders = useMemo(() => {
    return orders.filter((order) => HISTORY_ORDER_STATUSES.has(order.status));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(orderSearch);

    return historyOrders.filter((order) => {
      const statusMatches = historyFilter === 'ALL' || order.status === historyFilter;
      const searchMatches = orderMatchesSearch(order, normalizedSearch);

      return statusMatches && searchMatches;
    });
  }, [historyOrders, historyFilter, orderSearch]);

  const deliveredOrders = useMemo(() => {
    return historyOrders.filter((order) => order.status === 'DELIVERED');
  }, [historyOrders]);

  const cancelledOrders = useMemo(() => {
    return historyOrders.filter((order) => order.status === 'CANCELLED');
  }, [historyOrders]);

  const deliveredRevenue = useMemo(() => {
    return deliveredOrders.reduce((sum, order) => sum + getOrderNumericTotal(order.total), 0);
  }, [deliveredOrders]);

  async function loadOrders() {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJson(response);

      if (!response.ok) {
        const responseMessage =
          typeof data === 'object' && data && 'message' in data
            ? String(data.message)
            : 'Sipariş geçmişi yüklenemedi.';

        throw new Error(responseMessage);
      }

      setOrders(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Sipariş geçmişi yüklenemedi.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            Sipariş Arşivi
          </p>
          <h1 className="mt-2 text-3xl font-black">Geçmiş Siparişler</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Kabul edilen, hazırlanan, yola çıkan, teslim edilen ve iptal edilen siparişleri ana ekrandan ayrı takip edin.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold hover:bg-slate-800"
            >
              Dashboarda Dön
            </a>

            <a
              href="/dashboard/menu"
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-500/20"
            >
              Menü
            </a>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-bold text-slate-400">İşlem Görmüş Sipariş</p>
            <p className="mt-2 text-3xl font-black">{historyOrders.length}</p>
          </div>

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <p className="text-sm font-bold text-emerald-200">Teslim Edildi</p>
            <p className="mt-2 text-3xl font-black">{deliveredOrders.length}</p>
            <p className="mt-1 text-sm font-bold text-emerald-300">
              {formatMoney(deliveredRevenue)}
            </p>
          </div>

          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5">
            <p className="text-sm font-bold text-red-200">İptal Edildi</p>
            <p className="mt-2 text-3xl font-black">{cancelledOrders.length}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-black">Sipariş Listesi</h2>
              <p className="mt-1 text-sm text-slate-400">
                Gösterilen: {filteredOrders.length} • Toplam geçmiş: {historyOrders.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {HISTORY_FILTER_OPTIONS.map((filter) => {
                const isActive = historyFilter === filter.value;
                const count =
                  filter.value === 'ALL'
                    ? historyOrders.length
                    : historyOrders.filter((order) => order.status === filter.value).length;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setHistoryFilter(filter.value)}
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

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:flex-row md:items-center md:justify-between">
            <div className="w-full">
              <label className="text-sm font-semibold text-slate-200">
                Geçmiş Sipariş Ara
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                  placeholder="Kod, masa no, müşteri, telefon, adres, not, şube..."
                />
              </label>
            </div>

            {orderSearch ? (
              <button
                type="button"
                onClick={() => setOrderSearch('')}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 md:mt-6"
              >
                Temizle
              </button>
            ) : null}
          </div>

          <div className="mt-6 overflow-x-auto">
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
                Geçmiş siparişler yükleniyor...
              </div>
            ) : historyOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
                Henüz işlem görmüş sipariş yok.
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
                Bu filtre veya arama sonucunda sipariş bulunamadı.
              </div>
            ) : (
              <table className="w-full min-w-[1100px] overflow-hidden rounded-2xl text-left text-sm">
                <thead className="bg-slate-900 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Kod</th>
                    <th className="px-4 py-3">Tip</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Şube</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Toplam</th>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Detay</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredOrders.map((order) => {
                    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                    const typeLabel = getOrderTypeDisplay(order);
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
                        <td className="px-4 py-4 font-semibold">{formatMoney(order.total)}</td>
                        <td className="px-4 py-4">{formatOrderDate(order.createdAt)}</td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                          >
                            Detay
                          </button>
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
                  Geçmiş Sipariş Detayı
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
                  Masa No
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.tableNumber || '-'}</p>
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
                <p className="mt-2 text-lg font-bold">{formatMoney(selectedOrder.total)}</p>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Sipariş Ürünleri
                  </p>

                  <div className="mt-3 space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                      >
                        <div>
                          <p className="font-bold text-white">{item.name}</p>
                          {item.note ? (
                            <p className="mt-1 text-xs text-amber-200">Not: {item.note}</p>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-300">
                            {item.quantity} x {formatMoney(item.unitPrice)}
                          </p>
                          <p className="mt-1 text-base font-black text-emerald-300">
                            {formatMoney(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
          </div>
        </div>
      ) : null}
    </main>
  );
}
