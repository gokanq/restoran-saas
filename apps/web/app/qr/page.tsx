'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type MenuItemOption = {
  id: string;
  name: string;
  priceDelta: string | number;
};

type MenuItemOptionGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: MenuItemOption[];
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  optionGroups?: MenuItemOptionGroup[];
};

type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

type PublicMenuResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
  branch: {
    id: string;
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  categories: MenuCategory[];
};

type CartItem = {
  key: string;
  menuItemId: string;
  name: string;
  basePrice: number;
  price: number;
  quantity: number;
  optionIds: string[];
  optionNames: string[];
};

function toNumber(value: string | number) {
  const parsedValue = Number(String(value).replace(',', '.'));

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatMoney(value: string | number) {
  const numericValue = toNumber(value);

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(numericValue);
}

function QrPageContent() {
  const searchParams = useSearchParams();

  const branchId = searchParams.get('branchId') || '';
  const tableNumber = searchParams.get('table') || '';

  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [cartItems, setCartItems] = useState<Record<string, CartItem>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState('');
  const [selectedOptionsByItem, setSelectedOptionsByItem] = useState<Record<string, string[]>>({});


  const cartList = useMemo(() => Object.values(cartItems), [cartItems]);

  const cartTotal = useMemo(() => {
    return cartList.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cartList]);

  const cartTotalQuantity = useMemo(() => {
    return cartList.reduce((total, item) => total + item.quantity, 0);
  }, [cartList]);

  useEffect(() => {
    async function loadMenu() {
      setError('');
      setSuccessCode('');

      if (!branchId) {
        setError('QR bağlantısında şube bilgisi eksik.');
        setIsLoading(false);
        return;
      }

      if (!tableNumber) {
        setError('QR bağlantısında masa numarası eksik.');
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/menu?branchId=${encodeURIComponent(branchId)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Menü yüklenemedi.');
          return;
        }

        setMenu(data);
      } catch {
        setError('Menü yüklenirken hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }

    loadMenu();
  }, [branchId, tableNumber]);

  function getSelectedOptions(item: MenuItem) {
    const selectedOptionIds = selectedOptionsByItem[item.id] || [];
    const allOptions = (item.optionGroups || []).flatMap((group) => group.options || []);
    return allOptions.filter((option) => selectedOptionIds.includes(option.id));
  }

  function getCartKey(item: MenuItem) {
    const selectedOptionIds = [...(selectedOptionsByItem[item.id] || [])].sort();
    return `${item.id}:${selectedOptionIds.join(',')}`;
  }

  function toggleOption(item: MenuItem, group: MenuItemOptionGroup, option: MenuItemOption) {
    setSelectedOptionsByItem((current) => {
      const selected = current[item.id] || [];
      const groupOptionIds = new Set((group.options || []).map((groupOption) => groupOption.id));
      const groupSelected = selected.filter((optionId) => groupOptionIds.has(optionId));
      const otherSelected = selected.filter((optionId) => !groupOptionIds.has(optionId));

      if (group.maxSelect <= 1) {
        if (groupSelected.includes(option.id)) {
          return {
            ...current,
            [item.id]: otherSelected,
          };
        }

        return {
          ...current,
          [item.id]: [...otherSelected, option.id],
        };
      }

      if (groupSelected.includes(option.id)) {
        return {
          ...current,
          [item.id]: [...otherSelected, ...groupSelected.filter((optionId) => optionId !== option.id)],
        };
      }

      if (groupSelected.length >= group.maxSelect) {
        return current;
      }

      return {
        ...current,
        [item.id]: [...otherSelected, ...groupSelected, option.id],
      };
    });

    setSuccessCode('');
  }

  function increaseItem(item: MenuItem) {
    const selectedOptions = getSelectedOptions(item);
    const optionIds = selectedOptions.map((option) => option.id);
    const optionNames = selectedOptions.map((option) => option.name);
    const basePrice = toNumber(item.price);
    const optionTotal = selectedOptions.reduce((sum, option) => sum + toNumber(option.priceDelta), 0);
    const price = basePrice + optionTotal;
    const key = getCartKey(item);

    setCartItems((currentItems) => {
      const currentItem = currentItems[key];

      return {
        ...currentItems,
        [key]: {
          key,
          menuItemId: item.id,
          name: item.name,
          basePrice,
          price,
          quantity: currentItem ? currentItem.quantity + 1 : 1,
          optionIds,
          optionNames,
        },
      };
    });

    setSuccessCode('');
  }

  function decreaseItem(item: MenuItem) {
    setCartItems((currentItems) => {
      const key = getCartKey(item);
      const currentItem = currentItems[key];

      if (!currentItem) {
        return currentItems;
      }

      if (currentItem.quantity <= 1) {
        const nextItems = { ...currentItems };
        delete nextItems[key];
        return nextItems;
      }

      return {
        ...currentItems,
        [key]: {
          ...currentItem,
          quantity: currentItem.quantity - 1,
        },
      };
    });

    setSuccessCode('');
  }

  async function submitOrder() {
    setError('');
    setSuccessCode('');

    if (!branchId) {
      setError('Şube bilgisi eksik.');
      return;
    }

    if (!tableNumber) {
      setError('Masa numarası eksik.');
      return;
    }

    if (cartList.length === 0) {
      setError('Lütfen en az bir ürün seçin.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/orders/table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId,
          tableNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          note: orderNote.trim(),
          items: cartList.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            optionIds: item.optionIds,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş oluşturulamadı.');
        return;
      }

      setSuccessCode(data.code || 'Sipariş alındı');
      setCartItems({});
      setCustomerName('');
      setCustomerPhone('');
      setOrderNote('');
    } catch {
      setError('Sipariş gönderilirken hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <p className="text-lg font-bold">Menü yükleniyor...</p>
      </main>
    );
  }

  if (error && !menu) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-center">
          <h1 className="text-2xl font-black text-red-100">Menü açılamadı</h1>
          <p className="mt-3 text-sm leading-6 text-red-200">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            QR Menü
          </p>
          <h1 className="mt-2 text-3xl font-black">{menu?.restaurant.name || 'Restoran'}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {menu?.branch.name || 'Şube'} • Masa {tableNumber}
          </p>

          {menu?.branch.address ? (
            <p className="mt-2 text-xs leading-5 text-slate-400">{menu.branch.address}</p>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        {successCode ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
            Siparişiniz alındı. Sipariş kodu: {successCode}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5">
            {menu?.categories.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-300">
                Henüz menü ürünü yok.
              </div>
            ) : null}

            {menu?.categories.map((category) => (
              <div
                key={category.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10"
              >
                <h2 className="text-xl font-black">{category.name}</h2>

                {category.items.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-400">
                    Bu kategoride aktif ürün yok.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {category.items.map((item) => {
                      const cartKey = getCartKey(item);
                      const quantity = cartItems[cartKey]?.quantity || 0;
                      const selectedOptions = getSelectedOptions(item);
                      const optionTotal = selectedOptions.reduce((sum, option) => sum + toNumber(option.priceDelta), 0);

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-slate-900/80 p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-bold">{item.name}</h3>
                              {item.description ? (
                                <p className="mt-1 text-sm leading-5 text-slate-400">
                                  {item.description}
                                </p>
                              ) : null}
                              <p className="mt-2 text-base font-black text-emerald-300">
                                {formatMoney(toNumber(item.price) + optionTotal)}
                              </p>

                              {selectedOptions.length > 0 ? (
                                <p className="mt-1 text-xs font-semibold text-emerald-200">
                                  Seçili: {selectedOptions.map((option) => option.name).join(', ')}
                                </p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => decreaseItem(item)}
                                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl font-black transition hover:bg-white/10"
                              >
                                -
                              </button>

                              <span className="min-w-8 text-center text-lg font-black">
                                {quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() => increaseItem(item)}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-xl font-black text-slate-950 transition hover:bg-emerald-400"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {(item.optionGroups || []).length > 0 ? (
                            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                              {(item.optionGroups || []).map((group) => {
                                const selectedIds = selectedOptionsByItem[item.id] || [];
                                const groupSelectedCount = (group.options || []).filter((option) => selectedIds.includes(option.id)).length;

                                return (
                                  <div key={group.id}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-black text-slate-200">{group.name}</p>
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-slate-400">
                                        {group.maxSelect <= 1 ? 'Tek seçim' : `En fazla ${group.maxSelect} seçim`}
                                      </span>
                                      {group.isRequired ? (
                                        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-200">
                                          Zorunlu
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {(group.options || []).map((option) => {
                                        const isSelected = selectedIds.includes(option.id);
                                        const isDisabled = !isSelected && group.maxSelect > 1 && groupSelectedCount >= group.maxSelect;

                                        return (
                                          <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => toggleOption(item, group, option)}
                                            disabled={isDisabled}
                                            className={`rounded-full border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                              isSelected
                                                ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                                                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                                            }`}
                                          >
                                            {option.name} {toNumber(option.priceDelta) > 0 ? `+${formatMoney(option.priceDelta)}` : ''}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </section>

          <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 lg:sticky lg:top-6">
            <h2 className="text-xl font-black">Sepet</h2>
            <p className="mt-1 text-sm text-slate-400">
              Masa {tableNumber} • {cartTotalQuantity} ürün
            </p>

            {cartList.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-400">
                Sepetiniz boş.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {cartList.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{item.name}</p>
                        {item.optionNames.length > 0 ? (
                          <p className="mt-1 text-xs text-emerald-200">
                            {item.optionNames.join(', ')}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-400">
                          {item.quantity} x {formatMoney(item.price)}
                        </p>
                      </div>
                      <p className="font-black text-emerald-300">
                        {formatMoney(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Toplam</span>
                <span className="text-2xl font-black text-emerald-300">
                  {formatMoney(cartTotal)}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-semibold text-slate-200">
                Adınız
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                  placeholder="Adınız"
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

              <label className="block text-sm font-semibold text-slate-200">
                Sipariş Notu
                <textarea
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                  placeholder="Acısız olsun, soğan olmasın vb."
                />
              </label>
            </div>

            <button
              type="button"
              onClick={submitOrder}
              disabled={isSubmitting || cartList.length === 0}
              className="mt-5 w-full rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Sipariş Gönderiliyor...' : 'Sipariş Ver'}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Siparişiniz restoran paneline masa siparişi olarak düşer.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function QrPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
          <p className="text-lg font-bold">QR sayfası yükleniyor...</p>
        </main>
      }
    >
      <QrPageContent />
    </Suspense>
  );
}
