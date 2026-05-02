'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Branch = {
  id: string;
  name: string;
};

type DiningArea = {
  id: string;
  branchId: string;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean;
};

type RestaurantTable = {
  id: string;
  branchId: string;
  diningAreaId?: string | null;
  code?: string | null;
  name: string;
  capacity?: number | null;
  sortOrder?: number | null;
  isActive?: boolean;
  isReserved?: boolean;
  reservationNote?: string | null;
  reservedAt?: string | null;
};

type TableSessionItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  status?: string;
};

type TableSession = {
  id: string;
  branchId: string;
  tableId: string;
  status: 'OPEN' | 'PAYMENT_PENDING' | 'CLOSED' | 'CANCELLED';
  openedAt: string;
  closedAt?: string | null;
  table?: RestaurantTable;
  items?: TableSessionItem[];
};

const moneyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});

const statusLabels: Record<string, string> = {
  OPEN: 'Açık',
  PAYMENT_PENDING: 'Hesap Bekliyor',
  CLOSED: 'Kapandı',
  CANCELLED: 'İptal',
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
}

function formatMoney(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);
  return moneyFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function tableLabel(table: RestaurantTable) {
  return table.code?.trim() || table.name;
}

function sessionTotal(session?: TableSession) {
  if (!session?.items?.length) return 0;
  return session.items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    let message = text || 'İşlem başarısız oldu';

    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.error || message;
    } catch {
      // düz text kalabilir
    }

    throw new Error(message);
  }

  return text ? JSON.parse(text) : ({} as T);
}

export default function TableServicePage() {
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [openSessions, setOpenSessions] = useState<TableSession[]>([]);

  const [activeTab, setActiveTab] = useState<'operation' | 'settings'>('operation');
  const [showPassive, setShowPassive] = useState(false);

  const [areaForm, setAreaForm] = useState({ id: '', name: '', sortOrder: '0' });
  const [tableForm, setTableForm] = useState({
    id: '',
    diningAreaId: '',
    code: '',
    name: '',
    capacity: '',
    sortOrder: '0',
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const token = getToken();

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const currentToken = getToken();

    if (!currentToken) {
      router.push('/login');
      throw new Error('Oturum bulunamadı');
    }

    const response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
        ...(init?.headers || {}),
      },
    });

    return readJson<T>(response);
  }

  async function loadBranches() {
    const branchData = await api<Branch[]>('/branches');
    setBranches(branchData);

    if (!selectedBranchId && branchData[0]?.id) {
      setSelectedBranchId(branchData[0].id);
    }
  }

  async function loadTableServiceData(branchId = selectedBranchId) {
    if (!branchId) return;

    setLoading(true);
    setError('');

    try {
      const includeInactive = showPassive ? '&includeInactive=1' : '';

      const [areaData, tableData, sessionData] = await Promise.all([
        api<DiningArea[]>(`/table-service/dining-areas?branchId=${branchId}${includeInactive}`),
        api<RestaurantTable[]>(`/table-service/tables?branchId=${branchId}${includeInactive}`),
        api<TableSession[]>(`/table-service/sessions/open?branchId=${branchId}`),
      ]);

      setAreas(areaData);
      setTables(tableData);
      setOpenSessions(sessionData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Masa servis verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    loadBranches().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Şubeler yüklenemedi');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      loadTableServiceData(selectedBranchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, showPassive]);

  const areaById = useMemo(() => {
    return new Map(areas.map((area) => [area.id, area]));
  }, [areas]);

  const sessionByTableId = useMemo(() => {
    return new Map(openSessions.map((session) => [session.tableId, session]));
  }, [openSessions]);

  const activeTables = useMemo(() => {
    return tables.filter((table) => table.isActive !== false);
  }, [tables]);

  const totalOpenAmount = useMemo(() => {
    return openSessions.reduce((sum, session) => sum + sessionTotal(session), 0);
  }, [openSessions]);

  const reservedCount = useMemo(() => {
    return activeTables.filter((table) => table.isReserved).length;
  }, [activeTables]);

  function resetAreaForm() {
    setAreaForm({ id: '', name: '', sortOrder: '0' });
  }

  function resetTableForm() {
    setTableForm({
      id: '',
      diningAreaId: '',
      code: '',
      name: '',
      capacity: '',
      sortOrder: '0',
    });
  }

  async function saveArea() {
    if (!selectedBranchId) return;
    if (!areaForm.name.trim()) {
      setError('Salon / alan adı zorunludur');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const body = {
        branchId: selectedBranchId,
        name: areaForm.name.trim(),
        sortOrder: Number(areaForm.sortOrder || 0),
      };

      if (areaForm.id) {
        await api(`/table-service/dining-areas/${areaForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: body.name,
            sortOrder: body.sortOrder,
          }),
        });
        setMessage('Salon / alan güncellendi');
      } else {
        await api('/table-service/dining-areas', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMessage('Salon / alan eklendi');
      }

      resetAreaForm();
      await loadTableServiceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Salon / alan kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function saveTable() {
    if (!selectedBranchId) return;
    if (!tableForm.name.trim()) {
      setError('Masa adı zorunludur');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const body = {
        branchId: selectedBranchId,
        diningAreaId: tableForm.diningAreaId || null,
        code: tableForm.code.trim() || undefined,
        name: tableForm.name.trim(),
        capacity: tableForm.capacity ? Number(tableForm.capacity) : null,
        sortOrder: Number(tableForm.sortOrder || 0),
      };

      if (tableForm.id) {
        await api(`/table-service/tables/${tableForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            diningAreaId: body.diningAreaId,
            code: body.code,
            name: body.name,
            capacity: body.capacity,
            sortOrder: body.sortOrder,
          }),
        });
        setMessage('Masa güncellendi');
      } else {
        await api('/table-service/tables', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setMessage('Masa eklendi');
      }

      resetTableForm();
      await loadTableServiceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Masa kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function setAreaActive(area: DiningArea, isActive: boolean) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/dining-areas/${area.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });

      setMessage(isActive ? 'Salon / alan aktifleştirildi' : 'Salon / alan pasife alındı');
      await loadTableServiceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'İşlem başarısız oldu');
    } finally {
      setSaving(false);
    }
  }

  async function setTableActive(table: RestaurantTable, isActive: boolean) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/tables/${table.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });

      setMessage(isActive ? 'Masa aktifleştirildi' : 'Masa pasife alındı');
      await loadTableServiceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'İşlem başarısız oldu');
    } finally {
      setSaving(false);
    }
  }

  async function toggleReservation(table: RestaurantTable) {
    const openSession = sessionByTableId.get(table.id);

    if (openSession) {
      setError('Açık adisyonu olan masa rezerve edilemez');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/tables/${table.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isReserved: !table.isReserved,
          reservationNote: !table.isReserved ? 'Panel üzerinden rezerve edildi' : null,
        }),
      });

      setMessage(table.isReserved ? 'Rezervasyon kaldırıldı' : 'Masa rezerve edildi');
      await loadTableServiceData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Rezervasyon işlemi başarısız oldu');
    } finally {
      setSaving(false);
    }
  }

  async function openSession(table: RestaurantTable) {
    if (!selectedBranchId) return;

    const existingSession = sessionByTableId.get(table.id);

    if (existingSession) {
      router.push(`/dashboard/table-service/sessions/${existingSession.id}`);
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const session = await api<TableSession>('/table-service/sessions/open', {
        method: 'POST',
        body: JSON.stringify({
          branchId: selectedBranchId,
          tableId: table.id,
        }),
      });

      router.push(`/dashboard/table-service/sessions/${session.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Masa açılamadı');
    } finally {
      setSaving(false);
    }
  }

  function startEditArea(area: DiningArea) {
    setActiveTab('settings');
    setAreaForm({
      id: area.id,
      name: area.name,
      sortOrder: String(area.sortOrder ?? 0),
    });
  }

  function startEditTable(table: RestaurantTable) {
    setActiveTab('settings');
    setTableForm({
      id: table.id,
      diningAreaId: table.diningAreaId || '',
      code: table.code || '',
      name: table.name,
      capacity: table.capacity ? String(table.capacity) : '',
      sortOrder: String(table.sortOrder ?? 0),
    });
  }

  function renderTableCard(table: RestaurantTable) {
    const session = sessionByTableId.get(table.id);
    const isOpen = Boolean(session);
    const isPaymentPending = session?.status === 'PAYMENT_PENDING';
    const qrHref = `/qr?branchId=${encodeURIComponent(selectedBranchId)}&table=${encodeURIComponent(
      table.code || table.name,
    )}`;

    const statusClass = !table.isActive
      ? 'border-slate-400/30 bg-slate-500/10 text-slate-200'
      : isPaymentPending
        ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
        : isOpen
          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
          : table.isReserved
            ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
            : 'border-sky-400/40 bg-sky-500/15 text-sky-100';

    const statusLabel = !table.isActive
      ? 'Pasif'
      : isPaymentPending
        ? 'Hesap Bekliyor'
        : isOpen
          ? 'Açık Adisyon'
          : table.isReserved
            ? 'Rezerve'
            : 'Boş';

    return (
      <article
        key={table.id}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Masa</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{tableLabel(table)}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{table.name}</p>
          </div>

          <span className={`rounded-2xl border px-4 py-2 text-xs font-black ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Toplam</p>
            <p className="mt-1 text-xl font-black text-slate-950">{formatMoney(sessionTotal(session))}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Salon</p>
            <p className="mt-1 truncate text-sm font-black text-slate-800">
              {table.diningAreaId ? areaById.get(table.diningAreaId)?.name || 'Alan yok' : 'Genel'}
            </p>
          </div>
        </div>

        {session ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
            Açılış: {formatDate(session.openedAt)} • Durum: {statusLabels[session.status] || session.status}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {session ? (
            <Link
              href={`/dashboard/table-service/sessions/${session.id}`}
              className="rounded-2xl bg-slate-950 px-5 py-4 text-center text-sm font-black text-white transition hover:bg-slate-800"
            >
              Adisyonu Aç
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void openSession(table)}
              disabled={saving || table.isActive === false}
              className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Masa Aç
            </button>
          )}

          <button
            type="button"
            onClick={() => void toggleReservation(table)}
            disabled={saving || Boolean(session) || table.isActive === false}
            className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-black text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {table.isReserved ? 'Rezervasyonu Kaldır' : 'Rezerve Yap'}
          </button>

          <button
            type="button"
            onClick={() => router.push(qrHref)}
            disabled={table.isActive === false}
            className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm font-black text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            QR Kod
          </button>
        </div>
      </article>
    );
  }

  const groupedTables = useMemo(() => {
    const groups = new Map<string, RestaurantTable[]>();

    activeTables.forEach((table) => {
      const key = table.diningAreaId || 'general';
      const current = groups.get(key) || [];
      current.push(table);
      groups.set(key, current);
    });

    groups.forEach((groupTables) => {
      groupTables.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
    });

    return groups;
  }, [activeTables]);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-600">Restoran SaaS</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Masa Servis</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Salon, masa, QR, rezervasyon ve adisyon operasyon ekranı.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Operasyona Dön
              </Link>
              <Link
                href="/dashboard/orders/history"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Geçmiş Siparişler
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Açık Adisyon</p>
              <p className="mt-2 text-3xl font-black">{openSessions.length}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Açık Tutar</p>
              <p className="mt-2 text-3xl font-black">{formatMoney(totalOpenAmount)}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Aktif Masa</p>
              <p className="mt-2 text-3xl font-black">{activeTables.length}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Rezerve</p>
              <p className="mt-2 text-3xl font-black">{reservedCount}</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('operation')}
                className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                  activeTab === 'operation'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Masa Operasyon
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                  activeTab === 'settings'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Masa Servis Ayarları
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black outline-none focus:border-emerald-400"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => void loadTableServiceData()}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Yenile
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-lg font-black text-slate-600">
            Masa servis yükleniyor...
          </div>
        ) : null}

        {!loading && activeTab === 'operation' ? (
          <section className="space-y-6">
            {areas
              .filter((area) => area.isActive !== false)
              .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
              .map((area) => {
                const areaTables = groupedTables.get(area.id) || [];

                if (areaTables.length === 0) return null;

                return (
                  <div key={area.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Salon / Alan</p>
                        <h2 className="mt-1 text-2xl font-black">{area.name}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEditArea(area)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                      >
                        Ayarlarda Düzenle
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {areaTables.map(renderTableCard)}
                    </div>
                  </div>
                );
              })}

            {(groupedTables.get('general') || []).length > 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Salon / Alan</p>
                  <h2 className="mt-1 text-2xl font-black">Genel Alan</h2>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(groupedTables.get('general') || []).map(renderTableCard)}
                </div>
              </div>
            ) : null}

            {activeTables.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
                <h2 className="text-2xl font-black">Henüz masa yok</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Masa Servis Ayarları bölümünden salon ve masa ekleyebilirsin.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="mt-5 rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
                >
                  Ayarlara Git
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {!loading && activeTab === 'settings' ? (
          <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">Salon / Alan Ekle</h2>
                <div className="mt-5 space-y-4">
                  <input
                    value={areaForm.name}
                    onChange={(event) => setAreaForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Örn: Bahçe, Salon, Teras"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  />
                  <input
                    value={areaForm.sortOrder}
                    onChange={(event) => setAreaForm((current) => ({ ...current, sortOrder: event.target.value }))}
                    placeholder="Sıra"
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void saveArea()}
                      disabled={saving}
                      className="flex-1 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {areaForm.id ? 'Alanı Güncelle' : 'Alan Ekle'}
                    </button>
                    {areaForm.id ? (
                      <button
                        type="button"
                        onClick={resetAreaForm}
                        className="rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700"
                      >
                        Vazgeç
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">Masa Ekle</h2>
                <div className="mt-5 space-y-4">
                  <select
                    value={tableForm.diningAreaId}
                    onChange={(event) => setTableForm((current) => ({ ...current, diningAreaId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  >
                    <option value="">Genel Alan</option>
                    {areas
                      .filter((area) => area.isActive !== false)
                      .map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                  </select>

                  <input
                    value={tableForm.code}
                    onChange={(event) => setTableForm((current) => ({ ...current, code: event.target.value }))}
                    placeholder="Masa kodu / numarası: 1, 2, BAHCE-1"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  />

                  <input
                    value={tableForm.name}
                    onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Masa adı: Masa 1"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={tableForm.capacity}
                      onChange={(event) => setTableForm((current) => ({ ...current, capacity: event.target.value }))}
                      placeholder="Kapasite"
                      type="number"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                    />
                    <input
                      value={tableForm.sortOrder}
                      onChange={(event) => setTableForm((current) => ({ ...current, sortOrder: event.target.value }))}
                      placeholder="Sıra"
                      type="number"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void saveTable()}
                      disabled={saving}
                      className="flex-1 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {tableForm.id ? 'Masayı Güncelle' : 'Masa Ekle'}
                    </button>
                    {tableForm.id ? (
                      <button
                        type="button"
                        onClick={resetTableForm}
                        className="rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700"
                      >
                        Vazgeç
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-black">Salon / Alan Listesi</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">Pasif alanlar istenirse tekrar açılabilir.</p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700">
                    <input
                      type="checkbox"
                      checked={showPassive}
                      onChange={(event) => setShowPassive(event.target.checked)}
                    />
                    Pasifleri Göster
                  </label>
                </div>

                <div className="mt-5 divide-y divide-slate-100">
                  {areas.map((area) => (
                    <div key={area.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-lg font-black">{area.name}</p>
                        <p className="text-sm font-semibold text-slate-500">
                          Sıra: {area.sortOrder ?? 0} • {area.isActive === false ? 'Pasif' : 'Aktif'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditArea(area)}
                          className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => void setAreaActive(area, area.isActive === false)}
                          className={`rounded-xl px-4 py-3 text-xs font-black ${
                            area.isActive === false
                              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {area.isActive === false ? 'Aktifleştir' : 'Pasife Al'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {areas.length === 0 ? (
                    <div className="py-8 text-center text-sm font-bold text-slate-500">Henüz salon / alan yok.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-black">Masa Listesi</h2>

                <div className="mt-5 divide-y divide-slate-100">
                  {tables.map((table) => {
                    const session = sessionByTableId.get(table.id);

                    return (
                      <div key={table.id} className="flex flex-col gap-3 py-4 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-lg font-black">
                            {tableLabel(table)} <span className="text-sm font-bold text-slate-400">/ {table.name}</span>
                          </p>
                          <p className="text-sm font-semibold text-slate-500">
                            {table.diningAreaId ? areaById.get(table.diningAreaId)?.name || 'Alan yok' : 'Genel Alan'} •{' '}
                            {table.isActive === false ? 'Pasif' : 'Aktif'} •{' '}
                            {table.isReserved ? 'Rezerve' : session ? 'Açık adisyon' : 'Boş'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditTable(table)}
                            className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => void setTableActive(table, table.isActive === false)}
                            className={`rounded-xl px-4 py-3 text-xs font-black ${
                              table.isActive === false
                                ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                          >
                            {table.isActive === false ? 'Aktifleştir' : 'Pasife Al'}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {tables.length === 0 ? (
                    <div className="py-8 text-center text-sm font-bold text-slate-500">Henüz masa yok.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
