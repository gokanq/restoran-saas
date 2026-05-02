'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

type TableSessionStatus = 'OPEN' | 'PAYMENT_PENDING' | 'CLOSED' | 'CANCELLED';
type TableSessionItemStatus = 'NEW' | 'SENT' | 'PREPARING' | 'SERVED' | 'VOID';

type RestaurantTable = {
  id: string;
  name: string;
  code?: string;
};

type TableSessionItemOption = {
  id?: string;
  groupName: string;
  optionName: string;
  priceDelta: string | number;
};

type TableSessionItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  note?: string | null;
  status?: TableSessionItemStatus;
  options?: TableSessionItemOption[];
};

type TableSession = {
  id: string;
  branchId: string;
  tableId: string;
  status: TableSessionStatus;
  openedAt?: string;
  closedAt?: string | null;
  table?: RestaurantTable;
  items?: TableSessionItem[];
};

type MenuCategory = {
  id: string;
  name: string;
  sortOrder?: number;
};

type MenuItemOption = {
  id: string;
  name: string;
  priceDelta?: string | number;
  sortOrder?: number;
  isActive?: boolean;
};

type MenuItemOptionGroup = {
  id: string;
  name: string;
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
  isActive?: boolean;
  options?: MenuItemOption[];
};

type MenuItem = {
  id: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: string | number;
  isActive?: boolean;
  optionGroups?: MenuItemOptionGroup[];
};

type SelectedOptionMap = Record<string, string[]>;

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

function asNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(asNumber(value));
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

function statusLabel(status: TableSessionStatus) {
  switch (status) {
    case 'OPEN':
      return 'Açık';
    case 'PAYMENT_PENDING':
      return 'Ödeme Bekliyor';
    case 'CLOSED':
      return 'Kapalı';
    case 'CANCELLED':
      return 'İptal';
    default:
      return status;
  }
}

export default function TableSessionPage() {
  const router = useRouter();
  const params = useParams();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId || '';

  const [token, setToken] = useState('');
  const [session, setSession] = useState<TableSession | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [search, setSearch] = useState('');

  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptionMap>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [customNote, setCustomNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sessionItems = session?.items || [];

  const total = useMemo(() => {
    return sessionItems.reduce((sum, item) => sum + asNumber(item.totalPrice), 0);
  }, [sessionItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');

    return items
      .filter((item) => item.isActive !== false)
      .filter((item) => activeCategoryId === 'ALL' || item.categoryId === activeCategoryId)
      .filter((item) => {
        if (!term) return true;
        return item.name.toLocaleLowerCase('tr-TR').includes(term);
      });
  }, [activeCategoryId, items, search]);

  const selectedOptionObjects = useMemo(() => {
    if (!selectedMenuItem?.optionGroups) return [];

    return selectedMenuItem.optionGroups.flatMap((group) => {
      const ids = selectedOptions[group.id] || [];
      return (group.options || [])
        .filter((option) => ids.includes(option.id))
        .map((option) => ({
          groupName: group.name,
          optionName: option.name,
          priceDelta: asNumber(option.priceDelta),
        }));
    });
  }, [selectedMenuItem, selectedOptions]);

  const selectedUnitPrice = useMemo(() => {
    if (!selectedMenuItem) return 0;
    const optionTotal = selectedOptionObjects.reduce(
      (sum, option) => sum + asNumber(option.priceDelta),
      0,
    );
    return asNumber(selectedMenuItem.price) + optionTotal;
  }, [selectedMenuItem, selectedOptionObjects]);

  async function loadAll(currentToken: string) {
    if (!sessionId) return;

    const currentSession = await apiRequest<TableSession>(
      `/table-service/sessions/${sessionId}`,
      currentToken,
    );

    const [categoryData, itemData] = await Promise.all([
      apiRequest<MenuCategory[]>('/menu/categories', currentToken),
      apiRequest<MenuItem[]>('/menu/items', currentToken),
    ]);

    setSession(currentSession);
    setCategories(Array.isArray(categoryData) ? categoryData : []);
    setItems(Array.isArray(itemData) ? itemData : []);
  }

  async function refreshSession() {
    if (!token || !sessionId) return;
    const currentSession = await apiRequest<TableSession>(
      `/table-service/sessions/${sessionId}`,
      token,
    );
    setSession(currentSession);
  }

  useEffect(() => {
    const storedToken = getStoredToken();
    setToken(storedToken);

    if (!storedToken) {
      setLoading(false);
      setError('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }

    loadAll(storedToken)
      .catch((err) => setError(normalizeError(err)))
      .finally(() => setLoading(false));
  }, [sessionId]);

  function openOptionModal(item: MenuItem) {
    setSelectedMenuItem(item);
    setQuantity(1);
    setNote('');

    const initial: SelectedOptionMap = {};
    (item.optionGroups || []).forEach((group) => {
      initial[group.id] = [];
    });
    setSelectedOptions(initial);
  }

  function closeOptionModal() {
    setSelectedMenuItem(null);
    setSelectedOptions({});
    setQuantity(1);
    setNote('');
  }

  function toggleOption(group: MenuItemOptionGroup, option: MenuItemOption) {
    setSelectedOptions((current) => {
      const currentIds = current[group.id] || [];
      const exists = currentIds.includes(option.id);
      const maxSelect = Number(group.maxSelect ?? 1);

      if (exists) {
        return {
          ...current,
          [group.id]: currentIds.filter((id) => id !== option.id),
        };
      }

      if (maxSelect <= 1) {
        return {
          ...current,
          [group.id]: [option.id],
        };
      }

      return {
        ...current,
        [group.id]: [...currentIds, option.id].slice(0, maxSelect),
      };
    });
  }

  function validateSelectedOptions(item: MenuItem) {
    const groups = item.optionGroups || [];

    for (const group of groups) {
      const selectedCount = selectedOptions[group.id]?.length || 0;
      const minSelect = Number(group.minSelect ?? (group.isRequired ? 1 : 0));

      if (minSelect > 0 && selectedCount < minSelect) {
        throw new Error(`${group.name} için en az ${minSelect} seçim yapmalısınız.`);
      }
    }
  }

  async function addMenuItem(item: MenuItem, selectedQuantity = 1, selectedNote = '') {
    if (!token || !session) return;

    const hasOptions = (item.optionGroups || []).some(
      (group) => group.isActive !== false && (group.options || []).some((option) => option.isActive !== false),
    );

    if (hasOptions && selectedMenuItem?.id !== item.id) {
      openOptionModal(item);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      validateSelectedOptions(item);

      const optionSuffix = selectedOptionObjects.length
        ? ` (${selectedOptionObjects.map((option) => option.optionName).join(', ')})`
        : '';

      await apiRequest(`/table-service/sessions/${session.id}/items`, token, {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: item.id,
          name: `${item.name}${optionSuffix}`,
          quantity: selectedQuantity,
          unitPrice: selectedUnitPrice || asNumber(item.price),
          note: selectedNote.trim() || undefined,
        }),
      });

      setSuccess('Ürün adisyona eklendi.');
      closeOptionModal();
      await refreshSession();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function addCustomItem() {
    if (!token || !session) return;

    const name = customName.trim();
    const price = asNumber(customPrice);
    const selectedQuantity = Number(customQuantity || 1);

    if (!name) {
      setError('Ürün adı zorunludur.');
      return;
    }

    if (!Number.isInteger(selectedQuantity) || selectedQuantity <= 0) {
      setError('Adet pozitif tam sayı olmalıdır.');
      return;
    }

    if (price < 0) {
      setError('Birim fiyat negatif olamaz.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/sessions/${session.id}/items`, token, {
        method: 'POST',
        body: JSON.stringify({
          name,
          quantity: selectedQuantity,
          unitPrice: price,
          note: customNote.trim() || undefined,
        }),
      });

      setCustomName('');
      setCustomPrice('');
      setCustomQuantity('1');
      setCustomNote('');
      setSuccess('Menü dışı ürün adisyona eklendi.');
      await refreshSession();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateItemStatus(item: TableSessionItem, status: TableSessionItemStatus) {
    if (!token || !session) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/sessions/${session.id}/items/${item.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setSuccess(status === 'VOID' ? 'Ürün iptal edildi.' : 'Ürün durumu güncellendi.');
      await refreshSession();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function setPaymentPending() {
    if (!token || !session) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/sessions/${session.id}/payment-pending`, token, {
        method: 'POST',
      });

      setSuccess('Adisyon ödeme bekliyor durumuna alındı.');
      await refreshSession();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function closeSession() {
    if (!token || !session) return;
    const confirmed = window.confirm('Adisyon kapatılsın mı?');
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/sessions/${session.id}/close`, token, {
        method: 'POST',
      });

      router.push('/dashboard/table-service');
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function cancelSession() {
    if (!token || !session) return;
    const reason = window.prompt('İptal nedeni yazabilirsiniz:', '');
    const confirmed = window.confirm('Adisyon iptal edilsin mi?');
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/table-service/sessions/${session.id}/cancel`, token, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason || undefined,
        }),
      });

      router.push('/dashboard/table-service');
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-600">
                Masa Adisyonu
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {session?.table?.name || 'Adisyon'}
              </h1>
              <p className="mt-2 text-sm font-bold text-slate-500">
                Durum: {session ? statusLabel(session.status) : '-'} • Toplam:{' '}
                <span className="font-black text-slate-950">{money(total)}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard/table-service')}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Masa Servise Dön
              </button>
              <button
                type="button"
                onClick={() => void refreshSession()}
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

        {loading ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm font-black text-slate-500 shadow-sm">
            Adisyon yükleniyor...
          </section>
        ) : null}

        {!loading && session ? (
          <section className="grid gap-5 xl:grid-cols-[430px_1fr]">
            <aside className="space-y-5">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      Adisyon
                    </p>
                    <h2 className="mt-2 text-2xl font-black">{session.table?.name || '-'}</h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      {statusLabel(session.status)}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-100 px-5 py-4 text-right">
                    <p className="text-xs font-black uppercase text-slate-400">Toplam</p>
                    <p className="mt-1 text-xl font-black">{money(total)}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {sessionItems.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                      Bu adisyonda ürün yok.
                    </div>
                  ) : (
                    sessionItems.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-3xl border p-4 ${
                          item.status === 'VOID'
                            ? 'border-red-100 bg-red-50 opacity-70'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{item.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {item.quantity} x {money(item.unitPrice)}
                            </p>
                            {item.note ? (
                              <p className="mt-2 text-xs font-bold text-slate-400">
                                Not: {item.note}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="font-black">{money(item.totalPrice)}</p>
                            <p className="mt-1 text-xs font-black text-slate-400">
                              {item.status || 'NEW'}
                            </p>
                          </div>
                        </div>

                        {item.status !== 'VOID' ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void updateItemStatus(item, 'SERVED')}
                              disabled={saving}
                              className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-200 disabled:opacity-50"
                            >
                              Servis Edildi
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateItemStatus(item, 'VOID')}
                              disabled={saving}
                              className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-200 disabled:opacity-50"
                            >
                              İptal
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black">Hızlı Menü Dışı Ürün</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Menüde olmayan özel kalemler için.
                </p>

                <div className="mt-4 space-y-3">
                  <input
                    value={customName}
                    onChange={(event) => setCustomName(event.target.value)}
                    placeholder="Ürün adı"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={customQuantity}
                      onChange={(event) => setCustomQuantity(event.target.value)}
                      type="number"
                      min="1"
                      placeholder="Adet"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                    />
                    <input
                      value={customPrice}
                      onChange={(event) => setCustomPrice(event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Birim fiyat"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                    />
                  </div>

                  <input
                    value={customNote}
                    onChange={(event) => setCustomNote(event.target.value)}
                    placeholder="Not"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                  />

                  <button
                    type="button"
                    onClick={() => void addCustomItem()}
                    disabled={saving || session.status === 'CLOSED' || session.status === 'CANCELLED'}
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Adisyona Ekle
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => void setPaymentPending()}
                    disabled={saving || session.status === 'CLOSED' || session.status === 'CANCELLED'}
                    className="rounded-2xl bg-amber-400 px-4 py-4 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ödeme Bekliyor
                  </button>
                  <button
                    type="button"
                    onClick={() => void closeSession()}
                    disabled={saving || session.status === 'CLOSED' || session.status === 'CANCELLED'}
                    className="rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Adisyonu Kapat
                  </button>
                  <button
                    type="button"
                    onClick={() => void cancelSession()}
                    disabled={saving || session.status === 'CLOSED' || session.status === 'CANCELLED'}
                    className="rounded-2xl bg-red-500 px-4 py-4 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    İptal Et
                  </button>
                </div>
              </div>
            </aside>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Menüden Ürün Ekle</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Opsiyonsuz ürünler direkt eklenir. Opsiyonlu ürünlerde seçim kartı açılır.
                  </p>
                </div>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ürün ara"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white lg:w-72"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategoryId('ALL')}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    activeCategoryId === 'ALL'
                      ? 'bg-slate-950 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tümü
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategoryId(category.id)}
                    className={`rounded-full px-4 py-2 text-xs font-black transition ${
                      activeCategoryId === category.id
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500">
                    Ürün bulunamadı.
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const hasOptions = (item.optionGroups || []).some(
                      (group) =>
                        group.isActive !== false &&
                        (group.options || []).some((option) => option.isActive !== false),
                    );

                    return (
                      <article
                        key={item.id}
                        className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black">{item.name}</h3>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-500">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          {hasOptions ? (
                            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700 ring-1 ring-violet-200">
                              Opsiyonlu
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                              Hızlı
                            </span>
                          )}
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                          <p className="text-xl font-black">{money(item.price)}</p>
                          <button
                            type="button"
                            onClick={() => void addMenuItem(item)}
                            disabled={
                              saving ||
                              session.status === 'CLOSED' ||
                              session.status === 'CANCELLED'
                            }
                            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Ekle
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </section>
        ) : null}
      </div>

      {selectedMenuItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
                  Opsiyon Seçimi
                </p>
                <h2 className="mt-2 text-2xl font-black">{selectedMenuItem.name}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Birim fiyat: {money(selectedUnitPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeOptionModal}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {(selectedMenuItem.optionGroups || [])
                .filter((group) => group.isActive !== false)
                .map((group) => (
                  <div key={group.id} className="rounded-3xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-black">{group.name}</h3>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          Min: {group.minSelect ?? (group.isRequired ? 1 : 0)} • Max:{' '}
                          {group.maxSelect ?? 1}
                        </p>
                      </div>
                      {group.isRequired ? (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 ring-1 ring-red-200">
                          Zorunlu
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {(group.options || [])
                        .filter((option) => option.isActive !== false)
                        .map((option) => {
                          const selected = (selectedOptions[group.id] || []).includes(option.id);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleOption(group, option)}
                              className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                                selected
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span>{option.name}</span>
                              <span className="float-right text-xs text-slate-500">
                                {asNumber(option.priceDelta) > 0
                                  ? `+ ${money(option.priceDelta)}`
                                  : ''}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}

              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <input
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
                  type="number"
                  min="1"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                />
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ürün notu"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-400 focus:bg-white"
                />
              </div>

              <button
                type="button"
                onClick={() => void addMenuItem(selectedMenuItem, quantity, note)}
                disabled={saving}
                className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Adisyona Ekle • {money(selectedUnitPrice * quantity)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
