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
  orderId?: string | null;
  orderCode?: string | null;
  convertedAt?: string | null;
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


type CallerIdPanelTab = 'CUSTOMERS' | 'CALLS' | 'MISSED' | 'CONVERTED' | 'DEVICES';

type CustomerDirectoryRow = {
  key: string;
  name: string;
  phone: string;
  address: string;
  lastOrderCode: string;
  lastOrderAt?: string | null;
  lastPaymentMethod?: string | null;
  lastNote?: string | null;
  totalSpent: number;
  orderCount: number;
  callCount: number;
  latestCallAt?: string | null;
  convertedOrderCode?: string | null;
  status: string;
};

function getTimeValue(value?: string | null) {
  const time = new Date(value || '').getTime();

  return Number.isFinite(time) ? time : 0;
}

function buildCustomerDirectory(orders: OrderLite[], callerEvents: CallerEvent[]): CustomerDirectoryRow[] {
  const rows = new Map<string, CustomerDirectoryRow>();

  function ensureRow(phone: string, fallbackName?: string | null) {
    const phoneKey = getComparablePhone(phone);

    if (!phoneKey || phoneKey.length < 7) {
      return null;
    }

    const current = rows.get(phoneKey);

    if (current) {
      if ((!current.name || current.name === 'Yeni müşteri') && fallbackName) {
        current.name = fallbackName;
      }

      return current;
    }

    const row: CustomerDirectoryRow = {
      key: phoneKey,
      name: fallbackName || 'Yeni müşteri',
      phone,
      address: '',
      lastOrderCode: '',
      lastOrderAt: null,
      lastPaymentMethod: null,
      lastNote: null,
      totalSpent: 0,
      orderCount: 0,
      callCount: 0,
      latestCallAt: null,
      convertedOrderCode: null,
      status: 'Sadece arama',
    };

    rows.set(phoneKey, row);

    return row;
  }

  for (const order of sortNewestOrders(orders)) {
    const row = ensureRow(order.customerPhone || '', order.customerName || null);

    if (!row) {
      continue;
    }

    row.orderCount += 1;

    const total = Number(order.total || 0);

    if (Number.isFinite(total)) {
      row.totalSpent += total;
    }

    const orderTime = getTimeValue(order.createdAt);
    const currentLastOrderTime = getTimeValue(row.lastOrderAt);

    if (!row.lastOrderAt || orderTime >= currentLastOrderTime) {
      row.name = order.customerName || row.name || 'Yeni müşteri';
      row.phone = order.customerPhone || row.phone;
      row.address = order.customerAddress || row.address;
      row.lastOrderCode = order.code || row.lastOrderCode;
      row.lastOrderAt = order.createdAt || row.lastOrderAt;
      row.lastPaymentMethod = order.paymentMethod || row.lastPaymentMethod;
      row.lastNote = order.note || row.lastNote;
    }
  }

  for (const event of callerEvents) {
    const row = ensureRow(event.phone || '', event.customerName || null);

    if (!row) {
      continue;
    }

    row.callCount += 1;

    const callTime = getTimeValue(event.receivedAt);
    const currentCallTime = getTimeValue(row.latestCallAt);

    if (!row.latestCallAt || callTime >= currentCallTime) {
      row.latestCallAt = event.receivedAt || row.latestCallAt;
      row.name = event.customerName || row.name || 'Yeni müşteri';
      row.phone = event.phone || row.phone;
    }

    if (event.orderCode || event.convertedAt || event.orderId) {
      row.convertedOrderCode = event.orderCode || row.convertedOrderCode || 'Siparişe dönüştü';
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      status: row.convertedOrderCode
        ? 'Siparişe dönüştü'
        : row.orderCount > 0
          ? 'Kayıtlı müşteri'
          : 'Sadece arama',
    }))
    .sort((first, second) => {
      const secondTime = Math.max(getTimeValue(second.latestCallAt), getTimeValue(second.lastOrderAt));
      const firstTime = Math.max(getTimeValue(first.latestCallAt), getTimeValue(first.lastOrderAt));

      return secondTime - firstTime;
    });
}

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DELIVERY', label: 'Paket' },
  { value: 'TABLE', label: 'Masa' },
  { value: 'TAKEAWAY', label: 'Gel-al' },
];


// __CALLER_ID_MENU_DISPLAY_V2_STEP2__
type PhoneOrderMenuCategory = {
  id: string;
  name: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

type PhoneOrderMenuChannelSetting = {
  channel: 'QR' | 'TABLE_SERVICE' | 'CALLER_ID' | 'MOBILE' | 'WHATSAPP';
  isEnabled?: boolean | null;
  customPrice?: string | number | null;
};

type PhoneOrderMenuItem = {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  category?: {
    id?: string | null;
    name?: string | null;
  } | null;
  price?: string | number | null;
  totalPrice?: string | number | null;
  channelSettings?: PhoneOrderMenuChannelSetting[];
  menuItemChannelSettings?: PhoneOrderMenuChannelSetting[];
  isActive?: boolean | null;
};

type PhoneOrderCartItem = {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string;
};

function getCallerIdChannelSetting(menuItem: PhoneOrderMenuItem) {
  const settings = Array.isArray(menuItem.channelSettings)
    ? menuItem.channelSettings
    : Array.isArray(menuItem.menuItemChannelSettings)
      ? menuItem.menuItemChannelSettings
      : [];

  return settings.find((setting) => setting.channel === 'CALLER_ID') || null;
}

function isPhoneOrderMenuItemEnabledForCallerId(menuItem: PhoneOrderMenuItem) {
  const callerIdSetting = getCallerIdChannelSetting(menuItem);

  if (callerIdSetting?.isEnabled === false) {
    return false;
  }

  return menuItem.isActive !== false;
}

function getPhoneOrderMenuItemPrice(menuItem: PhoneOrderMenuItem) {
  const callerIdSetting = getCallerIdChannelSetting(menuItem);
  const rawPrice = callerIdSetting?.customPrice ?? menuItem.totalPrice ?? menuItem.price ?? 0;
  const parsedPrice = Number(rawPrice);

  return Number.isFinite(parsedPrice) ? parsedPrice : 0;
}


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


function extractOrderId(data: any) {
  return String(data?.id || data?.order?.id || data?.data?.id || '').trim();
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
  const [isPhoneOrderStageOpen, setIsPhoneOrderStageOpen] = useState(false);
  const [showNewCustomerOrderSection, setShowNewCustomerOrderSection] = useState(false);
  const [phoneOrderMenuCategories, setPhoneOrderMenuCategories] = useState<PhoneOrderMenuCategory[]>([]);
  const [phoneOrderMenuItems, setPhoneOrderMenuItems] = useState<PhoneOrderMenuItem[]>([]);
  const [phoneOrderMenuCategoryId, setPhoneOrderMenuCategoryId] = useState('');
  const [phoneOrderCartItems, setPhoneOrderCartItems] = useState<PhoneOrderCartItem[]>([]);
  const [isLoadingPhoneOrderMenu, setIsLoadingPhoneOrderMenu] = useState(false);
  const [phoneOrderMenuMessage, setPhoneOrderMenuMessage] = useState('');


  const [orderCodePreview, setOrderCodePreview] = useState('ORD-1');
  const [lastOrderCode, setLastOrderCode] = useState('');
  const [activeCallerEventId, setActiveCallerEventId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [callerIdPanelTab, setCallerIdPanelTab] = useState<CallerIdPanelTab>('CUSTOMERS');
  const [customerDirectorySearch, setCustomerDirectorySearch] = useState('');
  function buildYeniMusteriHref(params: { phone?: string; name?: string; address?: string; callerEventId?: string }) {
    const query = new URLSearchParams();
    if (params.phone) query.set('phone', params.phone);
    if (params.name) query.set('name', params.name);
    if (params.address) query.set('address', params.address);
    if (params.callerEventId) query.set('callerEventId', params.callerEventId);
    const queryString = query.toString();
    return `/dashboard/caller-id/yenimusteri${queryString ? `?${queryString}` : ''}`;
  }

  function buildYeniMusteriHref(params: {
    phone?: string;
    name?: string;
    address?: string;
    callerEventId?: string;
  }) {
    const query = new URLSearchParams();

    if (params.phone) query.set('phone', params.phone);
    if (params.name) query.set('name', params.name);
    if (params.address) query.set('address', params.address);
    if (params.callerEventId) query.set('callerEventId', params.callerEventId);

    const queryString = query.toString();
    return `/dashboard/caller-id/yenimusteri${queryString ? `?${queryString}` : ''}`;
  }

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

  async function startOrderFromCallerEvent(event: CallerEvent) {
    const phone = event.phone || '';
    const phoneKey = getComparablePhone(phone);

    if (!phone.trim()) {
      setError('Çağrı telefon numarası bulunamadı.');
      return;
    }

    const latestOrderForCaller =
      phoneKey.length >= 7
        ? sortNewestOrders(orders).find((order) => getComparablePhone(order.customerPhone) === phoneKey)
        : undefined;

    let resolvedName = event.customerName || latestOrderForCaller?.customerName || '';
    let resolvedAddress = latestOrderForCaller?.customerAddress || '';

    try {
      const authToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('accessToken') || ''
          : '';

      if (authToken && phoneKey.length >= 7) {
        const response = await fetch(`/api/customers/by-phone/${encodeURIComponent(phone)}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const customer = await readJson(response);
          const addresses = Array.isArray(customer?.addresses) ? customer.addresses : [];
          const defaultAddress =
            addresses.find((address: any) => address?.isDefault) ||
            addresses[0] ||
            null;
          const recentOrders = Array.isArray(customer?.recentOrders) ? customer.recentOrders : [];
          const latestCustomerOrder = recentOrders[0];

          resolvedName = customer?.name || event.customerName || latestOrderForCaller?.customerName || '';
          resolvedAddress =
            defaultAddress?.fullAddress ||
            latestCustomerOrder?.customerAddress ||
            latestOrderForCaller?.customerAddress ||
            '';

          setSuccess('Kayıtlı müşteri bulundu ve sipariş formuna aktarıldı.');
        } else if (response.status === 404) {
          setSuccess('Yeni müşteri için çağrı bilgileri sipariş formuna aktarıldı.');
        } else {
          setSuccess('Çağrı bilgileri sipariş formuna aktarıldı. Müşteri sorgusu tamamlanamadı.');
        }
      } else {
        setSuccess('Çağrı bilgileri sipariş formuna aktarıldı.');
      }

      if (event.status !== 'SEEN' && !event.seenAt) {
        await markCallerEventSeen(event);
      }
    } catch (lookupError) {
      console.error('Caller ID müşteri bilgisi alınamadı:', lookupError);
      setSuccess('Çağrı bilgileri sipariş formuna aktarıldı.');
    }

    router.push(
      buildYeniMusteriHref({
        phone,
        name: resolvedName,
        address: resolvedAddress,
        callerEventId: event.id,
      }),
    );
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

  async function loadPhoneOrderMenu() {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoadingPhoneOrderMenu(true);
    setPhoneOrderMenuMessage('');

    try {
      const [categoriesResponse, itemsResponse] = await Promise.all([
        fetch('/api/menu/categories', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch('/api/menu/items', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
      ]);

      const categoriesData = await categoriesResponse.json().catch(() => []);
      const itemsData = await itemsResponse.json().catch(() => []);

      if (!categoriesResponse.ok) {
        throw new Error(categoriesData?.message || 'Menü kategorileri alınamadı.');
      }

      if (!itemsResponse.ok) {
        throw new Error(itemsData?.message || 'Menü ürünleri alınamadı.');
      }

      const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
      const safeItems = Array.isArray(itemsData) ? itemsData : [];

      const activeItems = safeItems.filter(isPhoneOrderMenuItemEnabledForCallerId);
      const activeCategoryIds = new Set(activeItems.map((item) => item.categoryId).filter(Boolean));
      const activeCategories = safeCategories.filter(
        (category) => category.isActive !== false && activeCategoryIds.has(category.id),
      );

      setPhoneOrderMenuCategories(activeCategories);
      setPhoneOrderMenuItems(activeItems);

      setPhoneOrderMenuCategoryId((currentCategoryId) => {
        if (currentCategoryId && activeCategories.some((category) => category.id === currentCategoryId)) {
          return currentCategoryId;
        }

        return activeCategories[0]?.id || '';
      });

      setPhoneOrderMenuMessage(
        activeItems.length > 0
          ? `${activeItems.length} menü ürünü yüklendi.`
          : 'Aktif menü ürünü bulunamadı.',
      );
    } catch (loadError) {
      setPhoneOrderMenuMessage(
        loadError instanceof Error ? loadError.message : 'Menü yüklenirken hata oluştu.',
      );
    } finally {
      setIsLoadingPhoneOrderMenu(false);
    }
  }

  // __CALLER_ID_CART_V2_STEP3__
  function getPhoneOrderCartTotal(cartItems: PhoneOrderCartItem[]) {
    return cartItems.reduce((sum, cartItem) => sum + cartItem.unitPrice * cartItem.quantity, 0);
  }

  function syncPhoneOrderCart(nextCartItems: PhoneOrderCartItem[]) {
    setPhoneOrderCartItems(nextCartItems);
    setTotal(getPhoneOrderCartTotal(nextCartItems).toFixed(2));
  }

  function addPhoneOrderMenuItemToCart(menuItem: PhoneOrderMenuItem) {
    const unitPrice = getPhoneOrderMenuItemPrice(menuItem);

    setPhoneOrderCartItems((currentCartItems) => {
      const existingCartItem = currentCartItems.find((cartItem) => cartItem.menuItemId === menuItem.id);

      const nextCartItems = existingCartItem
        ? currentCartItems.map((cartItem) =>
            cartItem.menuItemId === menuItem.id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem,
          )
        : [
            ...currentCartItems,
            {
              menuItemId: menuItem.id,
              name: menuItem.name,
              unitPrice,
              quantity: 1,
              note: '',
            },
          ];

      setTotal(getPhoneOrderCartTotal(nextCartItems).toFixed(2));
      return nextCartItems;
    });

    setPhoneOrderMenuMessage(`${menuItem.name} sepete eklendi.`);
  }

  function increasePhoneOrderCartItem(menuItemId: string) {
    const nextCartItems = phoneOrderCartItems.map((cartItem) =>
      cartItem.menuItemId === menuItemId
        ? { ...cartItem, quantity: cartItem.quantity + 1 }
        : cartItem,
    );

    syncPhoneOrderCart(nextCartItems);
  }

  function decreasePhoneOrderCartItem(menuItemId: string) {
    const nextCartItems = phoneOrderCartItems
      .map((cartItem) =>
        cartItem.menuItemId === menuItemId
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem,
      )
      .filter((cartItem) => cartItem.quantity > 0);

    syncPhoneOrderCart(nextCartItems);
  }

  function removePhoneOrderCartItem(menuItemId: string) {
    const nextCartItems = phoneOrderCartItems.filter((cartItem) => cartItem.menuItemId !== menuItemId);

    syncPhoneOrderCart(nextCartItems);
  }

  function updatePhoneOrderCartItemNote(menuItemId: string, noteValue: string) {
    setPhoneOrderCartItems((currentCartItems) =>
      currentCartItems.map((cartItem) =>
        cartItem.menuItemId === menuItemId ? { ...cartItem, note: noteValue } : cartItem,
      ),
    );
  }

  // __CALLER_ID_ORDER_STAGE_V2_STEP1_SAFE__
  function goToPhoneOrderStage() {
    if (orderType === 'DELIVERY' && !customerPhone.trim()) {
      setError('Siparişe geçmeden önce telefon numarası gir.');
      return;
    }

    setError('');
    setSuccess('Müşteri bilgisi hazır. Sipariş aşaması açıldı.');
    setIsPhoneOrderStageOpen(true);

    if (phoneOrderMenuItems.length === 0) {
      void loadPhoneOrderMenu();
    }

    setTimeout(() => {
      const formElement = document.getElementById('caller-id-menu-display') || document.getElementById('caller-id-order-form');

      formElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    if (!isPhoneOrderStageOpen) {
      setError('Önce müşteri bilgisini kontrol edip Siparişe Git butonuna bas.');
      return;
    }

    const numericTotal = Number(total.replace(',', '.'));

    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      setError('Geçerli bir toplam tutar gir.');
      return;
    }


    // __CALLER_ID_ORDER_ITEMS_STEP4_V2__
    const callerIdCartItemsPayload = phoneOrderCartItems.map((cartItem) => ({
      menuItemId: cartItem.menuItemId,
      quantity: cartItem.quantity,
      note: cartItem.note.trim() || null,
      selectedOptionIds: [],
    }));

    const finalOrderTotal =
      callerIdCartItemsPayload.length > 0 ? getPhoneOrderCartTotal(phoneOrderCartItems) : numericTotal;

    if (isPhoneOrderStageOpen && callerIdCartItemsPayload.length === 0) {
      setError('Sipariş oluşturmak için sepete en az bir ürün ekle.');
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
          channel: 'CALLER_ID',
          type: orderType,
          tableNumber: orderType === 'TABLE' ? tableNumber.trim() : null,
          total: finalOrderTotal,
          paymentMethod,
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          customerAddress: orderType === 'DELIVERY' ? customerAddress.trim() || null : null,
          note: note.trim() || null,
          items: callerIdCartItemsPayload,
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
      const createdOrderId = extractOrderId(data);

      let callerEventLinked = false;

      if (activeCallerEventId && createdOrderId) {
        try {
          const linkResponse = await fetch(`/api/caller-events/${activeCallerEventId}/converted`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId: createdOrderId,
              orderCode: createdOrderCode,
            }),
          });

          if (linkResponse.ok) {
            callerEventLinked = true;
            setActiveCallerEventId('');
            await loadCallerEvents(token);
          }
        } catch (callerLinkError) {
          console.error('Caller ID çağrı sipariş bağlantısı kurulamadı:', callerLinkError);
        }
      }

      setLastOrderCode(createdOrderCode);
      setTableNumber('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setTotal('');
      setPaymentMethod('CASH');
      setNote('');
      setIsPhoneOrderStageOpen(false);
      setPhoneOrderCartItems([]);
      setSuccess(callerEventLinked ? `${createdOrderCode} oluşturuldu ve Caller ID çağrısıyla eşleştirildi.` : `${createdOrderCode} oluşturuldu ve operasyon ekranına düştü.`);
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


  const customerDirectoryRows = buildCustomerDirectory(orders, callerEvents);
  const activeCallerDevices = callerDevices.filter((device) => device.isActive);
  const latestCallerDevice = [...callerDevices].sort((first, second) => {
    return getTimeValue(second.lastSeenAt || second.updatedAt || second.createdAt) - getTimeValue(first.lastSeenAt || first.updatedAt || first.createdAt);
  })[0];

  const pendingCallerEvents = callerEvents.filter((event) => event.status !== 'SEEN' && !event.seenAt);
  const convertedCallerEvents = callerEvents.filter((event) => event.orderId || event.orderCode || event.convertedAt);

  const customerDirectorySearchKey = customerDirectorySearch.trim().toLocaleLowerCase('tr-TR');
  const filteredCustomerDirectoryRows = customerDirectoryRows.filter((row) => {
    if (!customerDirectorySearchKey) {
      return true;
    }

    return [
      row.name,
      row.phone,
      row.address,
      row.lastOrderCode,
      row.status,
      row.convertedOrderCode || '',
    ]
      .join(' ')
      .toLocaleLowerCase('tr-TR')
      .includes(customerDirectorySearchKey);
  });

  const selectedCallerEvents =
    callerIdPanelTab === 'MISSED'
      ? pendingCallerEvents
      : callerIdPanelTab === 'CONVERTED'
        ? convertedCallerEvents
        : callerEvents;
  const sortedCallerEvents = [...callerEvents].sort((first, second) => {
    return getTimeValue(second.receivedAt) - getTimeValue(first.receivedAt);
  });
  const activeIncomingCall = [...pendingCallerEvents].sort((first, second) => {
    return getTimeValue(second.receivedAt) - getTimeValue(first.receivedAt);
  })[0] || sortedCallerEvents[0];
  const activeIncomingCallCustomer = activeIncomingCall
    ? customerDirectoryRows.find((row) => getComparablePhone(row.phone) === getComparablePhone(activeIncomingCall.phone))
    : null;
  const passiveDeviceCount = Math.max(callerDevices.length - activeCallerDevices.length, 0);

  function startOrderFromCustomerRow(row: CustomerDirectoryRow) {
    router.push(
      buildYeniMusteriHref({
        phone: row.phone || '',
        name: row.name === 'Yeni müşteri' ? '' : row.name,
        address: row.address || '',
      }),
    );
  }

  function startNewCustomerOrder() {
    router.push('/dashboard/caller-id/yenimusteri');
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

            {/* __CALLER_ID_NEW_CUSTOMER_BUTTON_MOVED_TO_HEADER_V2__ */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
{/* __CALLER_ID_NEW_CUSTOMER_LINKS_TO_SEPARATE_ROUTE__ */}
                <a
                  href="/dashboard/caller-id/yenimusteri"
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-800 transition hover:bg-sky-100"
                >
                  Yeni Müşteri
                </a>
            </div>
              <p className="mt-2 text-sm text-slate-500">

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
                <a
                  href="/dashboard/caller-id/cagrilar"
                  className="caller-id-top-calls-button rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Çağrılar
                </a>
            </div>
          </div>

          <div className="hidden hidden-next-order-code-card mt-6 rounded-[24px] border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
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

        <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <article className="rounded-[28px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">Canlı Gelen Çağrı</p>
            {activeIncomingCall ? (
              <>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">{activeIncomingCall.phone || '-'}</h2>
                <p className="mt-2 text-sm font-bold text-slate-600">
                  {activeIncomingCall.customerName || activeIncomingCallCustomer?.name || 'Yeni müşteri'} • {formatDate(activeIncomingCall.receivedAt)}
                </p>
                <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${activeIncomingCall.status !== 'SEEN' && !activeIncomingCall.seenAt ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {activeIncomingCall.orderCode ? `Siparişe dönüştü: ${activeIncomingCall.orderCode}` : activeIncomingCall.status !== 'SEEN' && !activeIncomingCall.seenAt ? 'Yeni çağrı' : 'Görüldü'}
                </span>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startOrderFromCallerEvent(activeIncomingCall)} className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-600">
                    Telefon Siparişi Başlat
                  </button>
                  <a href="/dashboard/caller-id/yenimusteri" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-50">
                    Yeni Telefon Siparişi
                  </a>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5">
                <p className="text-sm font-black text-slate-900">Bekleyen canlı çağrı yok</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Yeni çağrı geldiğinde operatör önceliğiyle burada gösterilecek.</p>
              </div>
            )}
          </article>
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Müşteri Zekâ Kartı</p>
            {activeIncomingCallCustomer ? (
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-lg font-black text-slate-950">{activeIncomingCallCustomer.name || 'Yeni müşteri'}</p>
                <p className="font-bold text-slate-700">{activeIncomingCallCustomer.phone || '-'}</p>
                <p className="text-slate-600">{activeIncomingCallCustomer.orderCount > 0 ? 'Geri dönen müşteri' : 'Yeni müşteri'}</p>
                <p className="text-slate-600">Son sipariş: {activeIncomingCallCustomer.lastOrderAt ? formatDate(activeIncomingCallCustomer.lastOrderAt) : 'Henüz sipariş yok'}</p>
                <p className="text-slate-600">Sipariş sayısı: {activeIncomingCallCustomer.orderCount}</p>
                <p className="text-slate-600">Toplam harcama: {formatMoney(activeIncomingCallCustomer.totalSpent)}</p>
                <p className="text-slate-600">Son adres: {activeIncomingCallCustomer.address || 'Adres bulunamadı'}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                Eşleşen kayıtlı müşteri bulunamadı. Yeni telefon siparişiyle kayıt başlatabilirsiniz.
              </div>
            )}
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <a href="/dashboard/caller-id/yenimusteri" className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">Yeni Telefon Siparişi</a>
          <a href="/dashboard/caller-id/cagrilar" className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">Çağrı Geçmişi</a>
          <a href="/dashboard/orders/history" className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">Müşteri Siparişleri</a>
          <a href="/dashboard/settings/cagrilar" className="rounded-3xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50">Caller ID Cihazları</a>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="text-lg font-black text-slate-950">Son Çağrılar</h3>
            </div>
            {isLoadingCallerEvents ? (
              <p className="px-5 py-8 text-sm font-bold text-slate-600">Çağrılar yükleniyor...</p>
            ) : callerEventsMessage ? (
              <p className="px-5 py-8 text-sm font-bold text-red-600">{callerEventsMessage}</p>
            ) : sortedCallerEvents.length === 0 ? (
              <p className="px-5 py-8 text-sm font-bold text-slate-500">Henüz çağrı kaydı yok.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {sortedCallerEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="grid gap-2 px-5 py-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                    <p className="font-black text-slate-900">{event.phone || '-'}</p>
                    <p className="text-sm font-bold text-slate-600">{event.customerName || 'Yeni müşteri'}</p>
                    <p className="text-xs font-bold text-slate-500">{formatDate(event.receivedAt)}</p>
                    <button type="button" onClick={() => startOrderFromCallerEvent(event)} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-black text-white hover:bg-sky-600">Siparişe Git</button>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Cihaz Sağlığı</p>
            <p className={`mt-3 text-sm font-black ${activeCallerDevices.length > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {activeCallerDevices.length > 0 ? 'Aktif Caller ID cihazı çevrimiçi' : 'Uyarı: Aktif Caller ID cihazı yok'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-black uppercase text-emerald-700">Aktif</p>
                <p className="mt-1 text-2xl font-black text-emerald-900">{activeCallerDevices.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-600">Pasif</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{passiveDeviceCount}</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              Son sinyal: {latestCallerDevice ? formatDate(latestCallerDevice.lastSeenAt || latestCallerDevice.updatedAt || latestCallerDevice.createdAt) : 'Henüz sinyal yok'}
            </p>
          </article>
        </section>

        <section id="caller-id-calls-panel" className="mb-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">
                  CALLER ID / Müşteri Paneli
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  Müşteri listesi ve hızlı sipariş ekranı
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Telefon numarası, müşteri adı veya adres ile arama yap. Müşteriyi bulup tek tıkla telefon siparişi başlat.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">

                <button
                  type="button"
                  onClick={simulateIncomingCall}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                >
                  Test Araması
                </button>
                <button
                  type="button"
                  onClick={() => loadCallerEvents()}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100"
                >
                  Çağrıları Yenile
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
              <label className="block">
                <span className="sr-only">Müşteri ara</span>
                <input
                  value={customerDirectorySearch}
                  onChange={(event) => setCustomerDirectorySearch(event.target.value)}
                  placeholder="Müşteri adı, telefon, adres veya sipariş kodu ara..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Cihaz Durumu</p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {activeCallerDevices.length > 0 ? 'Android Caller ID bağlı' : 'Aktif cihaz bekleniyor'}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {latestCallerDevice
                    ? `${latestCallerDevice.name} • Son sinyal: ${formatDate(latestCallerDevice.lastSeenAt || latestCallerDevice.updatedAt || latestCallerDevice.createdAt)}`
                    : 'Henüz cihaz sinyali yok'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { key: 'CUSTOMERS' as CallerIdPanelTab, label: 'Tüm Müşteriler', count: customerDirectoryRows.length },
                { key: 'CALLS' as CallerIdPanelTab, label: 'Gelen Çağrılar', count: callerEvents.length },
                { key: 'MISSED' as CallerIdPanelTab, label: 'Kaçan / Görülmeyen', count: pendingCallerEvents.length },
                { key: 'CONVERTED' as CallerIdPanelTab, label: 'Siparişe Dönüşenler', count: convertedCallerEvents.length },
                { key: 'DEVICES' as CallerIdPanelTab, label: 'Cihazlar', count: callerDevices.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCallerIdPanelTab(tab.key)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                    callerIdPanelTab === tab.key
                      ? 'border-sky-300 bg-sky-50 text-sky-800 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {callerIdPanelTab === 'CUSTOMERS' ? (
            <div className="p-4 sm:p-5">
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Müşteri</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{customerDirectoryRows.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Kayıtlı Siparişli</p>
                  <p className="mt-2 text-2xl font-black text-emerald-900">
                    {customerDirectoryRows.filter((row) => row.orderCount > 0).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Görülmeyen Çağrı</p>
                  <p className="mt-2 text-2xl font-black text-orange-900">{pendingCallerEvents.length}</p>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Dönüşen Çağrı</p>
                  <p className="mt-2 text-2xl font-black text-violet-900">{convertedCallerEvents.length}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-[1120px] w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Müşteri</th>
                        <th className="px-4 py-3">Telefon</th>
                        <th className="px-4 py-3">Son Adres</th>
                        <th className="px-4 py-3">Son Sipariş</th>
                        <th className="px-4 py-3">Çağrı</th>
                        <th className="px-4 py-3">Durum</th>
                        <th className="px-4 py-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredCustomerDirectoryRows.slice(0, 12).map((row) => (
                        <tr key={row.key} className="align-top transition hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-950">{row.name || 'Yeni müşteri'}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              Toplam harcama: {formatMoney(row.totalSpent)}
                            </p>
                          </td>
                          <td className="px-4 py-4 font-bold text-slate-700">{row.phone || '-'}</td>
                          <td className="px-4 py-4 text-slate-600">
                            <span className="line-clamp-2">{row.address || 'Adres yok'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-800">{row.lastOrderCode || '-'}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {row.lastOrderAt ? formatDate(row.lastOrderAt) : 'Henüz sipariş yok'}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-800">{row.callCount}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {row.latestCallAt ? formatDate(row.latestCallAt) : 'Çağrı yok'}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                              row.convertedOrderCode
                                ? 'border-violet-200 bg-violet-50 text-violet-800'
                                : row.orderCount > 0
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startOrderFromCustomerRow(row)}
                                className="rounded-2xl bg-sky-500 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-sky-600"
                              >
                                Sipariş Başlat
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomerDirectorySearch(row.phone);
                                  setCallerIdPanelTab('CALLS');
                                }}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                              >
                                Çağrılar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredCustomerDirectoryRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center">
                            <p className="text-lg font-black text-slate-900">Müşteri bulunamadı</p>
                            <p className="mt-2 text-sm font-bold text-slate-500">
                              Arama kriterini değiştir veya yeni müşteri için sipariş formunu başlat.
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredCustomerDirectoryRows.length > 12 ? (
                <p className="mt-3 text-center text-xs font-bold text-slate-500">
                  İlk 12 kayıt gösteriliyor. Daha net sonuç için arama kutusunu kullan.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              {callerIdPanelTab === 'DEVICES' ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-xl font-black text-slate-950">Caller ID cihaz özeti</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Aktif cihaz: {activeCallerDevices.length} / Toplam cihaz: {callerDevices.length}. Detaylı cihaz yönetimi aşağıdaki mevcut bölümde duruyor.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {callerDevices.slice(0, 4).map((device) => (
                      <div key={device.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="font-black text-slate-950">{device.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {device.isActive ? 'Aktif' : 'Pasif'} • Son sinyal: {formatDate(device.lastSeenAt || device.updatedAt || device.createdAt)}
                        </p>
                      </div>
                    ))}
                    {callerDevices.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-bold text-slate-500">
                        Henüz cihaz kaydı yok.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h3 className="text-lg font-black text-slate-950">
                      {callerIdPanelTab === 'MISSED'
                        ? 'Kaçan / görülmeyen çağrılar'
                        : callerIdPanelTab === 'CONVERTED'
                          ? 'Siparişe dönüşen çağrılar'
                          : 'Gelen çağrılar'}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Bu sekme hızlı özet içindir. Detaylı çağrı geçmişi aşağıdaki mevcut bölümde de korunuyor.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {selectedCallerEvents.slice(0, 8).map((event) => (
                      <div key={event.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Telefon</p>
                          <p className="mt-1 font-black text-slate-950">{event.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Müşteri</p>
                          <p className="mt-1 font-bold text-slate-700">{event.customerName || 'Yeni müşteri'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Durum</p>
                          <p className="mt-1 font-bold text-slate-700">
                            {event.orderCode ? `Siparişe dönüştü: ${event.orderCode}` : event.seenAt ? 'Görüldü' : 'Yeni çağrı'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startOrderFromCallerEvent(event)}
                          className="rounded-2xl bg-sky-500 px-4 py-2 text-xs font-black text-white transition hover:bg-sky-600"
                        >
                          Sipariş Başlat
                        </button>
                      </div>
                    ))}

                    {selectedCallerEvents.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <p className="text-lg font-black text-slate-900">Bu sekmede kayıt yok</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">Yeni çağrı geldiğinde burada görünecek.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>


        {lastOrderCode ? (
          <div className="mb-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
              Oluşturulan Sipariş Kodu
            </p>
            <p className="mt-2 text-4xl font-black text-cyan-900">{lastOrderCode}</p>
          </div>
        ) : null}

        <section className="hidden hidden-old-call-history-section rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
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
                      const isConverted = Boolean(event.orderCode || event.convertedAt);

                      return (
                        <tr key={event.id} className={isNew ? 'bg-amber-50/70' : 'transition hover:bg-slate-50'}>
                          <td className="px-4 py-3 font-black text-slate-950">{event.phone || '-'}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{event.customerName || 'Yeni müşteri'}</td>
                          <td className="px-4 py-3 font-bold text-slate-700">{sourceLabel}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-2">
                              <span
                                className={`rounded-full border px-3 py-1 text-xs font-black ${
                                  isNew
                                    ? 'border-amber-200 bg-amber-100 text-amber-800'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {isNew ? 'Yeni' : 'Görüldü'}
                              </span>

                              {isConverted ? (
                                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black text-cyan-800">
                                  Siparişe dönüştü{event.orderCode ? `: ${event.orderCode}` : ''}
                                </span>
                              ) : null}
                            </div>
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
                                disabled={isConverted}
                                className={`rounded-2xl px-3 py-2 text-xs font-black shadow-sm transition disabled:cursor-not-allowed ${
                                  isConverted
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                {isConverted ? 'Siparişe Dönüştü' : 'Sipariş Başlat'}
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

        <section className="hidden hidden-phone-customer-history-section rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
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
            <section data-hidden-caller-id-phone-order-section="true" hidden className="hidden hidden-caller-device-management-section mb-6 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]" style={{ display: "none" }}>
          {/* __CALLER_ID_FORCE_HIDE_PHONE_ORDER_SECTION__ */}
          {/* __CALLER_ID_HOME_ONLY_HIDE_PHONE_ORDER_SECTION__ */}
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

          {/* __CALLER_ID_DIRECT_HIDE_NEW_PHONE_ORDER_PARTS__ */}
          {/* __CALLER_ID_OPEN_NEW_PHONE_ORDER_ON_NEW_CUSTOMER_CLICK__ */}
          <h2
            id="caller-id-new-phone-order-anchor"
            style={{ display: showNewCustomerOrderSection ? "block" : "none" }}
            className="text-xl font-black text-slate-950"
          >
            Yeni Telefon Siparişi
          </h2>
            <p
            style={{ display: showNewCustomerOrderSection ? "block" : "none" }}
            className="mt-1 text-sm text-slate-500"
          >
            Sipariş oluşturulduktan sonra Yeni Siparişler operasyon bölümüne düşer.
          </p>
          </div>

          <div id="caller-id-order-stage-card" style={{ display: showNewCustomerOrderSection && !isPhoneOrderStageOpen ? "block" : "none" }} className={`${isPhoneOrderStageOpen ? 'hidden' : 'mb-4'} rounded-[24px] border border-sky-200 bg-sky-50 p-5 shadow-sm`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-700">
                  Müşteri Aşaması
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Önce müşteri bilgisini kontrol et
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  Çağrıdan gelen numara ve müşteri bilgisi hazırsa Siparişe Git butonuna bas. Telefon sipariş ekranında kategori, ürün ve sepet akışı açılacak.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span
                  className={`w-fit rounded-full border px-3 py-2 text-xs font-black ${
                    isPhoneOrderStageOpen
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {isPhoneOrderStageOpen ? 'Sipariş aşaması açık' : 'Müşteri aşaması'}
                </span>

                <button
                  type="button"
                  onClick={goToPhoneOrderStage}
                  className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-sky-900/15 transition hover:bg-sky-600"
                >
                  Siparişe Git
                </button>
              </div>
            </div>

            {isPhoneOrderStageOpen ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                <p className="text-sm font-black text-emerald-800">
                  Sipariş aşaması açıldı.
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Telefon sipariş ekranı aktif. Kategori seç, ürünü sepete ekle ve siparişi tamamla.
                </p>
              </div>
            ) : null}
          </div>

          {isPhoneOrderStageOpen ? (
            <div id="caller-id-menu-display" style={{ display: showNewCustomerOrderSection && isPhoneOrderStageOpen ? "block" : "none" }} className="mb-4 rounded-[32px] border border-emerald-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
              {/* __CALLER_ID_STAGE_SEPARATE_VIEW_STEP2C_SAFE__ */}
              <div className="mb-5 flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                    Telefon Sipariş Ekranı
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">
                    Menüden ürün seçerek sipariş oluştur
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Müşteri bilgisi hazırlandı. Bu bölüm ayrı sipariş ekranı olarak açılır.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPhoneOrderStageOpen(false)}
                  className="w-fit rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  Müşteri Bilgisine Dön
                </button>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                    Menüden Ürün Seç
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">
                    Telefon siparişi için menü ürünleri
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                    Kategori seç, ürünü sepete ekle ve miktarı sepetten yönet.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadPhoneOrderMenu}
                  disabled={isLoadingPhoneOrderMenu}
                  className="w-fit rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingPhoneOrderMenu ? 'Menü Yükleniyor...' : 'Menüyü Yenile'}
                </button>
              </div>

              {phoneOrderMenuMessage ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                  {phoneOrderMenuMessage}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setPhoneOrderMenuCategoryId('')}
                  className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition ${
                    !phoneOrderMenuCategoryId
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tümü
                </button>

                {phoneOrderMenuCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setPhoneOrderMenuCategoryId(category.id)}
                    className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition ${
                      phoneOrderMenuCategoryId === category.id
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {phoneOrderMenuItems.length > 0 ? (
                <div className="mt-4 grid max-h-[480px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                  {phoneOrderMenuItems
                    .filter((menuItem) => {
                      if (!phoneOrderMenuCategoryId) return true;

                      const categoryId = menuItem.categoryId || menuItem.category?.id || '';

                      return categoryId === phoneOrderMenuCategoryId;
                    })
                    .map((menuItem) => (
                      <div
                        key={menuItem.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{menuItem.name}</p>
                            {menuItem.description ? (
                              <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                                {menuItem.description}
                              </p>
                            ) : null}
                          </div>

                          <span className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700">
                            {formatMoney(getPhoneOrderMenuItemPrice(menuItem))}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => addPhoneOrderMenuItemToCart(menuItem)}
                          className="mt-3 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          + Sepete Ekle
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-black text-slate-900">Menü ürünü görünmüyor</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Menü Yönetimi bölümünde aktif ürün varsa Menüyü Yenile butonunu dene.
                  </p>
                </div>
              )}

              <div id="caller-id-cart-panel" className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                      Sepet
                    </p>
                    <h3 className="mt-1 text-xl font-black text-slate-950">
                      Telefon siparişi sepeti
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Ürünleri ekle, adetleri düzenle. Sepet toplamı otomatik olarak toplam tutara aktarılır.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-3 text-right">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                      Sepet Toplamı
                    </p>
                    <p className="mt-1 text-2xl font-black text-slate-950">
                      {formatMoney(getPhoneOrderCartTotal(phoneOrderCartItems))}
                    </p>
                  </div>
                </div>

                {/* __CALLER_ID_CART_SUBMIT_BUTTON_STEP4_V2__ */}
                <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      Siparişi tamamla
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Sepetteki ürünler sipariş kalemleri olarak kaydedilecek.
                    </p>
                  </div>

                                      {/* __CALLER_ID_CART_PAYMENT_METHOD_VISIBLE__ */}
                    <label className="w-full text-sm font-black text-slate-800 md:max-w-xs">
                      Ödeme Tipi
                      <select
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                        className="mt-2 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-slate-950 shadow-inner outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      >
                        {PAYMENT_METHOD_OPTIONS.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </label>

<button
                    type="submit"
                    form="caller-id-order-form"
                    disabled={isSaving || phoneOrderCartItems.length === 0}
                    className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? 'Oluşturuluyor...' : 'Siparişi Oluştur'}
                  </button>
                </div>

                {phoneOrderCartItems.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {phoneOrderCartItems.map((cartItem) => (
                      <div
                        key={cartItem.menuItemId}
                        className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-950">{cartItem.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {cartItem.quantity} x {formatMoney(cartItem.unitPrice)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decreasePhoneOrderCartItem(cartItem.menuItemId)}
                            className="h-10 w-10 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                          >
                            -
                          </button>

                          <span className="min-w-10 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-black text-slate-900">
                            {cartItem.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => increasePhoneOrderCartItem(cartItem.menuItemId)}
                            className="h-10 w-10 rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800 transition hover:bg-emerald-100"
                          >
                            +
                          </button>

                          <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-900">
                            {formatMoney(cartItem.unitPrice * cartItem.quantity)}
                          </span>

                          <button
                            type="button"
                            onClick={() => removePhoneOrderCartItem(cartItem.menuItemId)}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <p className="text-sm font-black text-slate-900">Sepet boş</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Menüden ürün seçerek telefon siparişini hazırlamaya başlayabilirsin.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <form id="caller-id-order-form" style={{ display: showNewCustomerOrderSection && !isPhoneOrderStageOpen ? "grid" : "none" }} onSubmit={createOrder} className={`${isPhoneOrderStageOpen ? 'hidden' : 'grid'} gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:grid-cols-2 xl:grid-cols-3`}>
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
                {isSaving ? 'Oluşturuluyor...' : isPhoneOrderStageOpen ? 'Sipariş Oluştur' : 'Önce Siparişe Git'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
