'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Branch = {
  id: string;
  name: string;
};

type OrderType = 'DELIVERY' | 'TABLE' | 'TAKEAWAY';
type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'ONLINE' | 'MEAL_CARD' | 'OPEN_ACCOUNT';

type OrderLite = {
  id?: string;
  code?: string;
  createdAt?: string;
};

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DELIVERY', label: 'Paket' },
  { value: 'TABLE', label: 'Masa' },
  { value: 'TAKEAWAY', label: 'Gel-al' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Nakit' },
  { value: 'CREDIT_CARD', label: 'Kredi / Banka Kartı' },
  { value: 'ONLINE', label: 'Online Ödeme' },
  { value: 'MEAL_CARD', label: 'Yemek Kartı' },
  { value: 'OPEN_ACCOUNT', label: 'Açık Hesap' },
];

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function normalizeOrders(data: any): OrderLite[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.orders)) {
    return data.orders;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function getNextOrderCode(orders: OrderLite[]) {
  const maxNumber = orders.reduce((max, order) => {
    const match = /^ORD-(\d{1,6})$/.exec(order.code || '');
    const orderNumber = match ? Number(match[1]) : 0;

    return Number.isFinite(orderNumber) && orderNumber > max ? orderNumber : max;
  }, 0);

  return `ORD-${maxNumber + 1}`;
}

function extractOrderCode(data: any) {
  return String(data?.code || data?.order?.code || data?.data?.code || '').trim();
}

function getNewestOrderCode(orders: OrderLite[]) {
  const sortedOrders = [...orders].sort((first, second) => {
    const firstTime = new Date(first.createdAt || '').getTime();
    const secondTime = new Date(second.createdAt || '').getTime();

    return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
  });

  return sortedOrders[0]?.code || '';
}

export default function CallerIdPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [total, setTotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');

  const [orderCodePreview, setOrderCodePreview] = useState('ORD-1');
  const [lastOrderCode, setLastOrderCode] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadOrdersForCode(token: string) {
    const response = await fetch('/api/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readJson(response);

    if (!response.ok) {
      return [];
    }

    const orders = normalizeOrders(data);
    setOrderCodePreview(getNextOrderCode(orders));

    return orders;
  }

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    async function loadInitialData() {
      try {
        const [branchesResponse] = await Promise.all([
          fetch('/api/branches', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          loadOrdersForCode(token as string),
        ]);

        const branchesData = await readJson(branchesResponse);

        if (!branchesResponse.ok) {
          setError(branchesData?.message || 'Şubeler yüklenemedi.');
          return;
        }

        const safeBranches = Array.isArray(branchesData) ? branchesData : [];

        setBranches(safeBranches);
        setBranchId(safeBranches[0]?.id || '');
      } catch {
        setError('CALLER ID verileri yüklenirken hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [router]);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    const numericTotal = Number(total.replace(',', '.'));

    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      setError('Geçerli bir toplam tutar gir.');
      return;
    }

    if (orderType === 'TABLE' && !tableNumber.trim()) {
      setError('Masa siparişi için masa numarası gir.');
      return;
    }

    if (orderType === 'DELIVERY' && !customerPhone.trim()) {
      setError('Paket sipariş için telefon numarası gir.');
      return;
    }

    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: branchId || null,
          type: orderType,
          tableNumber: orderType === 'TABLE' ? tableNumber.trim() : null,
          total: numericTotal,
          paymentMethod,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          customerAddress: orderType === 'DELIVERY' ? customerAddress.trim() || null : null,
          note: note.trim() || null,
          status: 'PENDING',
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        setError(data?.message || 'Sipariş oluşturulamadı.');
        return;
      }

      const refreshedOrders = await loadOrdersForCode(token);
      const createdOrderCode = extractOrderCode(data) || getNewestOrderCode(refreshedOrders) || orderCodePreview;

      setLastOrderCode(createdOrderCode);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setTotal('');
      setPaymentMethod('CASH');
      setNote('');
      setSuccess(`${createdOrderCode} oluşturuldu ve operasyon ekranına düştü.`);
    } catch {
      setError('Sipariş oluşturulurken hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-800 text-white">
        <p className="text-lg font-semibold">CALLER ID yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Telefon Siparişi
              </p>
              <h1 className="mt-2 text-3xl font-black">CALLER ID</h1>
              <p className="mt-2 text-sm text-slate-200">
                Telefonla gelen siparişleri buradan oluştur. Sipariş kodu sistem tarafından otomatik verilir.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-slate-100 transition hover:bg-white/15"
              >
                Ana Sayfa
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard/orders/history')}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-slate-100 transition hover:bg-white/15"
              >
                Geçmiş Siparişler
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-cyan-400/30 bg-cyan-500/15 p-5">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
              Sıradaki Sipariş Kodu
            </p>
            <p className="mt-2 text-4xl font-black text-white">{lastOrderCode || orderCodePreview}</p>
            <p className="mt-2 text-xs font-bold text-cyan-100/80">
              Sipariş oluşturulduğunda bu kod operasyon ekranında da görünür.
            </p>
          </div>
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {success}
          </div>
        ) : null}

        {lastOrderCode ? (
          <div className="mb-5 rounded-3xl border border-emerald-400/40 bg-emerald-500/15 p-5 shadow-xl shadow-black/10">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">
              Oluşturulan Sipariş Kodu
            </p>
            <p className="mt-2 text-4xl font-black text-white">{lastOrderCode}</p>
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-xl font-black">Yeni Telefon Siparişi</h2>
            <p className="mt-1 text-sm text-slate-300">
              Sipariş oluşturulduktan sonra Yeni Siparişler operasyon bölümüne düşer.
            </p>
          </div>

          <form onSubmit={createOrder} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-100">
              Sipariş Kodu
              <input
                value={lastOrderCode || orderCodePreview}
                readOnly
                className="mt-2 w-full cursor-not-allowed rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 font-black text-cyan-50 outline-none"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-100">
              Şube
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                <option value="">Şube seçilmedi</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-100">
              Sipariş Tipi
              <select
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as OrderType)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                {ORDER_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            {orderType === 'TABLE' ? (
              <label className="block text-sm font-semibold text-slate-100">
                Masa No
                <input
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                  placeholder="Örn: 5"
                />
              </label>
            ) : null}

            <label className="block text-sm font-semibold text-slate-100">
              Müşteri Adı
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                placeholder="Müşteri adı"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-100">
              Telefon
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                placeholder="05xx xxx xx xx"
              />
            </label>

            {orderType === 'DELIVERY' ? (
              <label className="block text-sm font-semibold text-slate-100 md:col-span-2">
                Adres
                <input
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                  placeholder="Teslimat adresi"
                />
              </label>
            ) : null}

            <label className="block text-sm font-semibold text-slate-100">
              Toplam Tutar
              <input
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                placeholder="Örn: 250"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-100">
              Ödeme Tipi
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-100 md:col-span-2 xl:col-span-3">
              Not
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                placeholder="Sipariş notu"
              />
            </label>

            <div className="md:col-span-2 xl:col-span-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Oluşturuluyor...' : 'Sipariş Oluştur'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
