'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Branch = {
  id: string;
  name: string;
};

type OrderType = 'DELIVERY' | 'TABLE' | 'TAKEAWAY';
type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'ONLINE' | 'MEAL_CARD' | 'OPEN_ACCOUNT';

type CallerDevice = {
  id: string;
  restaurantId?: string;
  branchId?: string | null;
  name: string;
  keyPreview: string;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deviceKey?: string;
  message?: string;
};


type CallerEvent = {
  id: string;
  restaurantId?: string;
  branchId?: string | null;
  phone: string;
  phoneNormalized?: string | null;
  status?: 'NEW' | 'SEEN' | string | null;
  source?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  payload?: {
    deviceId?: string;
    deviceName?: string;
    [key: string]: unknown;
  } | null;
  receivedAt?: string | null;
  seenAt?: string | null;
};

type OrderLite = {
  id?: string;
  code?: string;
  type?: OrderType | string | null;
  status?: string | null;
  total?: number | string | null;
  paymentMethod?: PaymentMethod | string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  note?: string | null;
  createdAt?: string;
};

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DELIVERY', label: 'Paket' },
  { value: 'TABLE', label: 'Masa' },
  { value: 'TAKEAWAY', label: 'Gel-al' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Nakit' },
  { value: 'CREDIT_CARD', label: 'Kredi / Banka Kartı' },
  { value: 'ONLINE', label: 'Online Ödeme' },
  { value: 'MEAL_CARD', label: 'Yemek Kartı' },
  { value: 'OPEN_ACCOUNT', label: 'Açık Hesap' },
];

async function readJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function normalizeOrders(data: any): OrderLite[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.orders)) {
    return data.orders;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}


function normalizeCallerEvents(data: any): CallerEvent[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

function getNextOrderCode(orders: OrderLite[]) {
  const maxNumber = orders.reduce((max, order) => {
    const match = /^ORD-(\d{1,6})$/.exec(order.code || '');
    const orderNumber = match ? Number(match[1]) : 0;

    return Number.isFinite(orderNumber) && orderNumber > max ? orderNumber : max;
  }, 0);

  return `ORD-${maxNumber + 1}`;
}

function extractOrderCode(data: any) {
  return String(data?.code || data?.order?.code || data?.data?.code || '').trim();
}

function getNewestOrderCode(orders: OrderLite[]) {
  const sortedOrders = [...orders].sort((first, second) => {
    const firstTime = new Date(first.createdAt || '').getTime();
    const secondTime = new Date(second.createdAt || '').getTime();

    return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
  });

  return sortedOrders[0]?.code || '';
}

function normalizePhone(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function getComparablePhone(value?: string | null) {
  const normalized = normalizePhone(value);

  return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

function sortNewestOrders(orders: OrderLite[]) {
  return [...orders].sort((first, second) => {
    const firstTime = new Date(first.createdAt || '').getTime();
    const secondTime = new Date(second.createdAt || '').getTime();

    return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
  });
}

function formatMoney(value?: number | string | null) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return '0,00 ₺';
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(numericValue);
}

function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getPaymentLabel(value?: string | null) {
  return PAYMENT_METHOD_OPTIONS.find((method) => method.value === value)?.label || value || '-';
}

function getOrderTypeLabel(value?: string | null) {
  return ORDER_TYPE_OPTIONS.find((type) => type.value === value)?.label || value || '-';
}

function toPaymentMethod(value?: string | null): PaymentMethod {
  const found = PAYMENT_METHOD_OPTIONS.find((method) => method.value === value);

  return found?.value || 'CASH';
}


async function copyTextToClipboard(value: string): Promise<boolean> {
  const text = value.trim();

  if (!text) {
    return false;
  }

  const clipboardApi =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & {
          clipboard?: {
            writeText?: (value: string) => Promise<void>;
          };
        }).clipboard
      : undefined;

  try {
    if (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof clipboardApi?.writeText === 'function'
    ) {
      await clipboardApi.writeText(text);
      return true;
    }
  } catch (clipboardError) {
    console.warn('Modern clipboard kullanılamadı, fallback deneniyor:', clipboardError);
  }

  try {
    if (typeof document === 'undefined') {
      return false;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    return copied;
  } catch (fallbackError) {
    console.error('Clipboard fallback başarısız:', fallbackError);
    return false;
  }
}

export default function CallerIdPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [callerDevices, setCallerDevices] = useState<CallerDevice[]>([]);
  const [callerEvents, setCallerEvents] = useState<CallerEvent[]>([]);
  const [isLoadingCallerEvents, setIsLoadingCallerEvents] = useState(false);
  const [updatingCallerEventId, setUpdatingCallerEventId] = useState<string | null>(null);
  const [callerEventsMessage, setCallerEventsMessage] = useState('');
  const [callerDeviceName, setCallerDeviceName] = useState('Demo Android Caller ID');
  const [callerDeviceBranchId, setCallerDeviceBranchId] = useState('');
  const [newCallerDeviceKey, setNewCallerDeviceKey] = useState('');
  const [callerDeviceMessage, setCallerDeviceMessage] = useState('');
  const [isLoadingCallerDevices, setIsLoadingCallerDevices] = useState(false);
  const [isSavingCallerDevice, setIsSavingCallerDevice] = useState(false);
  const [updatingCallerDeviceId, setUpdatingCallerDeviceId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [branchId, setBranchId] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [total, setTotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [note, setNote] = useState('');

  const [orderCodePreview, setOrderCodePreview] = useState('ORD-1');
  const [lastOrderCode, setLastOrderCode] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadOrdersForCode(token: string) {
    const response = await fetch('/api/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await readJson(response);

    if (!response.ok) {
      return [];
    }

    const orders = normalizeOrders(data);
    setOrders(orders);
    setOrderCodePreview(getNextOrderCode(orders));

    return orders;
  }


  async function loadCallerEvents(tokenArg?: string) {
    const token = tokenArg || localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoadingCallerEvents(true);
    setCallerEventsMessage('');

    try {
      const response = await fetch('/api/caller-events', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Çağrı geçmişi alınamadı.');
      }

      setCallerEvents(normalizeCallerEvents(data));
    } catch (requestError) {
      setCallerEventsMessage(
        requestError instanceof Error ? requestError.message : 'Çağrı geçmişi alınamadı.',
      );
    } finally {
      setIsLoadingCallerEvents(false);
    }
  }

  async function markCallerEventSeen(event: CallerEvent) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setUpdatingCallerEventId(event.id);
    setCallerEventsMessage('');

    try {
      const response = await fetch(`/api/caller-events/${event.id}/seen`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(typeof data?.message === 'string' ? data.message : 'Çağrı görüldü yapılamadı.');
      }

      setCallerEvents((currentEvents) =>
        currentEvents.map((currentEvent) =>
          currentEvent.id === event.id
            ? {
                ...currentEvent,
                status: data?.status || 'SEEN',
                seenAt: data?.seenAt || new Date().toISOString(),
              }
            : currentEvent,
        ),
      );
      setCallerEventsMessage('Çağrı görüldü olarak işaretlendi.');
    } catch (requestError) {
      setCallerEventsMessage(
        requestError instanceof Error ? requestError.message : 'Çağrı görüldü yapılamadı.',
      );
    } finally {
      setUpdatingCallerEventId(null);
    }
  }

  function startOrderFromCallerEvent(event: CallerEvent) {
    const phone = event.phone || '';
    const phoneKey = getComparablePhone(phone);
    const latestOrderForCaller =
      phoneKey.length >= 7
        ? sortNewestOrders(orders).find((order) => getComparablePhone(order.customerPhone) === phoneKey)
        : null;

    setCustomerPhone(phone);
    setCustomerName(event.customerName || latestOrderForCaller?.customerName || '');
    setCustomerAddress(latestOrderForCaller?.customerAddress || '');
    setPaymentMethod(toPaymentMethod(String(latestOrderForCaller?.paymentMethod || 'CASH')));

    if (latestOrderForCaller?.total) {
      setTotal(String(latestOrderForCaller.total));
    }

    setNote(
      latestOrderForCaller?.code
        ? `${latestOrderForCaller.code} çağrı geçmişinden forma aktarıldı.`
        : 'Caller ID çağrı geçmişinden forma aktarıldı.',
    );

    setSuccess('Çağrı bilgileri sipariş formuna aktarıldı.');
    setError('');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      return;
    }

    loadCallerEvents(token);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    async function loadInitialData() {
      try {
        const [branchesResponse] = await Promise.all([
          fetch('/api/branches', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          loadOrdersForCode(token as string),
        ]);

        const branchesData = await readJson(branchesResponse);

        if (!branchesResponse.ok) {
          setError(branchesData?.message || 'Şubeler yüklenemedi.');
          return;
        }

        const safeBranches = Array.isArray(branchesData) ? branchesData : [];

        setBranches(safeBranches);
        setBranchId(safeBranches[0]?.id || '');
      } catch {
        setError('CALLER ID verileri yüklenirken hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [router]);

  const customerPhoneKey = getComparablePhone(customerPhone);
  const customerHistory =
    customerPhoneKey.length >= 7
      ? sortNewestOrders(
          orders.filter((order) => {
            const orderPhoneKey = getComparablePhone(order.customerPhone);

            return Boolean(orderPhoneKey) && orderPhoneKey === customerPhoneKey;
          }),
        )
      : [];

  const latestCustomerOrder = customerHistory[0];
  const customerTotalSpent = customerHistory.reduce((sum, order) => {
    const orderTotal = Number(order.total || 0);

    return Number.isFinite(orderTotal) ? sum + orderTotal : sum;
  }, 0);

  function applyLatestCustomerInfo() {
    if (!latestCustomerOrder) {
      return;
    }

    setOrderType('DELIVERY');

    if (latestCustomerOrder.customerName) {
      setCustomerName(latestCustomerOrder.customerName);
    }

    if (latestCustomerOrder.customerPhone) {
      setCustomerPhone(latestCustomerOrder.customerPhone);
    }

    if (latestCustomerOrder.customerAddress) {
      setCustomerAddress(latestCustomerOrder.customerAddress);
    }

    if (latestCustomerOrder.paymentMethod) {
      setPaymentMethod(toPaymentMethod(String(latestCustomerOrder.paymentMethod)));
    }

    if (latestCustomerOrder.note) {
      setNote(latestCustomerOrder.note);
    }

    setSuccess('Müşterinin son sipariş bilgileri forma aktarıldı.');
  }

  function simulateIncomingCall() {
    const existingCustomer = sortNewestOrders(orders).find((order) => order.customerPhone);

    setOrderType('DELIVERY');
    setTableNumber('');

    if (existingCustomer) {
      setCustomerName(existingCustomer.customerName || 'Kayıtlı Müşteri');
      setCustomerPhone(existingCustomer.customerPhone || '0532 000 11 22');
      setCustomerAddress(existingCustomer.customerAddress || '');
      setPaymentMethod(toPaymentMethod(String(existingCustomer.paymentMethod || 'CASH')));
      setNote(existingCustomer.note || '');
      setSuccess('Kayıtlı müşteriden gelen arama simüle edildi.');
      return;
    }

    setCustomerName('Demo Müşteri');
    setCustomerPhone('0532 000 11 22');
    setCustomerAddress('Demo Mahallesi, Demo Sokak No: 12');
    setPaymentMethod('CASH');
    setNote('Demo arama simülasyonu.');
    setTotal((currentTotal) => currentTotal || '250');
    setSuccess('Demo gelen arama simüle edildi. Bu numarayla sipariş oluşturunca müşteri geçmişi oluşur.');
  }

  async function loadCallerDevices() {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoadingCallerDevices(true);

    try {
      const response = await fetch('/api/caller-devices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.ok ? await response.json() : [];
      setCallerDevices(Array.isArray(data) ? data : []);
    } catch {
      setCallerDeviceMessage('Caller ID cihaz listesi alınamadı.');
    } finally {
      setIsLoadingCallerDevices(false);
    }
  }

  async function createCallerDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    if (!callerDeviceName.trim()) {
      setCallerDeviceMessage('Cihaz adı zorunludur.');
      return;
    }

    setIsSavingCallerDevice(true);
    setCallerDeviceMessage('');
    setNewCallerDeviceKey('');

    try {
      const response = await fetch('/api/caller-devices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: callerDeviceName.trim(),
          branchId: callerDeviceBranchId || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Caller ID cihaz anahtarı oluşturulamadı.');
      }

      setNewCallerDeviceKey(data.deviceKey || '');
      setCallerDeviceMessage(data.message || 'Caller ID cihazı oluşturuldu.');
      await loadCallerDevices();
    } catch (createError) {
      setCallerDeviceMessage(
        createError instanceof Error
          ? createError.message
          : 'Caller ID cihazı oluşturulurken hata oluştu.',
      );
    } finally {
      setIsSavingCallerDevice(false);
    }
  }

  async function toggleCallerDevice(device: CallerDevice) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setUpdatingCallerDeviceId(device.id);
    setCallerDeviceMessage('');

    try {
      const action = device.isActive ? 'deactivate' : 'activate';

      const response = await fetch(`/api/caller-devices/${device.id}/${action}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || 'Caller ID cihaz durumu güncellenemedi.');
      }

      setCallerDeviceMessage(device.isActive ? 'Caller ID cihazı pasife alındı.' : 'Caller ID cihazı aktife alındı.');
      await loadCallerDevices();
    } catch (toggleError) {
      setCallerDeviceMessage(
        toggleError instanceof Error
          ? toggleError.message
          : 'Caller ID cihaz durumu güncellenirken hata oluştu.',
      );
    } finally {
      setUpdatingCallerDeviceId(null);
    }
  }

  useEffect(() => {
    loadCallerDevices();
  }, []);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    const numericTotal = Number(total.replace(',', '.'));

    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      setError('Geçerli bir toplam tutar gir.');
      return;
    }

    if (orderType === 'TABLE' && !tableNumber.trim()) {
      setError('Masa siparişi için masa numarası gir.');
      return;
    }

    if (orderType === 'DELIVERY' && !customerPhone.trim()) {
      setError('Paket sipariş için telefon numarası gir.');
      return;
    }

    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: branchId || null,
          type: orderType,
          tableNumber: orderType === 'TABLE' ? tableNumber.trim() : null,
          total: numericTotal,
          paymentMethod,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          customerAddress: orderType === 'DELIVERY' ? customerAddress.trim() || null : null,
          note: note.trim() || null,
          status: 'PENDING',
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        setError(data?.message || 'Sipariş oluşturulamadı.');
        return;
      }

      const refreshedOrders = await loadOrdersForCode(token);
      const createdOrderCode = extractOrderCode(data) || getNewestOrderCode(refreshedOrders) || orderCodePreview;

      setLastOrderCode(createdOrderCode);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setTotal('');
      setPaymentMethod('CASH');
      setNote('');
      setSuccess(`${createdOrderCode} oluşturuldu ve operasyon ekranına düştü.`);
    } catch {
      setError('Sipariş oluşturulurken hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-950">
        <p className="text-lg font-semibold">CALLER ID yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-600">
                Telefon Siparişi
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950">CALLER ID</h1>
              <p className="mt-2 text-sm text-slate-500">
                Telefonla gelen siparişleri buradan oluştur. Sipariş kodu sistem tarafından otomatik verilir.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Ana Sayfa
              </button>

              <button
                type="button"
                onClick={() => router.push('/dashboard/orders/history')}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Geçmiş Siparişler
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-700">
              Sıradaki Sipariş Kodu
            </p>
            <p className="mt-2 text-4xl font-black text-cyan-900">{lastOrderCode || orderCodePreview}</p>
            <p className="mt-2 text-xs font-bold text-cyan-700">
              Sipariş oluşturulduğunda bu kod operasyon ekranında da görünür.
            </p>
          </div>
        </header>

        {error ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700 shadow-sm">
            {success}
          </div>
        ) : null}

        {lastOrderCode ? (
          <div className="mb-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
              Oluşturulan Sipariş Kodu
            </p>
            <p className="mt-2 text-4xl font-black text-cyan-900">{lastOrderCode}</p>
          </div>
        ) : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-indigo-700">Caller ID</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">Gelen Çağrı Geçmişi</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
                Cihazdan veya manuel event&apos;ten gelen son aramaları takip et. Numara üzerinden sipariş formunu hızlı başlatabilirsin.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadCallerEvents()}
              disabled={isLoadingCallerEvents}
              className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-800 shadow-sm transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingCallerEvents ? 'Yükleniyor...' : 'Çağrıları Yenile'}
            </button>
          </div>

          {callerEventsMessage ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">
              {callerEventsMessage}
            </div>
          ) : null}

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            {callerEvents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Telefon</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Müşteri</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Kaynak</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Durum</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Geliş</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Görüldü</th>
                      <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.18em]">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {callerEvents.slice(0, 20).map((event) => {
                      const isNew = event.status !== 'SEEN' && !event.seenAt;
                      const sourceLabel = event.source || event.payload?.deviceName || 'Caller ID';

                      return (
                        <tr key={event.id} className={isNew ? 'bg-amber-50/70' : 'transition hover:bg-slate-50'}>
                          <td className="px-4 py-3 font-black text-slate-950">{event.phone || '-'}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{event.customerName || 'Yeni müşteri'}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{sourceLabel}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${
                                isNew
                                  ? 'border-amber-200 bg-amber-100 text-amber-800'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isNew ? 'Yeni' : 'Görüldü'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">{formatDate(event.receivedAt)}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{formatDate(event.seenAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {isNew ? (
                                <button
                                  type="button"
                                  onClick={() => markCallerEventSeen(event)}
                                  disabled={updatingCallerEventId === event.id}
                                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingCallerEventId === event.id ? 'İşleniyor...' : 'Görüldü Yap'}
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => startOrderFromCallerEvent(event)}
                                className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
                              >
                                Sipariş Başlat
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm font-black text-slate-900">
                  {isLoadingCallerEvents ? 'Çağrılar yükleniyor...' : 'Henüz çağrı geçmişi yok'}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Cihazdan event geldiğinde burada listelenir.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-700">Gelen Arama</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">Telefon müşteri geçmişi</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Telefon numarası yazıldığında aynı numaraya ait eski siparişler burada görünür.
              </p>
            </div>

            <button
              type="button"
              onClick={simulateIncomingCall}
              className="rounded-2xl border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-black text-sky-800 shadow-sm transition hover:bg-sky-100"
            >
              Gelen Arama Simüle Et
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Arayan Numara</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{customerPhone || '-'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {customerPhoneKey.length >= 7 ? `${customerHistory.length} geçmiş sipariş bulundu` : 'Geçmiş için telefon gir.'}
              </p>
            </div>

            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Müşteri Özeti</p>
              <p className="mt-2 text-2xl font-black text-emerald-900">
                {latestCustomerOrder?.customerName || customerName || 'Yeni müşteri'}
              </p>
              <p className="mt-2 text-sm font-semibold text-emerald-700">
                Toplam geçmiş harcama: {formatMoney(customerTotalSpent)}
              </p>
            </div>

            <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Son Sipariş</p>
              <p className="mt-2 text-2xl font-black text-cyan-900">{latestCustomerOrder?.code || '-'}</p>
              <p className="mt-2 text-sm font-semibold text-cyan-700">
                {latestCustomerOrder ? `${formatDate(latestCustomerOrder.createdAt)} • ${formatMoney(latestCustomerOrder.total)}` : 'Henüz kayıt yok'}
              </p>
            </div>
          </div>

          {latestCustomerOrder ? (
            <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-950">Son müşteri bilgileri</p>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700">
                      <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Adres</span>
                      {latestCustomerOrder.customerAddress || '-'}
                    </p>
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700">
                      <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ödeme</span>
                      {getPaymentLabel(String(latestCustomerOrder.paymentMethod || ''))}
                    </p>
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700 md:col-span-2">
                      <span className="block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Not</span>
                      {latestCustomerOrder.note || '-'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyLatestCustomerInfo}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] transition hover:bg-emerald-600"
                >
                  Bilgileri Forma Aktar
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Kod</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Tip</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Ödeme</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Toplam</th>
                      <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em]">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {customerHistory.slice(0, 5).map((order) => (
                      <tr key={order.id || order.code} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-black text-slate-950">{order.code || '-'}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{getOrderTypeLabel(String(order.type || ''))}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{getPaymentLabel(String(order.paymentMethod || ''))}</td>
                        <td className="px-4 py-3 font-black text-slate-950">{formatMoney(order.total)}</td>
                        <td className="px-4 py-3 font-bold text-slate-700">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Bu telefon için geçmiş sipariş bulunamadı. İlk sipariş oluşturulduktan sonra müşteri kartı otomatik oluşur.
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <div className="mb-6">
            <section className="mb-6 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-600">Caller ID</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Caller ID Cihaz Yönetimi</h2>
                <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
                  Android uygulama, fiziksel Caller ID cihazı veya santral bu cihaz anahtarıyla arama event’i gönderebilir.
                  Anahtar sadece oluşturulduğu anda tam görünür.
                </p>
              </div>

              <button
                type="button"
                onClick={loadCallerDevices}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Cihazları Yenile
              </button>
            </div>

            <form onSubmit={createCallerDevice} className="mt-5 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Cihaz Adı</span>
                <input
                  value={callerDeviceName}
                  onChange={(event) => setCallerDeviceName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Demo Android Caller ID"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Şube</span>
                <select
                  value={callerDeviceBranchId}
                  onChange={(event) => setCallerDeviceBranchId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="">Tüm şubeler / şubesiz cihaz</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={isSavingCallerDevice || !callerDeviceName.trim()}
                className="self-end rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingCallerDevice ? 'Oluşturuluyor...' : 'Cihaz Anahtarı Oluştur'}
              </button>
            </form>

            {callerDeviceMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
                {callerDeviceMessage}
              </div>
            ) : null}

            {newCallerDeviceKey ? (
              <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Yeni cihaz anahtarı</p>
                <p className="mt-1 text-sm font-bold text-amber-900">
                  Bu anahtar sadece bir kez gösterilir. Android uygulamaya veya cihaz kurulumuna kopyala.
                </p>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <code className="break-all rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-950">
                    {newCallerDeviceKey}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await copyTextToClipboard(newCallerDeviceKey);
                      setCallerDeviceMessage(
                        copied
                          ? 'Cihaz anahtarı kopyalandı.'
                          : 'Kopyalama tarayıcı tarafından engellendi. Anahtarı elle seçip kopyalayabilirsin.',
                      );
                    }}
                    className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700"
                  >
                    Kopyala
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3">
              {isLoadingCallerDevices ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-500">
                  Caller ID cihazları yükleniyor...
                </div>
              ) : callerDevices.length > 0 ? (
                callerDevices.map((device) => {
                  const branchName =
                    branches.find((branch) => branch.id === device.branchId)?.name || 'Tüm şubeler / şubesiz';

                  return (
                    <div
                      key={device.id}
                      className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-950">{device.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{branchName}</p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Anahtar</p>
                        <p className="mt-1 font-mono text-sm font-black text-slate-700">{device.keyPreview}</p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Son Bağlantı</p>
                        <p className="mt-1 text-sm font-black text-slate-700">
                          {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('tr-TR') : 'Henüz bağlantı yok'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${
                            device.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-100 text-slate-500'
                          }`}
                        >
                          {device.isActive ? 'Aktif' : 'Pasif'}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleCallerDevice(device)}
                          disabled={updatingCallerDeviceId === device.id}
                          className={`rounded-2xl px-4 py-2 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            device.isActive
                              ? 'bg-red-700 hover:bg-red-800'
                              : 'bg-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          {updatingCallerDeviceId === device.id
                            ? 'Güncelleniyor...'
                            : device.isActive
                              ? 'Pasife Al'
                              : 'Aktife Al'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                  Henüz Caller ID cihazı yok. Android uygulama veya fiziksel cihaz bağlamak için cihaz anahtarı oluştur.
                </div>
              )}
            </div>
          </section>

          <h2 className="text-xl font-black text-slate-950">Yeni Telefon Siparişi</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sipariş oluşturulduktan sonra Yeni Siparişler operasyon bölümüne düşer.
            </p>
          </div>

          <form onSubmit={createOrder} className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-black text-slate-800">
              Sipariş Kodu
              <input
                value={lastOrderCode || orderCodePreview}
                readOnly
                className="mt-2 w-full cursor-not-allowed rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 font-black text-cyan-900 shadow-inner outline-none"
              />
            </label>

            <label className="block text-sm font-black text-slate-800">
              Şube
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Şube seçilmedi</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-black text-slate-800">
              Sipariş Tipi
              <select
                value={orderType}
                onChange={(event) => setOrderType(event.target.value as OrderType)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                {ORDER_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            {orderType === 'TABLE' ? (
              <label className="block text-sm font-black text-slate-800">
                Masa No
                <input
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Örn: 5"
                />
              </label>
            ) : null}

            <label className="block text-sm font-black text-slate-800">
              Müşteri Adı
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Müşteri adı"
              />
            </label>

            <label className="block text-sm font-black text-slate-800">
              Telefon
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="05xx xxx xx xx"
              />
            </label>

            {orderType === 'DELIVERY' ? (
              <label className="block text-sm font-black text-slate-800 md:col-span-2">
                Adres
                <input
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Teslimat adresi"
                />
              </label>
            ) : null}

            <label className="block text-sm font-black text-slate-800">
              Toplam Tutar
              <input
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Örn: 250"
              />
            </label>

            <label className="block text-sm font-black text-slate-800">
              Ödeme Tipi
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-black text-slate-800 md:col-span-2 xl:col-span-3">
              Not
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Sipariş notu"
              />
            </label>

            <div className="md:col-span-2 xl:col-span-3">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-emerald-500 px-6 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Oluşturuluyor...' : 'Sipariş Oluştur'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
