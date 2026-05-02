'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Branch = {
  id: string;
  name: string;
};

type OrderType = 'DELIVERY' | 'TABLE' | 'TAKEAWAY';
type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'ONLINE' | 'MEAL_CARD' | 'OPEN_ACCOUNT';

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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    async function loadBranches() {
      try {
        const response = await fetch('/api/branches', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Şubeler yüklenemedi.');
          return;
        }

        const safeBranches = Array.isArray(data) ? data : [];
        setBranches(safeBranches);
        setBranchId(safeBranches[0]?.id || '');
      } catch {
        setError('Şubeler yüklenirken hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }

    loadBranches();
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

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş oluşturulamadı.');
        return;
      }

      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setTotal('');
      setPaymentMethod('CASH');
      setNote('');
      setSuccess(`${data.code || 'Sipariş'} oluşturuldu ve operasyon ekranına düştü.`);
    } catch {
      setError('Sipariş oluşturulurken hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-lg font-semibold">CALLER ID yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Telefon Siparişi
            </p>
            <h1 className="mt-2 text-3xl font-black">CALLER ID</h1>
            <p className="mt-2 text-sm text-slate-300">
              Telefonla gelen siparişleri buradan oluştur. Sipariş kodu API tarafından otomatik verilir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
            >
              Operasyon Ekranı
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard/orders/history')}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
            >
              Geçmiş Siparişler
            </button>
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

        <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h2 className="text-xl font-black">Yeni Telefon Siparişi</h2>
            <p className="mt-1 text-sm text-slate-400">
              Sipariş oluşturulduktan sonra Yeni Siparişler operasyon bölümüne düşer.
            </p>
          </div>

          <form onSubmit={createOrder} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-200">
              Şube
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                <option value="">Şube seçilmedi</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Sipariş Tipi
              <select
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as OrderType)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                {ORDER_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            {orderType === 'TABLE' ? (
              <label className="block text-sm font-semibold text-slate-200">
                Masa No
                <input
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                  placeholder="Örn: 5"
                />
              </label>
            ) : null}

            <label className="block text-sm font-semibold text-slate-200">
              Müşteri Adı
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="Müşteri adı"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Telefon
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="05xx xxx xx xx"
              />
            </label>

            {orderType === 'DELIVERY' ? (
              <label className="block text-sm font-semibold text-slate-200 md:col-span-2">
                Adres
                <input
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                  placeholder="Teslimat adresi"
                />
              </label>
            ) : null}

            <label className="block text-sm font-semibold text-slate-200">
              Toplam Tutar
              <input
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                placeholder="Örn: 250"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-200">
              Ödeme Tipi
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
              >
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-200 md:col-span-2 xl:col-span-3">
              Not
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
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
