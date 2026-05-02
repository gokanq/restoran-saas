'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'ONLINE' | 'MEAL_CARD' | 'OPEN_ACCOUNT';

type RestaurantTable = {
  id: string;
  code?: string | null;
  name: string;
};

type TableSessionItemOption = {
  id: string;
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
  status?: string;
  options?: TableSessionItemOption[];
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

type MenuOption = {
  id: string;
  name: string;
  priceDelta?: string | number;
  isActive?: boolean;
};

type MenuOptionGroup = {
  id: string;
  name: string;
  isRequired?: boolean;
  minSelect?: number;
  maxSelect?: number;
  options?: MenuOption[];
};

type MenuItem = {
  id: string;
  branchId?: string | null;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: string | number;
  isActive?: boolean;
  optionGroups?: MenuOptionGroup[];
};

type MenuCategory = {
  id: string;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Nakit',
  CREDIT_CARD: 'Kredi Kartı',
  ONLINE: 'Online',
  MEAL_CARD: 'Yemek Kartı',
  OPEN_ACCOUNT: 'Açık Hesap',
};

const itemStatusLabels: Record<string, string> = {
  NEW: 'Yeni',
  SENT: 'Mutfağa Gönderildi',
  PREPARING: 'Hazırlanıyor',
  SERVED: 'Servis Edildi',
  VOID: 'İptal',
};

const moneyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});

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

function tableLabel(table?: RestaurantTable) {
  if (!table) return 'Masa';
  return table.code?.trim() || table.name;
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

export default function TableSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<TableSession | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string[]>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  async function loadSession() {
    const sessionData = await api<TableSession>(`/table-service/sessions/${sessionId}`);
    setSession(sessionData);
    return sessionData;
  }

  async function loadMenu(branchId: string) {
    const [categoryData, itemData] = await Promise.all([
      api<MenuCategory[]>(`/menu/categories?branchId=${encodeURIComponent(branchId)}`),
      api<MenuItem[]>(`/menu/items?branchId=${encodeURIComponent(branchId)}`),
    ]);

    setCategories(categoryData.filter((category) => category.isActive !== false));
    setMenuItems(itemData.filter((item) => item.isActive !== false));
  }

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      const sessionData = await loadSession();
      await loadMenu(sessionData.branchId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Adisyon yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }

    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const sessionTotal = useMemo(() => {
    return (session?.items || []).reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0);
  }, [session]);

  const filteredItems = useMemo(() => {
    return menuItems
      .filter((item) => selectedCategoryId === 'ALL' || item.categoryId === selectedCategoryId)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [menuItems, selectedCategoryId]);

  const selectedOptions = useMemo(() => {
    if (!selectedMenuItem?.optionGroups?.length) return [];

    return selectedMenuItem.optionGroups.flatMap((group) => {
      const selectedIds = selectedOptionIds[group.id] || [];

      return (group.options || [])
        .filter((option) => selectedIds.includes(option.id))
        .map((option) => ({
          optionId: option.id,
          groupName: group.name,
          optionName: option.name,
          priceDelta: Number(option.priceDelta ?? 0),
        }));
    });
  }, [selectedMenuItem, selectedOptionIds]);

  const selectedItemTotal = useMemo(() => {
    if (!selectedMenuItem) return 0;

    const optionTotal = selectedOptions.reduce((sum, option) => sum + Number(option.priceDelta ?? 0), 0);
    return (Number(selectedMenuItem.price ?? 0) + optionTotal) * quantity;
  }, [selectedMenuItem, selectedOptions, quantity]);

  function openItemModal(item: MenuItem) {
    setSelectedMenuItem(item);
    setQuantity(1);
    setNote('');
    setSelectedOptionIds({});
  }

  function closeItemModal() {
    setSelectedMenuItem(null);
    setQuantity(1);
    setNote('');
    setSelectedOptionIds({});
  }

  function toggleOption(group: MenuOptionGroup, option: MenuOption) {
    setSelectedOptionIds((current) => {
      const currentGroupSelection = current[group.id] || [];
      const isSelected = currentGroupSelection.includes(option.id);
      const maxSelect = Number(group.maxSelect ?? 1);

      let nextSelection: string[];

      if (isSelected) {
        nextSelection = currentGroupSelection.filter((optionId) => optionId !== option.id);
      } else if (maxSelect <= 1) {
        nextSelection = [option.id];
      } else {
        nextSelection = [...currentGroupSelection, option.id].slice(0, maxSelect);
      }

      return {
        ...current,
        [group.id]: nextSelection,
      };
    });
  }

  function validateRequiredOptions() {
    if (!selectedMenuItem?.optionGroups?.length) return true;

    for (const group of selectedMenuItem.optionGroups) {
      const minSelect = Number(group.minSelect ?? (group.isRequired ? 1 : 0));
      const selectedCount = (selectedOptionIds[group.id] || []).length;

      if (minSelect > 0 && selectedCount < minSelect) {
        setError(`${group.name} için seçim zorunludur`);
        return false;
      }
    }

    return true;
  }

  async function addItem() {
    if (!selectedMenuItem) return;
    if (!validateRequiredOptions()) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/sessions/${sessionId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: selectedMenuItem.id,
          name: selectedMenuItem.name,
          quantity,
          unitPrice: selectedMenuItem.price,
          note,
          options: selectedOptions,
        }),
      });

      setMessage('Ürün adisyona eklendi');
      closeItemModal();
      await loadSession();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Ürün eklenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function updateItemStatus(item: TableSessionItem, status: string) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/sessions/${sessionId}/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setMessage('Ürün durumu güncellendi');
      await loadSession();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Ürün güncellenemedi');
    } finally {
      setSaving(false);
    }
  }

  async function setPaymentPending() {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/sessions/${sessionId}/payment-pending`, {
        method: 'POST',
      });

      setMessage('Adisyon hesap bekliyor durumuna alındı');
      await loadSession();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'İşlem başarısız oldu');
    } finally {
      setSaving(false);
    }
  }

  async function closeSession() {
    if (!session?.items?.length) {
      setError('Boş adisyon kapatılamaz');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/sessions/${sessionId}/close`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod }),
      });

      setMessage('Adisyon kapatıldı ve geçmiş siparişlere aktarıldı');
      setTimeout(() => router.push('/dashboard/table-service'), 700);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Adisyon kapatılamadı');
    } finally {
      setSaving(false);
    }
  }

  async function cancelSession() {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await api(`/table-service/sessions/${sessionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Panel üzerinden iptal edildi' }),
      });

      setMessage('Adisyon iptal edildi');
      setTimeout(() => router.push('/dashboard/table-service'), 700);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Adisyon iptal edilemedi');
    } finally {
      setSaving(false);
    }
  }

  const isClosed = session?.status === 'CLOSED' || session?.status === 'CANCELLED';

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-600">Masa Servis</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                {tableLabel(session?.table)} Adisyon
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Açılış: {formatDate(session?.openedAt)} • Durum: {session?.status || '-'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/table-service"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Masa Servise Dön
              </Link>
              <Link
                href="/dashboard/orders/history"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Geçmiş Siparişler
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Ürün Sayısı</p>
              <p className="mt-2 text-3xl font-black">{session?.items?.length || 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Toplam</p>
              <p className="mt-2 text-3xl font-black">{formatMoney(sessionTotal)}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Ödeme</p>
              <p className="mt-2 text-3xl font-black">{paymentLabels[paymentMethod]}</p>
            </div>
          </div>
        </header>

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
            Adisyon yükleniyor...
          </div>
        ) : null}

        {!loading ? (
          <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black">Menü</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Opsiyonlu ve opsiyonsuz ürünleri adisyona ekleyebilirsin.
                    </p>
                  </div>

                  <select
                    value={selectedCategoryId}
                    onChange={(event) => setSelectedCategoryId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black outline-none focus:border-emerald-400"
                  >
                    <option value="ALL">Tüm Kategoriler</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black">{item.name}</h3>
                          {item.description ? (
                            <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{item.description}</p>
                          ) : null}
                        </div>
                        <p className="whitespace-nowrap text-lg font-black text-emerald-700">
                          {formatMoney(item.price)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openItemModal(item)}
                        disabled={saving || isClosed}
                        className="mt-5 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Ürün Ekle
                      </button>
                    </article>
                  ))}

                  {filteredItems.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500 md:col-span-2 2xl:col-span-3">
                      Bu kategoride ürün yok.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Adisyon</h2>

                <div className="mt-5 space-y-3">
                  {(session?.items || []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{item.quantity} x {item.name}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500">
                            {itemStatusLabels[item.status || 'NEW'] || item.status}
                          </p>
                        </div>
                        <p className="font-black">{formatMoney(item.totalPrice)}</p>
                      </div>

                      {item.options?.length ? (
                        <div className="mt-3 space-y-1 rounded-xl bg-white p-3">
                          {item.options.map((option) => (
                            <p key={option.id} className="text-xs font-bold text-slate-500">
                              {option.groupName}: {option.optionName}
                              {Number(option.priceDelta || 0) > 0 ? ` +${formatMoney(option.priceDelta)}` : ''}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {!isClosed ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void updateItemStatus(item, 'SERVED')}
                            className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                          >
                            Servis Edildi
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateItemStatus(item, 'VOID')}
                            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                          >
                            İptal
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!session?.items?.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                      Adisyonda ürün yok.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Hesap Al</h2>

                <div className="mt-5 space-y-3">
                  {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`w-full rounded-2xl border px-5 py-4 text-left text-sm font-black transition ${
                        paymentMethod === method
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {paymentLabels[method]}
                    </button>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-slate-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Ödenecek Tutar</p>
                  <p className="mt-2 text-3xl font-black">{formatMoney(sessionTotal)}</p>
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => void setPaymentPending()}
                    disabled={saving || isClosed}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                  >
                    Hesap Bekliyor
                  </button>

                  <button
                    type="button"
                    onClick={() => void closeSession()}
                    disabled={saving || isClosed}
                    className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    Hesabı Kapat / Geçmişe Aktar
                  </button>

                  <button
                    type="button"
                    onClick={() => void cancelSession()}
                    disabled={saving || isClosed}
                    className="rounded-2xl bg-red-50 px-5 py-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    Adisyonu İptal Et
                  </button>
                </div>
              </div>
            </aside>
          </section>
        ) : null}
      </div>

      {selectedMenuItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Ürün Ekle</p>
                <h2 className="mt-1 text-2xl font-black">{selectedMenuItem.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{formatMoney(selectedMenuItem.price)}</p>
              </div>

              <button
                type="button"
                onClick={closeItemModal}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-black text-slate-700">Adet</label>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="h-12 w-12 rounded-2xl border border-slate-200 text-xl font-black"
                  >
                    -
                  </button>
                  <input
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
                    type="number"
                    min={1}
                    className="h-12 w-24 rounded-2xl border border-slate-200 text-center text-lg font-black outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((current) => current + 1)}
                    className="h-12 w-12 rounded-2xl border border-slate-200 text-xl font-black"
                  >
                    +
                  </button>
                </div>
              </div>

              {selectedMenuItem.optionGroups?.map((group) => (
                <div key={group.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black">{group.name}</h3>
                      <p className="text-xs font-bold text-slate-500">
                        {group.isRequired ? 'Zorunlu seçim' : 'Opsiyonel'} • En fazla {group.maxSelect ?? 1}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(group.options || [])
                      .filter((option) => option.isActive !== false)
                      .map((option) => {
                        const selected = (selectedOptionIds[group.id] || []).includes(option.id);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleOption(group, option)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                              selected
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {option.name}
                            {Number(option.priceDelta || 0) > 0 ? (
                              <span className="ml-2 text-emerald-700">+{formatMoney(option.priceDelta)}</span>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ürün notu"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
              />

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Ürün Toplamı</p>
                <p className="mt-2 text-3xl font-black">{formatMoney(selectedItemTotal)}</p>
              </div>

              <button
                type="button"
                onClick={() => void addItem()}
                disabled={saving}
                className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                Adisyona Ekle
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
