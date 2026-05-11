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

type MenuChannel = 'QR' | 'TABLE_SERVICE' | 'CALLER_ID' | 'MOBILE' | 'WHATSAPP';

type MenuItemChannelSetting = {
  id?: string;
  channel: MenuChannel;
  isEnabled?: boolean;
  customPrice?: string | number | null;
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  channelSettings?: MenuItemChannelSetting[];
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

const MENU_CHANNELS: Array<{ key: MenuChannel; label: string; shortLabel: string }> = [
  { key: 'QR', label: 'QR Sipariş', shortLabel: 'QR' },
  { key: 'TABLE_SERVICE', label: 'Masa Servis', shortLabel: 'Masa' },
  { key: 'CALLER_ID', label: 'Caller ID', shortLabel: 'Caller' },
  { key: 'MOBILE', label: 'Mobil Uygulama', shortLabel: 'Mobil' },
  { key: 'WHATSAPP', label: 'WhatsApp', shortLabel: 'WhatsApp' },
];

function getMenuItemChannelSetting(item: MenuItem, channel: MenuChannel) {
  return item.channelSettings?.find((setting) => setting.channel === channel);
}

function getChannelPriceValue(setting?: MenuItemChannelSetting) {
  if (!setting || setting.customPrice === null || setting.customPrice === undefined) {
    return '';
  }

  return String(setting.customPrice);
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
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemIsActive, setItemIsActive] = useState(true);
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

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemImageUrl, setEditItemImageUrl] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemCategoryId, setEditItemCategoryId] = useState('');
  const [editItemIsActive, setEditItemIsActive] = useState(true);

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
  const [isUpdatingItem, setIsUpdatingItem] = useState(false);

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
          imageUrl: itemImageUrl.trim() || null,
          isActive: itemIsActive,
          price: toNumber(itemPrice),
        }),
      });

      setItemName('');
      setItemDescription('');
      setItemImageUrl('');
      setItemIsActive(true);
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

  function openItemEditModal(item: MenuItem) {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemDescription(item.description || '');
    setEditItemImageUrl(item.imageUrl || '');
    setEditItemPrice(String(toNumber(item.price)));
    setEditItemCategoryId(item.categoryId || item.category?.id || '');
    setEditItemIsActive(item.isActive !== false);
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

  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItem) return;

    if (!editItemName.trim()) {
      setError('Ürün adı boş olamaz.');
      return;
    }

    if (toNumber(editItemPrice) < 0) {
      setError('Fiyat negatif olamaz.');
      return;
    }

    setIsUpdatingItem(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(`/api/menu/items/${editingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editItemName.trim(),
          description: editItemDescription.trim() || null,
          imageUrl: editItemImageUrl.trim() || null,
          price: toNumber(editItemPrice),
          categoryId: editItemCategoryId || null,
          isActive: editItemIsActive,
        }),
      });

      setEditingItem(null);
      setMessage('Ürün güncellendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ürün güncellenemedi.');
    } finally {
      setIsUpdatingItem(false);
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


  async function toggleMenuItemActive(item: MenuItem) {
    try {
      setError('');
      setMessage('');

      await apiRequest(`/api/menu/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: !item.isActive,
        }),
      });

      setMessage(item.isActive ? 'Ürün pasife alındı.' : 'Ürün aktif edildi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ürün durumu güncellenemedi.');
    }
  }

  async function deleteMenuItem(item: MenuItem) {
    const confirmed = window.confirm(`${item.name} ürünü silinsin mi? Bu işlem geçmiş siparişleri bozmaz, ürünü menüden pasife alır.`);
    if (!confirmed) {
      return;
    }

    try {
      setError('');
      setMessage('');

      await apiRequest(`/api/menu/items/${item.id}`, {
        method: 'DELETE',
      });

      setMessage('Ürün menüden kaldırıldı.');
      if (selectedItemId === item.id) {
        setSelectedItemId('');
      }
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ürün silinemedi.');
    }
  }

  async function updateMenuItemChannelSetting(
    item: MenuItem,
    channel: MenuChannel,
    patch: {
      isEnabled?: boolean;
      customPrice?: string | number | null;
    },
  ) {
    const existingSetting = getMenuItemChannelSetting(item, channel);

    try {
      setError('');
      setMessage('');

      await apiRequest(`/api/menu/items/${item.id}/channel-settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          settings: [
            {
              channel,
              isEnabled: patch.isEnabled ?? existingSetting?.isEnabled ?? true,
              customPrice:
                patch.customPrice === undefined
                  ? existingSetting?.customPrice ?? null
                  : patch.customPrice,
            },
          ],
        }),
      });

      setMessage('Kanal ayarı güncellendi.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kanal ayarı güncellenemedi.');
    }
  }


  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            Menü Yönetimi
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Menü, Ürün ve Opsiyonlar</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Ürün ekleme, kategori yönetimi, QR link üretimi ve ürün opsiyonlarını tek profesyonel
            ekranda yönetin.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/dashboard"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Ana Sayfa
            </a>
          </div>
        </header>

        <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                activeTab === 'products'
                  ? 'border border-emerald-300 bg-emerald-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
              }`}
            >
              Ürünler
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('options')}
              className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                activeTab === 'options'
                  ? 'border border-emerald-300 bg-emerald-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
              }`}
            >
              Opsiyonlar
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('qr')}
              className={`rounded-2xl px-5 py-4 text-sm font-black transition ${
                activeTab === 'qr'
                  ? 'border border-emerald-300 bg-emerald-500 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50'
              }`}
            >
              QR Linkleri
            </button>
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

        {activeTab === 'products' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <form
              onSubmit={createCategory}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
            >
              <h2 className="text-xl font-black text-slate-950">Kategori Ekle</h2>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-bold">
                  Şube
                  <select
                    value={categoryBranchId}
                    onChange={(event) => setCategoryBranchId(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {isSavingCategory ? 'Ekleniyor...' : 'Kategori Ekle'}
                </button>
              </div>
            </form>

            <form onSubmit={createItem} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-black text-slate-950">Ürün Ekle</h2>

              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-bold">
                    Şube
                    <select
                      value={itemBranchId}
                      onChange={(event) => setItemBranchId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="block text-sm font-bold">
                  Açıklama
                  <input
                    value={itemDescription}
                    onChange={(event) => setItemDescription(event.target.value)}
                    placeholder="Sucuk, mantar, mısır, kaşar"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Ürün görsel URL
                    </span>
                    <input
                      value={itemImageUrl}
                      onChange={(event) => setItemImageUrl(event.target.value)}
                      placeholder="https://.../urun-gorseli.jpg"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-sky-400"
                    />
                    <span className="block text-xs font-semibold text-slate-400">
                      V1 için görsel URL kullanıyoruz. İleride dosya yükleme desteği eklenebilir.
                    </span>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={itemIsActive}
                      onChange={(event) => setItemIsActive(event.target.checked)}
                      className="h-4 w-4"
                    />
                    Ürün aktif olarak yayınlansın
                  </label>

                <label className="block text-sm font-bold">
                  Fiyat
                  <input
                    value={itemPrice}
                    onChange={(event) => setItemPrice(event.target.value)}
                    placeholder="250"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {isSavingItem ? 'Ekleniyor...' : 'Ürün Ekle'}
                </button>
              </div>
            </form>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] lg:col-span-2">
              <h2 className="text-xl font-black text-slate-950">Mevcut Ürünler</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    Henüz ürün yok.
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      {item.imageUrl ? (
                        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-40 w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="mb-4 flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-black text-slate-400">
                          Ürün görseli yok
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-black text-slate-950">{item.name}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${item.isActive === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.isActive === false ? 'Pasif ürün' : 'Aktif ürün'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.category?.name || 'Kategori yok'} • {item.branch?.name || 'Genel'}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                      ) : null}
                      <p className="mt-3 text-xl font-black text-emerald-600">
                        {formatMoney(item.price)}
                      </p>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                            Kanal Ayarları
                          </p>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
                            Tek menü altyapısı
                          </span>
                        </div>

                        <div className="mt-3 space-y-3">
                          {MENU_CHANNELS.map((channel) => {
                            const setting = getMenuItemChannelSetting(item, channel.key);
                            const isChannelEnabled = setting?.isEnabled ?? true;

                            return (
                              <div
                                key={channel.key}
                                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-black text-slate-900">{channel.label}</p>
                                    <p className="text-xs font-semibold text-slate-500">
                                      {isChannelEnabled ? 'Bu kanalda satışta' : 'Bu kanalda kapalı'}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateMenuItemChannelSetting(item, channel.key, {
                                        isEnabled: !isChannelEnabled,
                                      })
                                    }
                                    className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                                      isChannelEnabled
                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    }`}
                                  >
                                    {isChannelEnabled ? 'Açık' : 'Kapalı'}
                                  </button>
                                </div>

                                <label className="mt-3 block text-xs font-black text-slate-500">
                                  Kanal fiyatı
                                </label>
                                <input
                                  key={`${item.id}-${channel.key}-${getChannelPriceValue(setting)}`}
                                  defaultValue={getChannelPriceValue(setting)}
                                  onBlur={(event) =>
                                    updateMenuItemChannelSetting(item, channel.key, {
                                      customPrice: event.currentTarget.value.trim() || null,
                                    })
                                  }
                                  placeholder={`Boşsa ana fiyat: ${formatMoney(item.price)}`}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button
                          type="button"
                          onClick={() => toggleMenuItemActive(item)}
                          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${item.isActive === false ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                        >
                          {item.isActive === false ? 'Aktif Et' : 'Pasife Al'}
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteMenuItem(item)}
                          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 transition hover:bg-red-100"
                        >
                          Sil / Kaldır
                        </button>

                        <button
                          type="button"
                          onClick={() => openItemEditModal(item)}
                          className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 shadow-sm transition hover:bg-sky-100"
                        >
                          Düzenle
                        </button>

                        <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setActiveTab('options');
                        }}
                        className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100"
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
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <label className="text-sm font-bold text-slate-700">Ürün Seç</label>
              <select
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
              >
                <h2 className="text-xl font-black text-slate-950">Opsiyon Grubu Ekle</h2>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold">
                    Grup Adı
                    <input
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="Ekstra Malzeme"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block text-sm font-bold">
                      Maksimum Seçim
                      <input
                        value={groupMaxSelect}
                        onChange={(event) => setGroupMaxSelect(event.target.value)}
                        type="number"
                        min="1"
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
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
                    className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {isSavingGroup ? 'Ekleniyor...' : 'Grubu Ekle'}
                  </button>
                </div>
              </form>

              <form
                onSubmit={createOption}
                className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
              >
                <h2 className="text-xl font-black text-slate-950">Opsiyon Ekle</h2>

                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-bold">
                    Grup
                    <select
                      value={selectedGroupId}
                      onChange={(event) => setSelectedGroupId(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="block text-sm font-bold">
                    Fiyat Farkı
                    <input
                      value={optionPriceDelta}
                      onChange={(event) => setOptionPriceDelta(event.target.value)}
                      placeholder="25"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isSavingOption || !selectedGroupId}
                    className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {isSavingOption ? 'Ekleniyor...' : 'Opsiyonu Ekle'}
                  </button>
                </div>
              </form>
            </div>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
              <h2 className="text-xl font-black text-slate-950">Mevcut Opsiyonlar</h2>

              <div className="mt-5 space-y-4">
                {selectedGroups.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                    Bu ürün için henüz opsiyon grubu yok.
                  </div>
                ) : (
                  selectedGroups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-950">{group.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.isRequired ? 'Zorunlu' : 'Opsiyonel'} • Min {group.minSelect ?? 0} •
                            Max {group.maxSelect ?? 1} • {group.isActive === false ? 'Pasif' : 'Aktif'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700">
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
                            className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-500/20"
                          >
                            Sil
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(group.options || []).length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
                            Bu grupta seçenek yok.
                          </div>
                        ) : (
                          (group.options || []).map((option) => (
                            <div key={option.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="font-bold">{option.name}</p>
                              <p className="mt-1 text-sm font-black text-emerald-600">
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
                                  className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-500/20"
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
            <h2 className="text-xl font-black text-slate-950">QR Masa Linki Oluştur</h2>
            <p className="mt-2 text-sm text-slate-500">
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
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
              <input
                readOnly
                value={qrLink || 'Şube ve masa seçince link oluşur'}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-emerald-100 outline-none"
              />

              <button
                type="button"
                disabled={!qrLink}
                onClick={copyQrLink}
                className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
              >
                {qrCopied ? 'Kopyalandı' : 'Linki Kopyala'}
              </button>
            </div>

            {qrLink ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
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

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600">
                    QR Oluşturucu
                  </p>

                  <h3 className="mt-2 text-2xl font-black">Masa {qrTableNumber.trim()} QR Kodu</h3>

                  <p className="mt-2 text-sm text-slate-500">
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
                      className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-500/20"
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
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">Opsiyon Grubunu Düzenle</h2>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Grup Adı
                <input
                  value={editGroupName}
                  onChange={(event) => setEditGroupName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 outline-none focus:border-emerald-400"
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
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>

                <label className="block text-sm font-bold">
                  Maksimum Seçim
                  <input
                    value={editGroupMaxSelect}
                    onChange={(event) => setEditGroupMaxSelect(event.target.value)}
                    type="number"
                    min="1"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 outline-none focus:border-emerald-400"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold">
                <input
                  checked={editGroupRequired}
                  onChange={(event) => setEditGroupRequired(event.target.checked)}
                  type="checkbox"
                  className="h-5 w-5"
                />
                Zorunlu seçim olsun
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold">
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
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black hover:bg-white/10"
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
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black">Opsiyonu Düzenle</h2>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Opsiyon Adı
                <input
                  value={editOptionName}
                  onChange={(event) => setEditOptionName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="block text-sm font-bold">
                Fiyat Farkı
                <input
                  value={editOptionPriceDelta}
                  onChange={(event) => setEditOptionPriceDelta(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold">
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
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black hover:bg-white/10"
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
      {editingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <form
            onSubmit={updateItem}
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-2xl"
          >
            <h2 className="text-2xl font-black text-slate-950">Ürünü Düzenle</h2>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Ürün Adı
                <input
                  value={editItemName}
                  onChange={(event) => setEditItemName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="block text-sm font-bold">
                Açıklama
                <input
                  value={editItemDescription}
                  onChange={(event) => setEditItemDescription(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="block text-sm font-bold">
                Ürün görsel URL
                <input
                  value={editItemImageUrl}
                  onChange={(event) => setEditItemImageUrl(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="block text-sm font-bold">
                Fiyat
                <input
                  value={editItemPrice}
                  onChange={(event) => setEditItemPrice(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-emerald-400"
                />
              </label>

              <label className="block text-sm font-bold">
                Kategori
                <select
                  value={editItemCategoryId}
                  onChange={(event) => setEditItemCategoryId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-950 outline-none focus:border-emerald-400"
                >
                  <option value="">Kategori yok</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800">
                <input
                  checked={editItemIsActive}
                  onChange={(event) => setEditItemIsActive(event.target.checked)}
                  type="checkbox"
                  className="h-5 w-5"
                />
                Aktif olarak göster
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                Vazgeç
              </button>

              <button
                type="submit"
                disabled={isUpdatingItem}
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {isUpdatingItem ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
