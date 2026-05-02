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
  sortOrder: number;
  isActive: boolean;
};

type RestaurantTable = {
  id: string;
  branchId: string;
  diningAreaId?: string | null;
  code: string;
  name: string;
  capacity?: number | null;
  sortOrder: number;
  isActive: boolean;
  diningArea?: DiningArea | null;
};

type TableSessionStatus = 'OPEN' | 'PAYMENT_PENDING' | 'CLOSED' | 'CANCELLED';
type TableSessionItemStatus = 'NEW' | 'SENT' | 'PREPARING' | 'SERVED' | 'VOID';

type TableSessionItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  note?: string | null;
  status: TableSessionItemStatus;
};

type TableSession = {
  id: string;
  branchId: string;
  tableId: string;
  status: TableSessionStatus;
  openedAt: string;
  closedAt?: string | null;
  table?: RestaurantTable | null;
  items?: TableSessionItem[];
};

const SESSION_STATUS_LABELS: Record<TableSessionStatus, string> = {
  OPEN: 'Açık',
  PAYMENT_PENDING: 'Ödeme Bekliyor',
  CLOSED: 'Kapandı',
  CANCELLED: 'İptal',
};

function formatMoney(value: string | number | undefined | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getStoredToken() {
  if (typeof window === 'undefined') return '';

  return (
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('restaurantToken') ||
    ''
  );
}

async function readJson(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || 'İşlem başarısız oldu';

    throw new Error(message);
  }

  return data;
}

export default function TableServicePage() {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [openSessions, setOpenSessions] = useState<TableSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TableSession | null>(null);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);

  const [areaName, setAreaName] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableCode, setTableCode] = useState('');
  const [tableCapacity, setTableCapacity] = useState('');
  const [tableAreaId, setTableAreaId] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnitPrice, setItemUnitPrice] = useState('');
  const [itemNote, setItemNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const openSessionByTableId = useMemo(() => {
    return new Map(openSessions.map((session) => [session.tableId, session]));
  }, [openSessions]);

  const unassignedTables = useMemo(() => {
    return tables.filter((table) => !table.diningAreaId);
  }, [tables]);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      void loadBranchData(selectedBranchId);
    }
  }, [selectedBranchId]);

  async function apiFetch<T>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> {
    const authToken = overrideToken || token;

    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${authToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    return readJson(response) as Promise<T>;
  }

  async function initialize() {
    try {
      setLoading(true);
      setError('');

      const storedToken = getStoredToken();

      if (!storedToken) {
        router.replace('/login');
        return;
      }

      setToken(storedToken);

      const branchesData = await apiFetch<Branch[]>('/api/branches', {}, storedToken);
      setBranches(branchesData);

      if (branchesData.length > 0) {
        setSelectedBranchId(branchesData[0].id);
      } else {
        setError('Şube bulunamadı. Önce şube tanımı yapılmalı.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Masa servis ekranı yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function loadBranchData(branchId: string) {
    try {
      setError('');

      const [areasData, tablesData, sessionsData] = await Promise.all([
        apiFetch<DiningArea[]>(`/api/table-service/dining-areas?branchId=${branchId}`),
        apiFetch<RestaurantTable[]>(`/api/table-service/tables?branchId=${branchId}`),
        apiFetch<TableSession[]>(`/api/table-service/sessions/open?branchId=${branchId}`),
      ]);

      setAreas(areasData);
      setTables(tablesData);
      setOpenSessions(sessionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Masa servis verileri alınamadı');
    }
  }

  async function createArea() {
    if (!selectedBranchId || !areaName.trim()) {
      setError('Salon / alan adı zorunludur');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await apiFetch('/api/table-service/dining-areas', {
        method: 'POST',
        body: JSON.stringify({
          branchId: selectedBranchId,
          name: areaName.trim(),
          sortOrder: areas.length + 1,
        }),
      });

      setAreaName('');
      setSuccess('Salon / alan eklendi.');
      await loadBranchData(selectedBranchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salon eklenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function createTable() {
    if (!selectedBranchId || !tableName.trim()) {
      setError('Masa adı zorunludur');
      return;
    }

    const capacity = tableCapacity.trim() ? Number(tableCapacity) : undefined;

    if (capacity !== undefined && (!Number.isFinite(capacity) || capacity < 1)) {
      setError('Kapasite pozitif sayı olmalıdır');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await apiFetch('/api/table-service/tables', {
        method: 'POST',
        body: JSON.stringify({
          branchId: selectedBranchId,
          diningAreaId: tableAreaId || undefined,
          name: tableName.trim(),
          code: tableCode.trim() || undefined,
          capacity,
          sortOrder: tables.length + 1,
        }),
      });

      setTableName('');
      setTableCode('');
      setTableCapacity('');
      setTableAreaId('');
      setSuccess('Masa eklendi.');
      await loadBranchData(selectedBranchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Masa eklenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function openSession(table: RestaurantTable) {
    if (!selectedBranchId) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const session = await apiFetch<TableSession>('/api/table-service/sessions/open', {
        method: 'POST',
        body: JSON.stringify({
          branchId: selectedBranchId,
          tableId: table.id,
        }),
      });

      setSelectedTable(table);
      await loadBranchData(selectedBranchId);
      await selectSession(session.id, table);
      setSuccess(`${table.name} için adisyon açıldı.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adisyon açılamadı');
    } finally {
      setSaving(false);
    }
  }

  async function selectSession(sessionId: string, table?: RestaurantTable | null) {
    try {
      setError('');

      const session = await apiFetch<TableSession>(`/api/table-service/sessions/${sessionId}`);
      setSelectedSession(session);
      setSelectedTable(table || session.table || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adisyon detayı alınamadı');
    }
  }

  async function addItem() {
    if (!selectedSession) {
      setError('Önce adisyon seçmelisiniz');
      return;
    }

    if (!itemName.trim()) {
      setError('Ürün adı zorunludur');
      return;
    }

    const quantity = Number(itemQuantity);
    const unitPrice = Number(itemUnitPrice);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Adet pozitif tam sayı olmalıdır');
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Birim fiyat negatif olamaz');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await apiFetch(`/api/table-service/sessions/${selectedSession.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          name: itemName.trim(),
          quantity,
          unitPrice,
          note: itemNote.trim() || undefined,
        }),
      });

      setItemName('');
      setItemQuantity('1');
      setItemUnitPrice('');
      setItemNote('');

      await selectSession(selectedSession.id, selectedTable);
      setSuccess('Ürün adisyona eklendi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ürün eklenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function setPaymentPending() {
    if (!selectedSession) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const session = await apiFetch<TableSession>(
        `/api/table-service/sessions/${selectedSession.id}/payment-pending`,
        { method: 'POST' },
      );

      setSelectedSession(session);
      setSuccess('Adisyon ödeme bekliyor durumuna alındı.');
      if (selectedBranchId) await loadBranchData(selectedBranchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adisyon güncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function closeSession() {
    if (!selectedSession) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await apiFetch(`/api/table-service/sessions/${selectedSession.id}/close`, {
        method: 'POST',
      });

      setSelectedSession(null);
      setSelectedTable(null);
      setSuccess('Adisyon kapatıldı.');
      if (selectedBranchId) await loadBranchData(selectedBranchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adisyon kapatılamadı');
    } finally {
      setSaving(false);
    }
  }

  async function cancelSession() {
    if (!selectedSession) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await apiFetch(`/api/table-service/sessions/${selectedSession.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Panel üzerinden iptal edildi' }),
      });

      setSelectedSession(null);
      setSelectedTable(null);
      setSuccess('Adisyon iptal edildi.');
      if (selectedBranchId) await loadBranchData(selectedBranchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adisyon iptal edilemedi');
    } finally {
      setSaving(false);
    }
  }

  function renderTableCard(table: RestaurantTable) {
    const currentSession = openSessionByTableId.get(table.id);
    const isOpen = Boolean(currentSession);

    return (
      <div
        key={table.id}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              {table.code}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{table.name}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {table.capacity ? `${table.capacity} kişilik` : 'Kapasite yok'}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              isOpen
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {currentSession ? SESSION_STATUS_LABELS[currentSession.status] : 'Boş'}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {currentSession ? (
            <button
              type="button"
              onClick={() => void selectSession(currentSession.id, table)}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Adisyonu Aç
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void openSession(table)}
              disabled={saving}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              Masa Aç
            </button>
          )}
        </div>
      </div>
    );
  }

  const selectedItems = selectedSession?.items || [];
  const selectedTotal = selectedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950">
        <div className="mx-auto max-w-7xl">
          <p className="text-lg font-black">Masa Servis yükleniyor...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-600">
                Restoran SaaS
              </p>
              <h1 className="mt-2 text-3xl font-black">Masa Servis / Adisyon V1</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">
                Salon, masa ve açık adisyon yönetimi. Bu ekran ilk V1 arayüzdür; Caller ID sonrasında daha da güçlendireceğiz.
              </p>
            </div>

            <nav className="flex flex-wrap gap-2">
              <Link className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100" href="/dashboard">
                Operasyon
              </Link>
              <Link className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100" href="/dashboard/caller-id">
                CALLER ID
              </Link>
              <Link className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400" href="/dashboard/table-service">
                Masa Servis
              </Link>
              <Link className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100" href="/dashboard/menu">
                Menü
              </Link>
              <Link className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100" href="/dashboard/orders/history">
                Geçmiş Siparişler
              </Link>
              <Link className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100" href="/dashboard/couriers">
                Kuryeler / Gün Sonu
              </Link>
            </nav>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Şube</p>
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-emerald-400"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Salon / Alan Ekle</p>
            <div className="mt-3 flex gap-2">
              <input
                value={areaName}
                onChange={(event) => setAreaName(event.target.value)}
                placeholder="Örn: Bahçe, Üst Kat"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              />
              <button
                type="button"
                onClick={() => void createArea()}
                disabled={saving}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                Ekle
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Açık Adisyon</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{openSessions.length}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Şu anda açık / ödeme bekleyen masa</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="flex-1">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Masa Adı</label>
              <input
                value={tableName}
                onChange={(event) => setTableName(event.target.value)}
                placeholder="Örn: Masa 1"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex-1">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Kod</label>
              <input
                value={tableCode}
                onChange={(event) => setTableCode(event.target.value)}
                placeholder="Boş kalırsa otomatik"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex-1">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Salon</label>
              <select
                value={tableAreaId}
                onChange={(event) => setTableAreaId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              >
                <option value="">Salonsuz</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full xl:w-36">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Kapasite</label>
              <input
                value={tableCapacity}
                onChange={(event) => setTableCapacity(event.target.value)}
                placeholder="4"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
              />
            </div>

            <button
              type="button"
              onClick={() => void createTable()}
              disabled={saving}
              className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              Masa Ekle
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_430px]">
          <div className="space-y-6">
            {areas.map((area) => {
              const areaTables = tables.filter((table) => table.diningAreaId === area.id);

              return (
                <section key={area.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Salon</p>
                      <h2 className="text-2xl font-black text-slate-950">{area.name}</h2>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">
                      {areaTables.length} masa
                    </span>
                  </div>

                  {areaTables.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-bold text-slate-500">
                      Bu salonda masa yok.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {areaTables.map((table) => renderTableCard(table))}
                    </div>
                  )}
                </section>
              );
            })}

            {unassignedTables.length > 0 ? (
              <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Diğer</p>
                  <h2 className="text-2xl font-black text-slate-950">Salonsuz Masalar</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {unassignedTables.map((table) => renderTableCard(table))}
                </div>
              </section>
            ) : null}

            {areas.length === 0 && tables.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <h2 className="text-2xl font-black text-slate-950">Henüz salon veya masa yok</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Önce salon ekleyip sonra masa oluşturabilirsin.
                </p>
              </div>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Adisyon</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {selectedTable ? selectedTable.name : 'Masa seçilmedi'}
                </h2>
                {selectedSession ? (
                  <p className="mt-1 text-sm font-black text-emerald-700">
                    {SESSION_STATUS_LABELS[selectedSession.status]}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-500">Masa kartından adisyon aç.</p>
                )}
              </div>

              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                <p className="text-xs font-black uppercase text-slate-400">Toplam</p>
                <p className="text-xl font-black text-slate-950">{formatMoney(selectedTotal)}</p>
              </div>
            </div>

            {selectedSession ? (
              <>
                <div className="mt-5 space-y-3">
                  {selectedItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                      Bu adisyonda ürün yok.
                    </div>
                  ) : (
                    selectedItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{item.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {item.quantity} x {formatMoney(item.unitPrice)}
                            </p>
                            {item.note ? (
                              <p className="mt-1 text-xs font-semibold text-slate-400">{item.note}</p>
                            ) : null}
                          </div>
                          <p className="font-black text-slate-950">{formatMoney(item.totalPrice)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-950">Ürün Ekle</p>
                  <div className="mt-3 grid gap-3">
                    <input
                      value={itemName}
                      onChange={(event) => setItemName(event.target.value)}
                      placeholder="Ürün adı"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={itemQuantity}
                        onChange={(event) => setItemQuantity(event.target.value)}
                        placeholder="Adet"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
                      />
                      <input
                        value={itemUnitPrice}
                        onChange={(event) => setItemUnitPrice(event.target.value)}
                        placeholder="Birim fiyat"
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
                      />
                    </div>

                    <input
                      value={itemNote}
                      onChange={(event) => setItemNote(event.target.value)}
                      placeholder="Not"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-400"
                    />

                    <button
                      type="button"
                      onClick={() => void addItem()}
                      disabled={saving}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      Adisyona Ekle
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => void setPaymentPending()}
                    disabled={saving}
                    className="rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
                  >
                    Ödeme Bekliyor
                  </button>
                  <button
                    type="button"
                    onClick={() => void closeSession()}
                    disabled={saving}
                    className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                  >
                    Adisyonu Kapat
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelSession()}
                    disabled={saving}
                    className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-60"
                  >
                    İptal Et
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                Sol taraftan bir masa aç veya açık adisyonu görüntüle.
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
