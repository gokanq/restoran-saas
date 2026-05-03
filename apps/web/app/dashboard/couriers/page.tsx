'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Branch = {
  id: string;
  name: string;
};

type Courier = {
  id: string;
  branchId?: string | null;
  name: string;
  phone?: string | null;
  perPackageFee: string | number;
  hourlyFee: string | number;
  isActive: boolean;
  branch?: Branch | null;
};

type CourierWorkLog = {
  id: string;
  courierId: string;
  workDate: string;
  hours: string | number;
  note?: string | null;
};

type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'ON_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

type Order = {
  id: string;
  code: string;
  type?: string;
  status: OrderStatus | string;
  total: string | number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  courierId?: string | null;
  courierName?: string | null;
  createdAt: string;
  branch?: Branch | null;
};

type Tab = 'couriers' | 'history' | 'summary';

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  ACCEPTED: 'Kabul Edildi',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
  ON_DELIVERY: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

const ORDER_STATUS_CLASSES: Record<string, string> = {
  ON_DELIVERY: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-red-200 bg-red-50 text-red-700',
};

function toNumber(value: string | number | undefined | null) {
  const parsedValue = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(toNumber(value));
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isWithinDateRange(order: Order, startDate: string, endDate: string) {
  const orderDate = new Date(order.createdAt);

  if (Number.isNaN(orderDate.getTime())) {
    return false;
  }

  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`);

    if (orderDate < start) {
      return false;
    }
  }

  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`);

    if (orderDate > end) {
      return false;
    }
  }

  return true;
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function buildWorkLogsPath(startDate: string, endDate: string) {
  const params = new URLSearchParams();

  if (startDate) {
    params.set('startDate', startDate);
  }

  if (endDate) {
    params.set('endDate', endDate);
  }

  const query = params.toString();

  return `/api/couriers/work-logs${query ? `?${query}` : ''}`;
}

function syncWorkLogFormState(
  workLogs: CourierWorkLog[],
  setWorkHours: (value: Record<string, string>) => void,
  setWorkNotes: (value: Record<string, string>) => void,
) {
  const hoursByCourier: Record<string, number> = {};
  const notesByCourier: Record<string, string> = {};

  workLogs.forEach((workLog) => {
    hoursByCourier[workLog.courierId] =
      (hoursByCourier[workLog.courierId] || 0) + toNumber(workLog.hours);

    if (workLog.note) {
      notesByCourier[workLog.courierId] = workLog.note;
    }
  });

  setWorkHours(
    Object.fromEntries(
      Object.entries(hoursByCourier).map(([courierId, hours]) => [
        courierId,
        String(hours),
      ]),
    ),
  );
  setWorkNotes(notesByCourier);
}

export default function CouriersPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('couriers');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [perPackageFee, setPerPackageFee] = useState('0');
  const [hourlyFee, setHourlyFee] = useState('0');

  const [editingCourierId, setEditingCourierId] = useState<string | null>(null);
  const [editBranchId, setEditBranchId] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPerPackageFee, setEditPerPackageFee] = useState('0');
  const [editHourlyFee, setEditHourlyFee] = useState('0');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isUpdatingCourier, setIsUpdatingCourier] = useState(false);

  const [selectedCourierId, setSelectedCourierId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState(dateInputValue(new Date()));
  const [endDate, setEndDate] = useState(dateInputValue(new Date()));
  const [courierWorkLogs, setCourierWorkLogs] = useState<CourierWorkLog[]>([]);
  const [workHoursByCourier, setWorkHoursByCourier] = useState<Record<string, string>>({});
  const [workNotesByCourier, setWorkNotesByCourier] = useState<Record<string, string>>({});
  const [savingWorkLogCourierId, setSavingWorkLogCourierId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function apiRequest(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      throw new Error('Oturum bulunamadı.');
    }

    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const data = await readJson(response);

    if (!response.ok) {
      const responseMessage =
        typeof data === 'object' && data && 'message' in data
          ? String(data.message)
          : 'İşlem başarısız oldu.';

      throw new Error(responseMessage);
    }

    return data;
  }

  async function loadData() {
    setIsLoading(true);
    setError('');

    try {
      const [branchesData, couriersData, ordersData, workLogsData] = await Promise.all([
        apiRequest('/api/branches'),
        apiRequest('/api/couriers'),
        apiRequest('/api/orders'),
        apiRequest(buildWorkLogsPath(startDate, endDate)),
      ]);

      const safeBranches = Array.isArray(branchesData) ? branchesData : [];
      const safeCouriers = Array.isArray(couriersData) ? couriersData : [];
      const safeOrders = Array.isArray(ordersData) ? ordersData : [];
      const safeWorkLogs = Array.isArray(workLogsData) ? workLogsData : [];

      setBranches(safeBranches);
      setCouriers(safeCouriers);
      setOrders(safeOrders);
      setCourierWorkLogs(safeWorkLogs);
      syncWorkLogFormState(safeWorkLogs, setWorkHoursByCourier, setWorkNotesByCourier);
      setBranchId((current) => current || safeBranches[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Bilgiler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadCourierWorkLogs() {
    try {
      const workLogsData = await apiRequest(buildWorkLogsPath(startDate, endDate));
      const safeWorkLogs = Array.isArray(workLogsData) ? workLogsData : [];

      setCourierWorkLogs(safeWorkLogs);
      syncWorkLogFormState(safeWorkLogs, setWorkHoursByCourier, setWorkNotesByCourier);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kurye mesai kayıtları yüklenemedi.');
    }
  }

  async function saveCourierWorkLog(courier: Courier) {
    if (!startDate) {
      setError('Mesai kaydı için başlangıç tarihi seçilmelidir.');
      return;
    }

    setSavingWorkLogCourierId(courier.id);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/couriers/work-logs/${courier.id}/${startDate}`, {
        method: 'PUT',
        body: JSON.stringify({
          hours: toNumber(workHoursByCourier[courier.id]),
          note: workNotesByCourier[courier.id] || null,
        }),
      });

      setMessage(`${courier.name} mesai kaydı güncellendi.`);
      await loadCourierWorkLogs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Mesai kaydı güncellenemedi.');
    } finally {
      setSavingWorkLogCourierId(null);
    }
  }

  useEffect(() => {
    if (!isLoading) {
      loadCourierWorkLogs();
    }
  }, [startDate, endDate]);

  const courierOrders = useMemo(() => {
    return orders.filter((order) => {
      const hasCourier = Boolean(order.courierId || order.courierName);
      const isDeliveryFlow =
        order.status === 'ON_DELIVERY' ||
        order.status === 'DELIVERED' ||
        order.status === 'CANCELLED';

      if (!hasCourier || !isDeliveryFlow) {
        return false;
      }

      if (selectedCourierId !== 'ALL') {
        const courier = couriers.find((item) => item.id === selectedCourierId);
        const matchesCourierId = order.courierId === selectedCourierId;
        const matchesCourierName = courier ? order.courierName === courier.name : false;

        if (!matchesCourierId && !matchesCourierName) {
          return false;
        }
      }

      if (selectedStatus !== 'ALL' && order.status !== selectedStatus) {
        return false;
      }

      return isWithinDateRange(order, startDate, endDate);
    });
  }, [orders, couriers, selectedCourierId, selectedStatus, startDate, endDate]);

  const summaryRows = useMemo(() => {
    return couriers
      .map((courier) => {
        const ordersForCourier = orders.filter((order) => {
          const matchesCourier =
            order.courierId === courier.id || (!order.courierId && order.courierName === courier.name);

          return matchesCourier && isWithinDateRange(order, startDate, endDate);
        });

        const deliveredOrders = ordersForCourier.filter((order) => order.status === 'DELIVERED');
        const onDeliveryOrders = ordersForCourier.filter((order) => order.status === 'ON_DELIVERY');
        const cancelledOrders = ordersForCourier.filter((order) => order.status === 'CANCELLED');
        const deliveredRevenue = deliveredOrders.reduce(
          (sum, order) => sum + toNumber(order.total),
          0,
        );

        const workHours = toNumber(workHoursByCourier[courier.id]);
        const packageCost = deliveredOrders.length * toNumber(courier.perPackageFee);
        const hourlyCost = workHours * toNumber(courier.hourlyFee);
        const totalCost = packageCost + hourlyCost;

        return {
          courier,
          deliveredOrders,
          onDeliveryOrders,
          cancelledOrders,
          deliveredRevenue,
          workHours,
          packageCost,
          hourlyCost,
          totalCost,
        };
      })
      .filter((row) => {
        if (selectedCourierId === 'ALL') {
          return true;
        }

        return row.courier.id === selectedCourierId;
      });
  }, [couriers, orders, selectedCourierId, startDate, endDate, workHoursByCourier, courierWorkLogs]);

  async function createCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError('Kurye adı zorunludur.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      await apiRequest('/api/couriers', {
        method: 'POST',
        body: JSON.stringify({
          branchId: branchId || null,
          name: name.trim(),
          phone: phone.trim() || null,
          perPackageFee: toNumber(perPackageFee),
          hourlyFee: toNumber(hourlyFee),
          isActive: true,
        }),
      });

      setName('');
      setPhone('');
      setPerPackageFee('0');
      setHourlyFee('0');
      setMessage('Kurye tanımı eklendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kurye eklenemedi.');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleCourier(courier: Courier) {
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/couriers/${courier.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: !courier.isActive,
        }),
      });

      setMessage(courier.isActive ? 'Kurye pasife alındı.' : 'Kurye aktife alındı.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kurye güncellenemedi.');
    }
  }

  function startEditCourier(courier: Courier) {
    setEditingCourierId(courier.id);
    setEditBranchId(courier.branchId || '');
    setEditName(courier.name);
    setEditPhone(courier.phone || '');
    setEditPerPackageFee(String(toNumber(courier.perPackageFee)));
    setEditHourlyFee(String(toNumber(courier.hourlyFee)));
    setEditIsActive(courier.isActive);
    setError('');
    setMessage('');
  }

  function cancelEditCourier() {
    setEditingCourierId(null);
    setEditBranchId('');
    setEditName('');
    setEditPhone('');
    setEditPerPackageFee('0');
    setEditHourlyFee('0');
    setEditIsActive(true);
  }

  async function updateCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCourierId) {
      return;
    }

    if (!editName.trim()) {
      setError('Kurye adı zorunludur.');
      return;
    }

    setIsUpdatingCourier(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/couriers/${editingCourierId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          branchId: editBranchId || null,
          name: editName.trim(),
          phone: editPhone.trim() || null,
          perPackageFee: toNumber(editPerPackageFee),
          hourlyFee: toNumber(editHourlyFee),
          isActive: editIsActive,
        }),
      });

      setMessage('Kurye bilgileri güncellendi.');
      cancelEditCourier();
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kurye güncellenemedi.');
    } finally {
      setIsUpdatingCourier(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-600">
            Kurye Operasyonu
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Kuryeler / Gün Sonu</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Kurye tanımları, kurye geçmişi ve gün sonu maliyet özetini tek ekrandan yönetin.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Ana Sayfa
            </a>

            <a
              href="/dashboard/orders/history"
              className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              Geçmiş Siparişler
            </a>
          </div>
        </header>

        <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { value: 'couriers', label: 'Kurye Tanımları' },
              { value: 'history', label: 'Kurye Geçmişi' },
              { value: 'summary', label: 'Gün Sonu Özeti' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value as Tab)}
                className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                  activeTab === tab.value
                    ? 'border border-emerald-500 bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)]'
                    : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 shadow-sm">
            {message}
          </div>
        ) : null}

        {activeTab === 'couriers' ? (
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <form onSubmit={createCourier} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-black text-slate-950">Kurye Ekle</h2>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-bold">
                  Şube
                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="">Genel / Tüm şubeler</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-bold">
                  Kurye Adı
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ahmet Yılmaz"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="block text-sm font-bold">
                  Telefon
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="05xx xxx xx xx"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-bold">
                    Paket Başı Ücret
                    <input
                      value={perPackageFee}
                      onChange={(event) => setPerPackageFee(event.target.value)}
                      placeholder="20"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block text-sm font-bold">
                    Saatlik Ücret
                    <input
                      value={hourlyFee}
                      onChange={(event) => setHourlyFee(event.target.value)}
                      placeholder="100"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {isSaving ? 'Ekleniyor...' : 'Kurye Ekle'}
                </button>
              </div>
            </form>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-black text-slate-950">Kurye Listesi</h2>

              <div className="mt-5 space-y-3">
                {isLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500 shadow-sm">
                    Kuryeler yükleniyor...
                  </div>
                ) : couriers.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500 shadow-sm">
                    Henüz kurye tanımı yok.
                  </div>
                ) : (
                  couriers.map((courier) => (
                    <div key={courier.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-lg font-black text-slate-950">{courier.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {courier.phone || 'Telefon yok'} • {courier.branch?.name || 'Genel'}
                          </p>
                          <p className="mt-2 text-sm text-slate-500">
                            Paket başı: <b>{formatMoney(courier.perPackageFee)}</b> • Saatlik:{' '}
                            <b>{formatMoney(courier.hourlyFee)}</b>
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              courier.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {courier.isActive ? 'Aktif' : 'Pasif'}
                          </span>

                          <button
                            type="button"
                            onClick={() => startEditCourier(courier)}
                            className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 shadow-sm transition hover:bg-sky-100"
                          >
                            Ücret Düzenle
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleCourier(courier)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            {courier.isActive ? 'Pasife Al' : 'Aktife Al'}
                          </button>
                        </div>
                      </div>

                      {editingCourierId === courier.id ? (
                        <form
                          onSubmit={updateCourier}
                          className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-bold">
                              Kurye Adı
                              <input
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              />
                            </label>

                            <label className="block text-sm font-bold">
                              Telefon
                              <input
                                value={editPhone}
                                onChange={(event) => setEditPhone(event.target.value)}
                                placeholder="05xx xxx xx xx"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              />
                            </label>

                            <label className="block text-sm font-bold">
                              Şube
                              <select
                                value={editBranchId}
                                onChange={(event) => setEditBranchId(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              >
                                <option value="">Genel / Tüm şubeler</option>
                                {branches.map((branch) => (
                                  <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block text-sm font-bold">
                              Durum
                              <select
                                value={editIsActive ? 'ACTIVE' : 'PASSIVE'}
                                onChange={(event) => setEditIsActive(event.target.value === 'ACTIVE')}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              >
                                <option value="ACTIVE">Aktif</option>
                                <option value="PASSIVE">Pasif</option>
                              </select>
                            </label>

                            <label className="block text-sm font-bold">
                              Paket Başı Ücret
                              <input
                                value={editPerPackageFee}
                                onChange={(event) => setEditPerPackageFee(event.target.value)}
                                inputMode="decimal"
                                placeholder="20"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              />
                            </label>

                            <label className="block text-sm font-bold">
                              Saatlik Ücret
                              <input
                                value={editHourlyFee}
                                onChange={(event) => setEditHourlyFee(event.target.value)}
                                inputMode="decimal"
                                placeholder="100"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              />
                            </label>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={isUpdatingCourier}
                              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                            >
                              {isUpdatingCourier ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditCourier}
                              disabled={isUpdatingCourier}
                              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                            >
                              Vazgeç
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'history' || activeTab === 'summary' ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-black text-slate-950">Filtreler</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <label className="block text-sm font-bold">
                Kurye
                <select
                  value={selectedCourierId}
                  onChange={(event) => setSelectedCourierId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="ALL">Tüm Kuryeler</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-bold">
                Durum
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="ALL">Tümü</option>
                  <option value="ON_DELIVERY">Yolda</option>
                  <option value="DELIVERED">Teslim Edildi</option>
                  <option value="CANCELLED">İptal Edildi</option>
                </select>
              </label>

              <label className="block text-sm font-bold">
                Başlangıç
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-bold">
                Bitiş
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>
          </section>
        ) : null}

        {activeTab === 'history' ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-black text-slate-950">Kurye Geçmişi</h2>
            <p className="mt-1 text-sm text-slate-500">
              Gösterilen paket: {courierOrders.length}
            </p>

            <div className="mt-5 overflow-x-auto">
              {courierOrders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500 shadow-sm">
                  Bu filtrelerde kurye paketi bulunamadı.
                </div>
              ) : (
                <table className="w-full min-w-[1100px] overflow-hidden rounded-2xl text-left text-sm">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Kod</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Kurye</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Müşteri</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Telefon</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Adres</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Durum</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Tutar</th>
                      <th className="px-4 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-white">Tarih</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {courierOrders.map((order) => (
                      <tr key={order.id} className="bg-white transition hover:bg-slate-50">
                        <td className="px-4 py-4 font-bold">{order.code}</td>
                        <td className="px-4 py-4">{order.courierName || '-'}</td>
                        <td className="px-4 py-4">{order.customerName || '-'}</td>
                        <td className="px-4 py-4">{order.customerPhone || '-'}</td>
                        <td className="px-4 py-4">
                          <div className="max-w-[260px] truncate">{order.customerAddress || '-'}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              ORDER_STATUS_CLASSES[order.status] ||
                              'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-bold">{formatMoney(order.total)}</td>
                        <td className="px-4 py-4">{formatDateTime(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'summary' ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <h2 className="text-xl font-black text-slate-950">Gün Sonu Özeti</h2>

            <div className="mt-5 grid gap-4">
              {summaryRows.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-500 shadow-sm">
                  Kurye bulunamadı.
                </div>
              ) : (
                summaryRows.map((row) => (
                  <div key={row.courier.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xl font-black text-slate-950">{row.courier.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {row.courier.branch?.name || 'Genel'} • {row.courier.phone || 'Telefon yok'}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          Paket başı <b>{formatMoney(row.courier.perPackageFee)}</b> • Saatlik{' '}
                          <b>{formatMoney(row.courier.hourlyFee)}</b>
                        </p>
                      </div>

                      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <label className="block text-sm font-bold">
                          Çalışma Saati
                          <input
                            value={workHoursByCourier[row.courier.id] || ''}
                            onChange={(event) =>
                              setWorkHoursByCourier((current) => ({
                                ...current,
                                [row.courier.id]: event.target.value,
                              }))
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="mt-3 block text-sm font-bold">
                          Mesai Notu
                          <input
                            value={workNotesByCourier[row.courier.id] || ''}
                            onChange={(event) =>
                              setWorkNotesByCourier((current) => ({
                                ...current,
                                [row.courier.id]: event.target.value,
                              }))
                            }
                            placeholder="Örn: Akşam yoğunluğu"
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <p className="mt-2 text-xs text-slate-500">
                          Saatlik ücret: {formatMoney(row.courier.hourlyFee)} • Kayıt tarihi: {startDate}
                        </p>

                        <button
                          type="button"
                          onClick={() => saveCourierWorkLog(row.courier)}
                          disabled={savingWorkLogCourierId === row.courier.id}
                          className="mt-3 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                        >
                          {savingWorkLogCourierId === row.courier.id ? 'Kaydediliyor...' : 'Mesaiyi Kaydet'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500">Teslim Paket</p>
                        <p className="mt-2 text-2xl font-black">{row.deliveredOrders.length}</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500">Yolda</p>
                        <p className="mt-2 text-2xl font-black">{row.onDeliveryOrders.length}</p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500">İptal</p>
                        <p className="mt-2 text-2xl font-black">{row.cancelledOrders.length}</p>
                      </div>

                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                        <p className="text-xs font-bold text-emerald-700">Paket Tutarı</p>
                        <p className="mt-2 text-lg font-black">{formatMoney(row.deliveredRevenue)}</p>
                      </div>

                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                        <p className="text-xs font-bold text-amber-200">Paket Maliyeti</p>
                        <p className="mt-2 text-lg font-black">{formatMoney(row.packageCost)}</p>
                      </div>

                      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                        <p className="text-xs font-bold text-cyan-200">Toplam Maliyet</p>
                        <p className="mt-2 text-lg font-black">{formatMoney(row.totalCost)}</p>
                        <p className="mt-1 text-xs text-cyan-100">
                          Saatlik: {formatMoney(row.hourlyCost)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
