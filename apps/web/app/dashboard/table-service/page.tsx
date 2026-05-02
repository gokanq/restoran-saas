'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

type Branch = {
  id: string;
  name: string;
};

type DiningArea = {
  id: string;
  branchId: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

type RestaurantTable = {
  id: string;
  branchId: string;
  diningAreaId?: string | null;
  code?: string;
  name: string;
  capacity?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  diningArea?: DiningArea | null;
};

type TableSessionStatus = 'OPEN' | 'PAYMENT_PENDING' | 'CLOSED' | 'CANCELLED';

type TableSession = {
  id: string;
  branchId: string;
  tableId: string;
  status: TableSessionStatus;
  openedAt?: string;
  table?: RestaurantTable;
};

type AreaForm = {
  name: string;
  sortOrder: string;
};

type TableForm = {
  diningAreaId: string;
  name: string;
  code: string;
  capacity: string;
  sortOrder: string;
};

function getStoredToken() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('restaurant_saas_token') ||
    ''
  );
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Beklenmeyen bir hata oluştu';
}

function money(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(value);
}

function buildCodeFromName(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9ÇĞİÖŞÜ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

async function apiRequest<T>(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || data?.error || `İşlem başarısız: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export default function TableServicePage() {
  const router = useRouter();

  const [token, setToken] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [activeTab, setActiveTab] = useState<'tables' | 'settings'>('tables');
  const [areaFilter, setAreaFilter] = useState('ALL');

  const [areaForm, setAreaForm] = useState<AreaForm>({ name: '', sortOrder: '0' });
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);

  const [tableForm, setTableForm] = useState<TableForm>({
    diningAreaId: '',
    name: '',
    code: '',
    capacity: '',
    sortOrder: '0',
  });
  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedBranch = branches.find((branch) => branch.id === branchId) || null;

  const openSessionByTableId = useMemo(() => {
    const map = new Map<string, TableSession>();
    sessions.forEach((session) => {
      if (session.status === 'OPEN' || session.status === 'PAYMENT_PENDING') {
        map.set(session.tableId, session);
      }
    });
    return map;
  }, [sessions]);

  const filteredTables = useMemo(() => {
    const sorted = [...tables].sort((a, b) => {
      const orderA = Number(a.sortOrder ?? 0);
      const orderB = Number(b.sortOrder ?? 0);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'tr');
    });

    if (areaFilter === 'ALL') return sorted;
    if (areaFilter === 'NONE') return sorted.filter((table) => !table.diningAreaId);
    return sorted.filter((table) => table.diningAreaId === areaFilter);
  }, [areaFilter, tables]);

  async function loadBranches(currentToken: string) {
    const data = await apiRequest<Branch[]>('/branches', currentToken);
    setBranches(Array.isArray(data) ? data : []);

    if (Array.isArray(data) && data.length > 0) {
      setBranchId((current) => current || data[0].id);
    }
  }

  async function loadTableServiceData(currentToken: string, currentBranchId: string) {
    if (!currentBranchId) return;

    const [areasData, tablesData, sessionsData] = await Promise.all([
      apiRequest<DiningArea[]>(
        `/table-service/dining-areas?branchId=${encodeURIComponent(currentBranchId)}`,
        currentToken,
      ),
      apiRequest<RestaurantTable[]>(
        `/table-service/tables?branchId=${encodeURIComponent(currentBranchId)}`,
        currentToken,
      ),
      apiRequest<TableSession[]>(
        `/table-service/sessions/open?branchId=${encodeURIComponent(currentBranchId)}`,
        currentToken,
      ),
    ]);

    setAreas(Array.isArray(areasData) ? areasData : []);
    setTables(Array.isArray(tablesData) ? tablesData : []);
    setSessions(Array.isArray(sessionsData) ? sessionsData : []);
  }

  async function refreshData() {
    if (!token || !branchId) return;
    setError('');
    await loadTableServiceData(token, branchId);
  }

  useEffect(() => {
    const storedToken = getStoredToken();
    setToken(storedToken);

    if (!storedToken) {
      setLoading(false);
      setError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    loadBranches(storedToken)
      .catch((err) => setError(normalizeError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!token || !branchId) return;

    setLoading(true);
    setError('');
    loadTableServiceData(token, branchId)
      .catch((err) => setError(normalizeError(err)))
      .finally(() => setLoading(false));
  }, [branchId, token]);

  function resetAreaForm() {
    setEditingAreaId(null);
    setAreaForm({ name: '', sortOrder: '0' });
  }

  function resetTableForm() {
    setEditingTableId(null);
    setTableForm({
      diningAreaId: '',
      name: '',
      code: '',
      capacity: '',
      sortOrder: '0',
    });
  }

  function startAreaEdit(area: DiningArea) {
    setActiveTab('settings');
    setEditingAreaId(area.id);
    setAreaForm({
      name: area.name,
      sortOrder: String(area.sortOrder ?? 0),
    });
  }

  function startTableEdit(table: RestaurantTable) {
    setActiveTab('settings');
    setEditingTableId(table.id);
    setTableForm({
      diningAreaId: table.diningAreaId || '',
      name: table.name,
      code: table.code || '',
      capacity: table.capacity === null || table.capacity === undefined ? '' : String(table.capacity),
      sortOrder: String(table.sortOrder ?? 0),
    });
  }

  async function saveArea() {
    if (!token || !branchId) return;

    const name = areaForm.name.trim();
    if (!name) {
      setError('Salon / alan adı zorunludur.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        branchId,
        name,
        sortOrder: Number(areaForm.sortOrder || 0),
      };

      if (editingAreaId) {
        await apiRequest(`/table-service/dining-areas/${editingAreaId}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            name: payload.name,
            sortOrder: payload.sortOrder,
            isActive: true,
          }),
        });
        setSuccess('Salon / alan güncellendi.');
      } else {
        await apiRequest('/table-service/dining-areas', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Yeni salon / alan eklendi.');
      }

      resetAreaForm();
      await refreshData();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteArea(area: DiningArea) {
    if (!token) return;

    const hasTable = tables.some((table) => table.diningAreaId === area.id);
    const confirmed = window.confirm(
      hasTable
        ? `${area.name} alanında masa var. Alan pasife alınacak, masalar korunacak. Devam edilsin mi?`
        : `${area.name} pasife alınsın mı?`,
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/dining-areas/${area.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });

      if (editingAreaId === area.id) resetAreaForm();
      setSuccess('Salon / alan pasife alındı.');
      await refreshData();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveTable() {
    if (!token || !branchId) return;

    const name = tableForm.name.trim();
    if (!name) {
      setError('Masa adı zorunludur.');
      return;
    }

    const capacity =
      tableForm.capacity.trim() === '' ? null : Math.max(1, Number(tableForm.capacity || 1));

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const code = tableForm.code.trim() || buildCodeFromName(name);

      const payload = {
        branchId,
        diningAreaId: tableForm.diningAreaId || null,
        name,
        code,
        capacity,
        sortOrder: Number(tableForm.sortOrder || 0),
      };

      if (editingTableId) {
        await apiRequest(`/table-service/tables/${editingTableId}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            diningAreaId: payload.diningAreaId,
            name: payload.name,
            code: payload.code,
            capacity: payload.capacity,
            sortOrder: payload.sortOrder,
            isActive: true,
          }),
        });
        setSuccess('Masa güncellendi.');
      } else {
        await apiRequest('/table-service/tables', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Yeni masa eklendi.');
      }

      resetTableForm();
      await refreshData();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable(table: RestaurantTable) {
    if (!token) return;

    const session = openSessionByTableId.get(table.id);
    if (session) {
      setError('Bu masada açık adisyon var. Önce adisyonu kapatın veya iptal edin.');
      return;
    }

    const confirmed = window.confirm(`${table.name} pasife alınsın mı?`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/tables/${table.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });

      if (editingTableId === table.id) resetTableForm();
      setSuccess('Masa pasife alındı.');
      await refreshData();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenOrGo(table: RestaurantTable) {
    if (!token || !branchId) return;

    const existingSession = openSessionByTableId.get(table.id);
    if (existingSession) {
      router.push(`/dashboard/table-service/sessions/${existingSession.id}`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const session = await apiRequest<TableSession>('/table-service/sessions/open', token, {
        method: 'POST',
        body: JSON.stringify({
          branchId,
          tableId: table.id,
        }),
      });

      router.push(`/dashboard/table-service/sessions/${session.id}`);
    } catch (err) {
      setError(normalizeError(err));
      await refreshData();
    } finally {
      setSaving(false);
    }
  }

  function sessionBadge(table: RestaurantTable) {
    const session = openSessionByTableId.get(table.id);

    if (!session) {
      return (
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
          Boş
        </span>
      );
    }

    if (session.status === 'PAYMENT_PENDING') {
      return (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
          Ödeme Bekliyor
        </span>
      );
    }

    return (
      <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700 ring-1 ring-sky-200">
        Açık Adisyon
      </span>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-600">
                Restoran SaaS
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Masa Servis</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                Salon, masa ve adisyon operasyonlarını tek yerden yönetin. Masa açıldığında
                adisyon artık ayrı ekranda çalışır.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Operasyona Dön
              </button>
              <button
                type="button"
                onClick={refreshData}
                disabled={saving || loading}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yenile
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-black text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-black text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('tables')}
                className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                  activeTab === 'tables'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Masalar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                  activeTab === 'settings'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Ayarlar
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Şube
              </span>
              <select
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setAreaFilter('ALL');
                  resetAreaForm();
                  resetTableForm();
                }}
                className="min-w-[240px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none transition focus:border-emerald-400 focus:bg-white"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm font-black text-slate-500 shadow-sm">
            Masa servis yükleniyor...
          </section>
        ) : null}

        {!loading && activeTab === 'tables' ? (
          <section className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Masa Planı</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {selectedBranch ? selectedBranch.name : 'Şube seçilmedi'} için aktif masalar.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaFilter('ALL')}
                    className={`rounded-full px-4 py-2 text-xs font-black transition ${
                      areaFilter === 'ALL'
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tümü
                  </button>
                  {areas.map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setAreaFilter(area.id)}
                      className={`rounded-full px-4 py-2 text-xs font-black transition ${
                        areaFilter === area.id
                          ? 'bg-slate-950 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {area.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAreaFilter('NONE')}
                    className={`rounded-full px-4 py-2 text-xs font-black transition ${
                      areaFilter === 'NONE'
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Alansız
                  </button>
                </div>
              </div>
            </div>

            {filteredTables.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <p className="text-lg font-black">Henüz masa yok.</p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Ayarlar bölümünden salon ve masa ekleyebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="mt-5 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
                >
                  Ayarlara Git
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filteredTables.map((table) => {
                  const session = openSessionByTableId.get(table.id);
                  const area = areas.find((item) => item.id === table.diningAreaId);

                  return (
                    <article
                      key={table.id}
                      className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                            {area?.name || 'Alansız'}
                          </p>
                          <h3 className="mt-2 text-2xl font-black">{table.name}</h3>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            Kod: {table.code || '-'} • Kapasite:{' '}
                            {table.capacity === null || table.capacity === undefined
                              ? '-'
                              : table.capacity}
                          </p>
                        </div>
                        {sessionBadge(table)}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleOpenOrGo(table)}
                          disabled={saving}
                          className={`rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            session
                              ? 'bg-sky-500 text-white hover:bg-sky-400'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          }`}
                        >
                          {session ? 'Adisyona Git' : 'Masa Aç'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startTableEdit(table)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                        >
                          Düzenle
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {!loading && activeTab === 'settings' ? (
          <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <div className="space-y-5">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Salon / Alan</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Salon, bahçe, teras gibi servis alanları.
                    </p>
                  </div>
                  {editingAreaId ? (
                    <button
                      type="button"
                      onClick={resetAreaForm}
                      className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                    >
                      Vazgeç
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  <input
                    value={areaForm.name}
                    onChange={(event) =>
                      setAreaForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Salon adı örn. Ana Salon"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                  />

                  <input
                    value={areaForm.sortOrder}
                    onChange={(event) =>
                      setAreaForm((current) => ({ ...current, sortOrder: event.target.value }))
                    }
                    type="number"
                    placeholder="Sıra"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                  />

                  <button
                    type="button"
                    onClick={() => void saveArea()}
                    disabled={saving}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingAreaId ? 'Salonu Güncelle' : 'Salon Ekle'}
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Masa</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Masa kodu şube içinde benzersiz olmalı.
                    </p>
                  </div>
                  {editingTableId ? (
                    <button
                      type="button"
                      onClick={resetTableForm}
                      className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                    >
                      Vazgeç
                    </button>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  <select
                    value={tableForm.diningAreaId}
                    onChange={(event) =>
                      setTableForm((current) => ({
                        ...current,
                        diningAreaId: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                  >
                    <option value="">Alan seçilmedi</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>

                  <input
                    value={tableForm.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setTableForm((current) => ({
                        ...current,
                        name,
                        code: current.code || buildCodeFromName(name),
                      }));
                    }}
                    placeholder="Masa adı örn. B1"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                  />

                  <input
                    value={tableForm.code}
                    onChange={(event) =>
                      setTableForm((current) => ({
                        ...current,
                        code: buildCodeFromName(event.target.value),
                      }))
                    }
                    placeholder="Masa kodu örn. B1"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold uppercase outline-none transition focus:border-emerald-400 focus:bg-white"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={tableForm.capacity}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          capacity: event.target.value,
                        }))
                      }
                      type="number"
                      min="1"
                      placeholder="Kapasite"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                    />

                    <input
                      value={tableForm.sortOrder}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                      type="number"
                      placeholder="Sıra"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveTable()}
                    disabled={saving}
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editingTableId ? 'Masayı Güncelle' : 'Masa Ekle'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Salon Listesi</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Aktif salonlar / alanlar.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
                    {areas.length} alan
                  </span>
                </div>

                <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                  {areas.length === 0 ? (
                    <div className="p-5 text-sm font-bold text-slate-500">Salon bulunamadı.</div>
                  ) : (
                    areas.map((area) => (
                      <div
                        key={area.id}
                        className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-base font-black">{area.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            Sıra: {area.sortOrder ?? 0}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startAreaEdit(area)}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteArea(area)}
                            disabled={saving}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Pasife Al
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black">Masa Listesi</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Masa düzenleme ve pasife alma.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
                    {tables.length} masa
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
                  {tables.length === 0 ? (
                    <div className="p-5 text-sm font-bold text-slate-500">Masa bulunamadı.</div>
                  ) : (
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        <tr>
                          <th className="px-4 py-4">Masa</th>
                          <th className="px-4 py-4">Kod</th>
                          <th className="px-4 py-4">Alan</th>
                          <th className="px-4 py-4">Kapasite</th>
                          <th className="px-4 py-4">Durum</th>
                          <th className="px-4 py-4">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tables.map((table) => {
                          const area = areas.find((item) => item.id === table.diningAreaId);
                          const session = openSessionByTableId.get(table.id);

                          return (
                            <tr key={table.id} className="border-t border-slate-100">
                              <td className="px-4 py-4 font-black">{table.name}</td>
                              <td className="px-4 py-4 font-bold text-slate-500">
                                {table.code || '-'}
                              </td>
                              <td className="px-4 py-4 font-bold text-slate-500">
                                {area?.name || 'Alansız'}
                              </td>
                              <td className="px-4 py-4 font-bold text-slate-500">
                                {table.capacity ?? '-'}
                              </td>
                              <td className="px-4 py-4">{sessionBadge(table)}</td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startTableEdit(table)}
                                    className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                                  >
                                    Düzenle
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteTable(table)}
                                    disabled={saving || Boolean(session)}
                                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    Pasife Al
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="rounded-[2rem] border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 shadow-sm">
          Toplam açık adisyon: <span className="font-black text-slate-950">{sessions.length}</span>{' '}
          • Tahmini masa cirosu bu ekranda sonraki rapor adımında eklenecek. Örnek toplam formatı:{' '}
          <span className="font-black text-slate-950">{money(0)}</span>
        </footer>
      </div>
    </main>
  );
}
