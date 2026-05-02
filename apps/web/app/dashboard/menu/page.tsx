'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

type Branch = {
  id: string;
  name: string;
};

type MenuCategory = {
  id: string;
  name: string;
  branchId?: string | null;
  branch?: Branch | null;
};

type MenuItemOption = {
  id: string;
  name: string;
  priceDelta: string | number;
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
  isActive?: boolean;
  options?: MenuItemOption[];
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  categoryId?: string | null;
  branchId?: string | null;
  category?: MenuCategory | null;
  branch?: Branch | null;
};

type Tab = 'products' | 'options' | 'qr';

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

export default function DashboardMenuPage() {
  const [activeTab, setActiveTab] = useState<Tab>('products');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [optionGroups, setOptionGroups] = useState<MenuItemOptionGroup[]>([]);

  const [categoryBranchId, setCategoryBranchId] = useState('');
  const [categoryName, setCategoryName] = useState('');

  const [itemBranchId, setItemBranchId] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const [selectedItemId, setSelectedItemId] = useState('');
  const [groupName, setGroupName] = useState('Ekstra Malzeme');
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMinSelect, setGroupMinSelect] = useState('0');
  const [groupMaxSelect, setGroupMaxSelect] = useState('3');

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [optionName, setOptionName] = useState('');
  const [optionPriceDelta, setOptionPriceDelta] = useState('0');

  const [editingGroup, setEditingGroup] = useState<MenuItemOptionGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupRequired, setEditGroupRequired] = useState(false);
  const [editGroupMinSelect, setEditGroupMinSelect] = useState('0');
  const [editGroupMaxSelect, setEditGroupMaxSelect] = useState('1');
  const [editGroupActive, setEditGroupActive] = useState(true);

  const [editingOption, setEditingOption] = useState<MenuItemOption | null>(null);
  const [editOptionName, setEditOptionName] = useState('');
  const [editOptionPriceDelta, setEditOptionPriceDelta] = useState('0');
  const [editOptionActive, setEditOptionActive] = useState(true);

  const [qrBranchId, setQrBranchId] = useState('');
  const [qrTableNumber, setQrTableNumber] = useState('1');
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isSavingOption, setIsSavingOption] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isUpdatingOption, setIsUpdatingOption] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const selectedGroups = useMemo(() => {
    return uniqueOptionGroups(
      optionGroups.filter(
        (group) => group.menuItem?.id === selectedItemId || group.menuItemId === selectedItemId,
      ),
    );
  }, [optionGroups, selectedItemId]);

  const qrLink = useMemo(() => {
    const table = qrTableNumber.trim();

    if (!publicBaseUrl || !qrBranchId || !table) {
      return '';
    }

    return `${publicBaseUrl}/qr?branchId=${qrBranchId}&table=${encodeURIComponent(table)}`;
  }, [publicBaseUrl, qrBranchId, qrTableNumber]);

  useEffect(() => {
    let isActive = true;

    async function generateQrCode() {
      if (!qrLink) {
        setQrDataUrl('');
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(qrLink, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 360,
          color: {
            dark: '#020617',
            light: '#ffffff',
          },
        });

        if (isActive) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (isActive) {
          setQrDataUrl('');
        }
      }
    }

    generateQrCode();

    return () => {
      isActive = false;
    };
  }, [qrLink]);

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
      const [branchesData, categoriesData, itemsData, groupsData] = await Promise.all([
        apiRequest('/api/branches'),
        apiRequest('/api/menu/categories'),
        apiRequest('/api/menu/items'),
        apiRequest('/api/menu/option-groups'),
      ]);

      const safeBranches = Array.isArray(branchesData) ? branchesData : [];
      const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
      const safeItems = Array.isArray(itemsData) ? itemsData : [];
      const safeGroups = Array.isArray(groupsData) ? groupsData : [];

      setBranches(safeBranches);
      setCategories(safeCategories);
      setItems(safeItems);
      setOptionGroups(safeGroups);

      setCategoryBranchId((current) => current || safeBranches[0]?.id || '');
      setItemBranchId((current) => current || safeBranches[0]?.id || '');
      setQrBranchId((current) => current || safeBranches[0]?.id || '');

      setSelectedItemId((current) => {
        if (current && safeItems.some((item) => item.id === current)) {
          return current;
        }

        return safeItems[0]?.id || '';
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Menü bilgileri yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setPublicBaseUrl(window.location.origin);
    loadData();
  }, []);

  useEffect(() => {
    setSelectedGroupId((current) => {
      if (current && selectedGroups.some((group) => group.id === current)) {
        return current;
      }

      return selectedGroups[0]?.id || '';
    });
  }, [selectedGroups]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!categoryName.trim()) {
      setError('Kategori adı zorunludur.');
      return;
    }

    setIsSavingCategory(true);
    setError('');
    setMessage('');

    try {
      await apiRequest('/api/menu/categories', {
        method: 'POST',
        body: JSON.stringify({
          branchId: categoryBranchId || null,
          name: categoryName.trim(),
          sortOrder: 0,
          isActive: true,
        }),
      });

      setCategoryName('');
      setMessage('Kategori eklendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kategori eklenemedi.');
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!itemName.trim()) {
      setError('Ürün adı zorunludur.');
      return;
    }

    if (toNumber(itemPrice) <= 0) {
      setError('Ürün fiyatı 0’dan büyük olmalıdır.');
      return;
    }

    setIsSavingItem(true);
    setError('');
    setMessage('');

    try {
      await apiRequest('/api/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          branchId: itemBranchId || null,
          categoryId: itemCategoryId || null,
          name: itemName.trim(),
          description: itemDescription.trim() || null,
          price: toNumber(itemPrice),
          isActive: true,
        }),
      });

      setItemName('');
      setItemDescription('');
      setItemPrice('');
      setMessage('Ürün eklendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ürün eklenemedi.');
    } finally {
      setIsSavingItem(false);
    }
  }

  async function createOptionGroup(event: FormEvent<HTMLFormElement>) {
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
          branchId: selectedItem?.branch?.id || selectedItem?.branchId || null,
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
      await loadData();

      if (createdGroup?.id) {
        setSelectedGroupId(createdGroup.id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon grubu eklenemedi.');
    } finally {
      setIsSavingGroup(false);
    }
  }

  async function createOption(event: FormEvent<HTMLFormElement>) {
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

      setOptionName('');
      setOptionPriceDelta('0');
      setMessage('Opsiyon eklendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon eklenemedi.');
    } finally {
      setIsSavingOption(false);
    }
  }

  function openGroupEditModal(group: MenuItemOptionGroup) {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupRequired(Boolean(group.isRequired));
    setEditGroupMinSelect(String(group.minSelect ?? 0));
    setEditGroupMaxSelect(String(group.maxSelect ?? 1));
    setEditGroupActive(group.isActive !== false);
    setError('');
    setMessage('');
  }

  function openOptionEditModal(option: MenuItemOption) {
    setEditingOption(option);
    setEditOptionName(option.name);
    setEditOptionPriceDelta(String(toNumber(option.priceDelta)));
    setEditOptionActive(option.isActive !== false);
    setError('');
    setMessage('');
  }

  async function updateOptionGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingGroup) return;

    if (!editGroupName.trim()) {
      setError('Opsiyon grubu adı boş olamaz.');
      return;
    }

    setIsUpdatingGroup(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/option-groups/${editingGroup.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editGroupName.trim(),
          isRequired: editGroupRequired,
          minSelect: Number(editGroupMinSelect) || 0,
          maxSelect: Number(editGroupMaxSelect) || 1,
          isActive: editGroupActive,
        }),
      });

      setEditingGroup(null);
      setMessage('Opsiyon grubu güncellendi.');
      await loadData();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Opsiyon grubu güncellenemedi.',
      );
    } finally {
      setIsUpdatingGroup(false);
    }
  }

  async function updateOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingOption) return;

    if (!editOptionName.trim()) {
      setError('Opsiyon adı boş olamaz.');
      return;
    }

    setIsUpdatingOption(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/options/${editingOption.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editOptionName.trim(),
          price: toNumber(editOptionPriceDelta),
          isActive: editOptionActive,
        }),
      });

      setEditingOption(null);
      setMessage('Opsiyon güncellendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon güncellenemedi.');
    } finally {
      setIsUpdatingOption(false);
    }
  }

  async function deleteOptionGroup(group: MenuItemOptionGroup) {
    const confirmed = window.confirm(
      `${group.name} opsiyon grubunu ve içindeki tüm seçenekleri silmek istiyor musunuz?`,
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/option-groups/${group.id}`, {
        method: 'DELETE',
      });

      setMessage('Opsiyon grubu silindi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon grubu silinemedi.');
    }
  }

  async function deleteOption(option: MenuItemOption) {
    const confirmed = window.confirm(`${option.name} opsiyonunu silmek istiyor musunuz?`);

    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/options/${option.id}`, {
        method: 'DELETE',
      });

      setMessage('Opsiyon silindi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Opsiyon silinemedi.');
    }
  }

  async function copyQrLink() {
    if (!qrLink) return;

    try {
      await navigator.clipboard.writeText(qrLink);
      setQrCopied(true);
      window.setTimeout(() => setQrCopied(false), 1800);
    } catch {
      window.prompt('QR linkini kopyalayın:', qrLink);
    }
  }

  function downloadQrCode() {
    if (!qrDataUrl) return;

    const safeTableNumber = qrTableNumber.trim() || 'masa';
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `masa-${safeTableNumber}-qr.png`;
    link.click();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            Menü Yönetimi
          </p>
          <h1 className="mt-2 text-3xl font-black">Menü, Ürün ve Opsiyonlar</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Ürün ekleme, kategori yönetimi, QR link üretimi ve ürün opsiyonlarını tek profesyonel
            ekranda yönetin.
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

        <section className="rounded-3xl border border-white/10 bg-white/5 p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                activeTab === 'products'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              Ürünler
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('options')}
              className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                activeTab === 'options'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              Opsiyonlar
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                activeTab === 'qr'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              QR Linkleri
            </button>
          </div>
        </section>

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

        {activeTab === 'products' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <form
              onSubmit={createCategory}
              className="rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-xl font-black">Kategori Ekle</h2>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-bold">
                  Şube
                  <select
                    value={categoryBranchId}
                    onChange={(event) => setCategoryBranchId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-bold">
                  Kategori Adı
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Pizzalar"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  {isSavingCategory ? 'Ekleniyor...' : 'Kategori Ekle'}
                </button>
              </div>
            </form>

            <form onSubmit={createItem} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-black">Ürün Ekle</h2>

              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-bold">
                    Şube
                    <select
                      value={itemBranchId}
                      onChange={(event) => setItemBranchId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                    >
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-bold">
                    Kategori
                    <select
                      value={itemCategoryId}
                      onChange={(event) => setItemCategoryId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                    >
                      <option value="">Kategori seç</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-bold">
                  Ürün Adı
                  <input
                    value={itemName}
                    onChange={(event) => setItemName(event.target.value)}
                    placeholder="Karışık Pizza"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="block text-sm font-bold">
                  Açıklama
                  <input
                    value={itemDescription}
                    onChange={(event) => setItemDescription(event.target.value)}
                    placeholder="Sucuk, mantar, mısır, kaşar"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="block text-sm font-bold">
                  Fiyat
                  <input
                    value={itemPrice}
                    onChange={(event) => setItemPrice(event.target.value)}
                    placeholder="250"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  {isSavingItem ? 'Ekleniyor...' : 'Ürün Ekle'}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
              <h2 className="text-xl font-black">Mevcut Ürünler</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">
                    Henüz ürün yok.
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                      <p className="text-lg font-black">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.category?.name || 'Kategori yok'} • {item.branch?.name || 'Genel'}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                      ) : null}
                      <p className="mt-3 text-xl font-black text-emerald-300">
                        {formatMoney(item.price)}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActiveTab('options');
                        }}
                        className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-500/20"
                      >
                        Opsiyonları Yönet
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'options' ? (
          <div className="space-y-6">
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
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={createOptionGroup}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <h2 className="text-xl font-black">Opsiyon Grubu Ekle</h2>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold">
                    Grup Adı
                    <input
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="Ekstra Malzeme"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-bold">
                      Minimum Seçim
                      <input
                        value={groupMinSelect}
                        onChange={(event) => setGroupMinSelect(event.target.value)}
                        type="number"
                        min="0"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                      />
                    </label>

                    <label className="block text-sm font-bold">
                      Maksimum Seçim
                      <input
                        value={groupMaxSelect}
                        onChange={(event) => setGroupMaxSelect(event.target.value)}
                        type="number"
                        min="1"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                      />
                    </label>
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
                    className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
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

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold">
                    Grup
                    <select
                      value={selectedGroupId}
                      onChange={(event) => setSelectedGroupId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                      disabled={selectedGroups.length === 0}
                    >
                      {selectedGroups.length === 0 ? (
                        <option value="">Önce grup ekleyin</option>
                      ) : (
                        selectedGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label className="block text-sm font-bold">
                    Opsiyon Adı
                    <input
                      value={optionName}
                      onChange={(event) => setOptionName(event.target.value)}
                      placeholder="Ekstra Peynir"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                    />
                  </label>

                  <label className="block text-sm font-bold">
                    Fiyat Farkı
                    <input
                      value={optionPriceDelta}
                      onChange={(event) => setOptionPriceDelta(event.target.value)}
                      placeholder="25"
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSavingOption || !selectedGroupId}
                    className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
                  >
                    {isSavingOption ? 'Ekleniyor...' : 'Opsiyonu Ekle'}
                  </button>
                </div>
              </form>
            </div>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-black">Mevcut Opsiyonlar</h2>

              <div className="mt-5 space-y-4">
                {selectedGroups.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">
                    Bu ürün için henüz opsiyon grubu yok.
                  </div>
                ) : (
                  selectedGroups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-black">{group.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {group.isRequired ? 'Zorunlu' : 'Opsiyonel'} • Min {group.minSelect ?? 0} •
                            Max {group.maxSelect ?? 1} • {group.isActive === false ? 'Pasif' : 'Aktif'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200">
                            {group.options?.length || 0} seçenek
                          </span>

                          <button
                            type="button"
                            onClick={() => openGroupEditModal(group)}
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
                            <div key={option.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="font-bold">{option.name}</p>
                              <p className="mt-1 text-sm font-black text-emerald-300">
                                +{formatMoney(option.priceDelta)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {option.isActive === false ? 'Pasif' : 'Aktif'}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openOptionEditModal(option)}
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
        ) : null}

        {activeTab === 'qr' ? (
          <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
            <h2 className="text-xl font-black">QR Masa Linki Oluştur</h2>
            <p className="mt-2 text-sm text-slate-300">
              Masa numarası girerek müşterinin açacağı QR sipariş linkini oluşturun.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
              <label className="block text-sm font-bold">
                Şube
                <select
                  value={qrBranchId}
                  onChange={(event) => {
                    setQrBranchId(event.target.value);
                    setQrCopied(false);
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-bold">
                Masa No
                <input
                  value={qrTableNumber}
                  onChange={(event) => {
                    setQrTableNumber(event.target.value);
                    setQrCopied(false);
                  }}
                  placeholder="5"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 outline-none focus:border-emerald-400"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
              <input
                readOnly
                value={qrLink || 'Şube ve masa seçince link oluşur'}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-4 text-sm text-emerald-100 outline-none"
              />

              <button
                type="button"
                disabled={!qrLink}
                onClick={copyQrLink}
                className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {qrCopied ? 'Kopyalandı' : 'Linki Kopyala'}
              </button>
            </div>

            {qrLink ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
                <div className="rounded-3xl border border-white/10 bg-white p-5">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Masa QR kodu"
                      className="mx-auto h-auto w-full max-w-[320px]"
                    />
                  ) : (
                    <div className="flex h-[320px] items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-500">
                      QR hazırlanıyor...
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-slate-950 p-5">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                    QR Oluşturucu
                  </p>

                  <h3 className="mt-2 text-2xl font-black">Masa {qrTableNumber.trim()} QR Kodu</h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Bu QR kodu yazdırıp masaya koyabilirsiniz. Müşteri kamerayla okuttuğunda direkt masa sipariş ekranı açılır.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={!qrDataUrl}
                      onClick={downloadQrCode}
                      className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                    >
                      QR PNG İndir
                    </button>

                    <a
                      href={qrLink}
                      target="_blank"
                      className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-500/20"
                    >
                      Linki Aç
                    </a>
                  </div>

                  <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Not: Mobilde link açarken adresin başında <b>http://</b> olduğundan emin olun. SSL/domain eklediğimizde bunu profesyonel şekilde <b>https</b> yapacağız.
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {editingGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <form
            onSubmit={updateOptionGroup}
            className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">Opsiyon Grubunu Düzenle</h2>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Grup Adı
                <input
                  value={editGroupName}
                  onChange={(event) => setEditGroupName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 outline-none focus:border-emerald-400"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold">
                  Minimum Seçim
                  <input
                    value={editGroupMinSelect}
                    onChange={(event) => setEditGroupMinSelect(event.target.value)}
                    type="number"
                    min="0"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="block text-sm font-bold">
                  Maksimum Seçim
                  <input
                    value={editGroupMaxSelect}
                    onChange={(event) => setEditGroupMaxSelect(event.target.value)}
                    type="number"
                    min="1"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm font-bold">
                <input
                  checked={editGroupRequired}
                  onChange={(event) => setEditGroupRequired(event.target.checked)}
                  type="checkbox"
                  className="h-5 w-5"
                />
                Zorunlu seçim olsun
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm font-bold">
                <input
                  checked={editGroupActive}
                  onChange={(event) => setEditGroupActive(event.target.checked)}
                  type="checkbox"
                  className="h-5 w-5"
                />
                Aktif olarak göster
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black hover:bg-white/10"
              >
                Vazgeç
              </button>

              <button
                type="submit"
                disabled={isUpdatingGroup}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {isUpdatingGroup ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingOption ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <form
            onSubmit={updateOption}
            className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">Opsiyonu Düzenle</h2>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Opsiyon Adı
                <input
                  value={editOptionName}
                  onChange={(event) => setEditOptionName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="block text-sm font-bold">
                Fiyat Farkı
                <input
                  value={editOptionPriceDelta}
                  onChange={(event) => setEditOptionPriceDelta(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-4 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm font-bold">
                <input
                  checked={editOptionActive}
                  onChange={(event) => setEditOptionActive(event.target.checked)}
                  type="checkbox"
                  className="h-5 w-5"
                />
                Aktif olarak göster
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingOption(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black hover:bg-white/10"
              >
                Vazgeç
              </button>

              <button
                type="submit"
                disabled={isUpdatingOption}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
              >
                {isUpdatingOption ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
