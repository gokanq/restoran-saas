'use client';

import { useEffect, useMemo, useState } from 'react';

type MenuItemOption = {
  id: string;
  name: string;
  priceDelta: string | number;
  sortOrder?: number;
  isActive?: boolean;
};

type MenuItemOptionGroup = {
  id: string;
  menuItemId?: string;
  menuItem?: {
    id: string;
    name: string;
  } | null;
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
  name: string;
  description?: string | null;
  price: string | number;
  category?: {
    id: string;
    name: string;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  optionGroups?: MenuItemOptionGroup[];
};

function toNumber(value: string | number) {
  const parsedValue = Number(String(value).replace(',', '.'));

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(toNumber(value));
}

function uniqueOptionGroups(groups: MenuItemOptionGroup[]) {
  const seen = new Set<string>();

  return groups.filter((group) => {
    const key =
      group.id ||
      `${group.menuItem?.id || group.menuItemId || ''}:${group.name.trim().toLocaleLowerCase('tr-TR')}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export default function DashboardOptionsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [optionGroups, setOptionGroups] = useState<MenuItemOptionGroup[]>([]);

  const [groupName, setGroupName] = useState('Ekstra Malzeme');
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMinSelect, setGroupMinSelect] = useState('0');
  const [groupMaxSelect, setGroupMaxSelect] = useState('3');

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [optionName, setOptionName] = useState('');
  const [optionPriceDelta, setOptionPriceDelta] = useState('0');

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingOption, setIsSavingOption] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  async function apiRequest(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
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
      const message =
        typeof data === 'object' && data && 'message' in data
          ? String(data.message)
          : 'İşlem başarısız oldu.';

      throw new Error(message);
    }

    return data;
  }

  async function loadItems() {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await apiRequest('/api/menu/items');

      const safeItems = Array.isArray(data) ? data : [];
      setItems(safeItems);

      setSelectedItemId((currentItemId) => {
        if (currentItemId && safeItems.some((item) => item.id === currentItemId)) {
          return currentItemId;
        }

        return safeItems[0]?.id || '';
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ürünler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOptionGroups(itemId: string) {
    if (!itemId) {
      setOptionGroups([]);
      setSelectedGroupId('');
      return;
    }

    setError('');

    try {
      const data = await apiRequest('/api/menu/option-groups');
      const allGroups = Array.isArray(data) ? data : [];

      const safeGroups = uniqueOptionGroups(
        allGroups.filter((group) => group.menuItem?.id === itemId || group.menuItemId === itemId),
      );

      setOptionGroups(safeGroups);
      setSelectedGroupId((currentGroupId) => {
        if (currentGroupId && safeGroups.some((group) => group.id === currentGroupId)) {
          return currentGroupId;
        }

        return safeGroups[0]?.id || '';
      });
    } catch (requestError) {
      const fallbackGroups = uniqueOptionGroups(selectedItem?.optionGroups || []);

      setOptionGroups(fallbackGroups);
      setSelectedGroupId(fallbackGroups[0]?.id || '');

      if (fallbackGroups.length === 0) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Opsiyon grupları yüklenemedi.',
        );
      }
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    loadOptionGroups(selectedItemId);
  }, [selectedItemId]);

  async function createOptionGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedItemId) {
      setError('Önce ürün seçmelisiniz.');
      return;
    }

    if (!groupName.trim()) {
      setError('Opsiyon grubu adı zorunludur.');
      return;
    }

    setIsSavingGroup(true);
    setError('');
    setMessage('');

    try {
      const createdGroup = await apiRequest('/api/menu/option-groups', {
        method: 'POST',
        body: JSON.stringify({
          menuItemId: selectedItemId,
          branchId: selectedItem?.branch?.id || null,
          name: groupName.trim(),
          isRequired: groupRequired,
          minSelect: Number(groupMinSelect) || 0,
          maxSelect: Number(groupMaxSelect) || 1,
          sortOrder: 0,
          isActive: true,
        }),
      });

      setMessage('Opsiyon grubu oluşturuldu.');
      setGroupName('');
      await loadOptionGroups(selectedItemId);

      if (createdGroup?.id) {
        setSelectedGroupId(createdGroup.id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon grubu eklenemedi.');
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function createOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedGroupId) {
      setError('Önce opsiyon grubu seçmelisiniz.');
      return;
    }

    if (!optionName.trim()) {
      setError('Opsiyon adı zorunludur.');
      return;
    }

    setIsSavingOption(true);
    setError('');
    setMessage('');

    try {
      await apiRequest('/api/menu/options', {
        method: 'POST',
        body: JSON.stringify({
          optionGroupId: selectedGroupId,
          name: optionName.trim(),
          price: toNumber(optionPriceDelta),
          sortOrder: 0,
          isActive: true,
        }),
      });

      setMessage('Opsiyon eklendi.');
      setOptionName('');
      setOptionPriceDelta('0');
      await loadOptionGroups(selectedItemId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon eklenemedi.');
    } finally {
      setIsSavingOption(false);
    }
  }

  async function editOptionGroup(group: MenuItemOptionGroup) {
    const nextName = window.prompt('Opsiyon grubu adı:', group.name);

    if (nextName === null) {
      return;
    }

    if (!nextName.trim()) {
      setError('Opsiyon grubu adı boş olamaz.');
      return;
    }

    const nextMinSelect = window.prompt('Minimum seçim:', String(group.minSelect ?? 0));

    if (nextMinSelect === null) {
      return;
    }

    const nextMaxSelect = window.prompt('Maksimum seçim:', String(group.maxSelect ?? 1));

    if (nextMaxSelect === null) {
      return;
    }

    const nextIsRequired = window.confirm('Bu grup zorunlu seçim olsun mu?');

    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/option-groups/${group.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: nextName.trim(),
          isRequired: nextIsRequired,
          minSelect: Number(nextMinSelect) || 0,
          maxSelect: Number(nextMaxSelect) || 1,
        }),
      });

      setMessage('Opsiyon grubu güncellendi.');
      await loadOptionGroups(selectedItemId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Opsiyon grubu güncellenemedi.',
      );
    }
  }

  async function deleteOptionGroup(group: MenuItemOptionGroup) {
    const confirmed = window.confirm(
      `${group.name} opsiyon grubunu ve içindeki tüm seçenekleri silmek istiyor musunuz?`,
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/option-groups/${group.id}`, {
        method: 'DELETE',
      });

      setMessage('Opsiyon grubu silindi.');
      await loadOptionGroups(selectedItemId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon grubu silinemedi.');
    }
  }

  async function editOption(option: MenuItemOption) {
    const nextName = window.prompt('Opsiyon adı:', option.name);

    if (nextName === null) {
      return;
    }

    if (!nextName.trim()) {
      setError('Opsiyon adı boş olamaz.');
      return;
    }

    const nextPriceDelta = window.prompt('Fiyat farkı:', String(toNumber(option.priceDelta)));

    if (nextPriceDelta === null) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/options/${option.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: nextName.trim(),
          price: toNumber(nextPriceDelta),
        }),
      });

      setMessage('Opsiyon güncellendi.');
      await loadOptionGroups(selectedItemId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon güncellenemedi.');
    }
  }

  async function deleteOption(option: MenuItemOption) {
    const confirmed = window.confirm(`${option.name} opsiyonunu silmek istiyor musunuz?`);

    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/options/${option.id}`, {
        method: 'DELETE',
      });

      setMessage('Opsiyon silindi.');
      await loadOptionGroups(selectedItemId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon silinemedi.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            Menü Opsiyonları
          </p>
          <h1 className="mt-2 text-3xl font-black">Ürün Opsiyon Yönetimi</h1>
          <p className="mt-2 text-sm text-slate-300">
            Pizza ekstra malzeme, içecek boyutu, pişirme tercihi gibi ürün opsiyonlarını buradan
            yönetiyoruz.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold hover:bg-slate-800"
            >
              Dashboarda Dön
            </a>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <label className="text-sm font-bold text-slate-200">Ürün Seç</label>
          <select
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
            disabled={isLoading || items.length === 0}
          >
            {items.length === 0 ? (
              <option value="">Ürün bulunamadı</option>
            ) : (
              items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {formatMoney(item.price)}
                </option>
              ))
            )}
          </select>

          {selectedItem ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-4">
              <p className="text-lg font-black">{selectedItem.name}</p>
              <p className="mt-1 text-sm text-slate-400">
                {selectedItem.category?.name || 'Kategori yok'} •{' '}
                {selectedItem.branch?.name || 'Genel'} • {formatMoney(selectedItem.price)}
              </p>
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={createOptionGroup}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-xl font-black">Opsiyon Grubu Ekle</h2>
            <p className="mt-2 text-sm text-slate-400">
              Örnek: Ekstra Malzeme, Boyut Seçimi, Acı Seviyesi.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-bold">Grup Adı</label>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Ekstra Malzeme"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-bold">Minimum Seçim</label>
                  <input
                    value={groupMinSelect}
                    onChange={(event) => setGroupMinSelect(event.target.value)}
                    type="number"
                    min="0"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold">Maksimum Seçim</label>
                  <input
                    value={groupMaxSelect}
                    onChange={(event) => setGroupMaxSelect(event.target.value)}
                    type="number"
                    min="1"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm font-bold">
                <input
                  checked={groupRequired}
                  onChange={(event) => setGroupRequired(event.target.checked)}
                  type="checkbox"
                  className="h-5 w-5"
                />
                Zorunlu seçim olsun
              </label>

              <button
                type="submit"
                disabled={isSavingGroup || !selectedItemId}
                className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {isSavingGroup ? 'Ekleniyor...' : 'Grubu Ekle'}
              </button>
            </div>
          </form>

          <form
            onSubmit={createOption}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-xl font-black">Opsiyon Ekle</h2>
            <p className="mt-2 text-sm text-slate-400">
              Örnek: Ekstra Peynir +25 TL, Büyük Boy +40 TL.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-bold">Grup</label>
                <select
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                  disabled={optionGroups.length === 0}
                >
                  {optionGroups.length === 0 ? (
                    <option value="">Önce grup ekleyin</option>
                  ) : (
                    optionGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold">Opsiyon Adı</label>
                <input
                  value={optionName}
                  onChange={(event) => setOptionName(event.target.value)}
                  placeholder="Ekstra Peynir"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-sm font-bold">Fiyat Farkı</label>
                <input
                  value={optionPriceDelta}
                  onChange={(event) => setOptionPriceDelta(event.target.value)}
                  placeholder="25"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm font-bold outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingOption || !selectedGroupId}
                className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {isSavingOption ? 'Ekleniyor...' : 'Opsiyonu Ekle'}
              </button>
            </div>
          </form>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-black">Mevcut Opsiyonlar</h2>

          <div className="mt-5 space-y-4">
            {optionGroups.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">
                Bu ürün için henüz opsiyon grubu yok.
              </div>
            ) : (
              optionGroups.map((group) => (
                <div key={group.id} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{group.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {group.isRequired ? 'Zorunlu' : 'Opsiyonel'} • Min {group.minSelect ?? 0} •
                        Max {group.maxSelect ?? 1}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
                        {group.options?.length || 0} seçenek
                      </span>

                      <button
                        type="button"
                        onClick={() => editOptionGroup(group)}
                        className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-200 hover:bg-sky-500/20"
                      >
                        Düzenle
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteOptionGroup(group)}
                        className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200 hover:bg-red-500/20"
                      >
                        Sil
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(group.options || []).length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                        Bu grupta seçenek yok.
                      </div>
                    ) : (
                      (group.options || []).map((option) => (
                        <div
                          key={option.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <p className="font-bold">{option.name}</p>
                          <p className="mt-1 text-sm font-black text-emerald-300">
                            +{formatMoney(option.priceDelta)}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => editOption(option)}
                              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-black text-sky-200 hover:bg-sky-500/20"
                            >
                              Düzenle
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteOption(option)}
                              className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-200 hover:bg-red-500/20"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
