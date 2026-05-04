'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  restaurantId: string | null;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type Branch = {
  id: string;
  name: string;
};

type Courier = {
  id: string;
  branchId?: string | null;
  name: string;
  phone?: string | null;
  isActive: boolean;
  branch?: {
    name: string;
  } | null;
};

type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  branch?: {
    name: string;
  } | null;
};

type MenuItem = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
  } | null;
  branch?: {
    name: string;
  } | null;
};

type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'ON_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

type OrderType = 'TABLE' | 'DELIVERY' | 'TAKEAWAY';

type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'ONLINE' | 'MEAL_CARD' | 'OPEN_ACCOUNT';

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  totalPrice: string | number;
  note?: string | null;
};

type OrderFilter = 'ALL' | OrderStatus;

type Order = {
  id: string;
  code: string;
  type?: OrderType | string;
  tableNumber?: string | null;
  status: OrderStatus | string;
  total: string | number;
  paymentMethod?: PaymentMethod | string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  courierId?: string | null;
  courierName?: string | null;
  note?: string | null;
  items?: OrderItem[];
  createdAt: string;
  branch?: {
    name: string;
  } | null;
};

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'DELIVERY', label: 'Paket' },
  { value: 'TABLE', label: 'Masa' },
  { value: 'TAKEAWAY', label: 'Gel-al' },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Paket',
  TABLE: 'Masa',
  TAKEAWAY: 'Gel-al',
};

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Nakit' },
  { value: 'CREDIT_CARD', label: 'Kredi / Banka Kartı' },
  { value: 'ONLINE', label: 'Online Ödeme' },
  { value: 'MEAL_CARD', label: 'Yemek Kartı' },
  { value: 'OPEN_ACCOUNT', label: 'Açık Hesap' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Nakit',
  CREDIT_CARD: 'Kredi / Banka Kartı',
  ONLINE: 'Online Ödeme',
  MEAL_CARD: 'Yemek Kartı',
  OPEN_ACCOUNT: 'Açık Hesap',
};

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'ACCEPTED', label: 'Kabul Et' },
  { value: 'PREPARING', label: 'Hazırlamaya Al' },
  { value: 'READY', label: 'Hazır Yap' },
  { value: 'ON_DELIVERY', label: 'Yola Çıkar' },
  { value: 'DELIVERED', label: 'Teslim Et' },
  { value: 'CANCELLED', label: 'İptal Et' },
];

const ORDER_FILTER_OPTIONS: { value: OrderFilter; label: string }[] = [
  { value: 'ALL', label: 'Yeni Siparişler' },
  { value: 'PENDING', label: 'Bekliyor' },
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  ACCEPTED: 'Kabul Edildi',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
  ON_DELIVERY: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal Edildi',
};

const ACTIVE_ORDER_STATUSES = new Set<string>([
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'ON_DELIVERY',
]);

const DISPATCH_READY_STATUSES = new Set<string>(['ACCEPTED', 'PREPARING', 'READY']);

type PrimaryOrderAction = {
  value: OrderStatus;
  label: string;
};


const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  PENDING: 'border-amber-300 bg-amber-100 text-amber-800 shadow-sm',
  ACCEPTED: 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm',
  PREPARING: 'border-orange-300 bg-orange-100 text-orange-800 shadow-sm',
  READY: 'border-violet-300 bg-violet-100 text-violet-800 shadow-sm',
  ON_DELIVERY: 'border-sky-300 bg-sky-100 text-sky-800 shadow-sm',
  DELIVERED: 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm',
  CANCELLED: 'border-red-300 bg-red-100 text-red-800 shadow-sm',
};

const ORDER_ACTION_BUTTON_CLASSES: Record<string, string> = {
  ACCEPTED: 'border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200 shadow-sm',
  PREPARING: 'border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200 shadow-sm',
  READY: 'border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200 shadow-sm',
  ON_DELIVERY: 'border-sky-300 bg-sky-100 text-sky-800 hover:bg-sky-200 shadow-sm',
  DELIVERED: 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-sm',
  CANCELLED: 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200 shadow-sm',
};

const USER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  STAFF: 'Personel',
  COURIER: 'Kurye',
  CUSTOMER: 'Müşteri',
};

function generateNextOrderCode(orders: Order[]) {
  const maxNumber = orders.reduce((max, order) => {
    const match = order.code.match(/(\d+)$/);
    const orderNumber = match ? Number(match[1]) : 0;

    return Number.isFinite(orderNumber) && orderNumber > max ? orderNumber : max;
  }, 0);

  return `ORD-${String(maxNumber + 1).padStart(4, '0')}`;
}

function getOrderNumericTotal(total: string | number) {
  const normalizedTotal = String(total).replace(',', '.');
  const numericTotal = Number(normalizedTotal);

  return Number.isFinite(numericTotal) ? numericTotal : 0;
}

function isTodayOrder(createdAt: string) {
  const orderDate = new Date(createdAt);

  if (Number.isNaN(orderDate.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    orderDate.getFullYear() === today.getFullYear() &&
    orderDate.getMonth() === today.getMonth() &&
    orderDate.getDate() === today.getDate()
  );
}

function formatOrderDate(createdAt: string) {
  const orderDate = new Date(createdAt);

  if (Number.isNaN(orderDate.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(orderDate);
}

function formatMoney(value: string | number) {
  const numericValue = Number(String(value).replace(',', '.'));

  if (!Number.isFinite(numericValue)) {
    return `${value} TL`;
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(numericValue);
}

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value || '').toLocaleLowerCase('tr-TR').trim();
}

function getOrderTypeDisplay(order: Order) {
  const typeLabel = ORDER_TYPE_LABELS[order.type || ''] || '-';

  if (order.type === 'TABLE' && order.tableNumber) {
    return `${typeLabel} ${order.tableNumber}`;
  }

  return typeLabel;
}

function orderMatchesSearch(order: Order, searchValue: string) {
  if (!searchValue) {
    return true;
  }

  const searchableValues = [
    order.code,
    order.tableNumber,
    order.customerName,
    order.customerPhone,
    order.customerAddress,
    order.note,
    order.branch?.name,
    getOrderTypeDisplay(order),
    ORDER_TYPE_LABELS[order.type || ''],
    ORDER_STATUS_LABELS[order.status],
  ];

  return searchableValues.some((value) => normalizeSearchValue(value).includes(searchValue));
}

function getPrimaryOrderAction(order: Order): PrimaryOrderAction | null {
  if (order.status === 'PENDING') {
    return {
      value: 'ACCEPTED',
      label: 'Kabul Et',
    };
  }

  if (DISPATCH_READY_STATUSES.has(order.status)) {
    if (order.type === 'DELIVERY') {
      return {
        value: 'ON_DELIVERY',
        label: 'Yola Çıkar',
      };
    }

    return {
      value: 'DELIVERED',
      label: 'Tamamla',
    };
  }

  if (order.status === 'ON_DELIVERY') {
    return {
      value: 'DELIVERED',
      label: 'Teslim Et',
    };
  }

  return null;
}

function shouldShowCourierSelect(order: Order) {
  const primaryAction = getPrimaryOrderAction(order);

  return primaryAction?.value === 'ON_DELIVERY' && order.type === 'DELIVERY';
}

function shouldShowCancelAction(order: Order) {
  return order.status === 'PENDING' || DISPATCH_READY_STATUSES.has(order.status);
}

type CallerCustomerAddress = {
  id: string;
  title?: string | null;
  type?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  buildingNo?: string | null;
  floorNo?: string | null;
  doorNo?: string | null;
  description?: string | null;
  fullAddress?: string | null;
  isDefault?: boolean | null;
};

type CallerRecentOrderItem = {
  id?: string;
  name?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  note?: string | null;
};

type CallerRecentOrder = {
  id?: string;
  code?: string | null;
  status?: string | null;
  total?: number | string | null;
  paymentMethod?: string | null;
  createdAt?: string | null;
  items?: CallerRecentOrderItem[];
};

type CallerCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  addresses?: CallerCustomerAddress[];
  recentOrders?: CallerRecentOrder[];
};

type IncomingCallState = {
  phone: string;
  customer: CallerCustomer | null;
  selectedAddressId: string;
  isSearching: boolean;
  isUnknown: boolean;
};

type CallerRegistrationForm = {
  name: string;
  phone: string;
  addressTitle: string;
  addressType: string;
  district: string;
  neighborhood: string;
  street: string;
  buildingNo: string;
  floorNo: string;
  doorNo: string;
  description: string;
};

const DEFAULT_CALLER_REGISTRATION_FORM: CallerRegistrationForm = {
  name: '',
  phone: '',
  addressTitle: 'Ev',
  addressType: 'Ev',
  district: '',
  neighborhood: '',
  street: '',
  buildingNo: '',
  floorNo: '',
  doorNo: '',
  description: '',
};

type OrderCartItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  note: string;
};



function getCallerAddressText(address?: CallerCustomerAddress | null) {
  if (!address) {
    return '';
  }

  if (address.fullAddress) {
    return address.fullAddress;
  }

  return [
    address.district,
    address.neighborhood,
    address.street,
    address.buildingNo ? `Bina No: ${address.buildingNo}` : '',
    address.floorNo ? `Kat: ${address.floorNo}` : '',
    address.doorNo ? `Kapı: ${address.doorNo}` : '',
    address.description,
  ]
    .filter(Boolean)
    .join(', ');
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [qrBranchId, setQrBranchId] = useState('');
  const [qrTableNumber, setQrTableNumber] = useState('5');
  const [qrLinkCopied, setQrLinkCopied] = useState(false);
  const [publicBaseUrl, setPublicBaseUrl] = useState('');

  useEffect(() => {
    setPublicBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!qrBranchId && branches.length > 0) {
      setQrBranchId(branches[0].id);
    }
  }, [branches, qrBranchId]);

  const qrLink = useMemo(() => {
    const tableNumber = qrTableNumber.trim();

    if (!publicBaseUrl || !qrBranchId || !tableNumber) {
      return '';
    }

    return `${publicBaseUrl}/qr?branchId=${qrBranchId}&table=${encodeURIComponent(tableNumber)}`;
  }, [publicBaseUrl, qrBranchId, qrTableNumber]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastOrdersRefreshAt, setLastOrdersRefreshAt] = useState('');
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderMenuCategoryId, setOrderMenuCategoryId] = useState('');
  const [orderCartItems, setOrderCartItems] = useState<OrderCartItem[]>([]);
  const [isCallerOrderCartOpen, setIsCallerOrderCartOpen] = useState(false);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedCourierByOrderId, setSelectedCourierByOrderId] = useState<Record<string, string>>({});
  const [dispatchCourierOrder, setDispatchCourierOrder] = useState<Order | null>(null);
  const [dispatchCourierId, setDispatchCourierId] = useState('');

  const [courierChangeOrder, setCourierChangeOrder] = useState<Order | null>(null);
  const [courierChangeCourierId, setCourierChangeCourierId] = useState('');

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [tableNumber, setTableNumber] = useState('');
  const [orderTotal, setOrderTotal] = useState('');
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [categoryName, setCategoryName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [callerPanelMode, setCallerPanelMode] = useState<'idle' | 'known' | 'unknown' | 'register'>('idle');
  const [callerRegistrationForm, setCallerRegistrationForm] = useState<CallerRegistrationForm>(
    DEFAULT_CALLER_REGISTRATION_FORM,
  );
  const [isSavingCallerCustomer, setIsSavingCallerCustomer] = useState(false);
  const [callerRegistrationError, setCallerRegistrationError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      return;
    }

    let isMounted = true;

    async function loadCouriersForDashboard() {
      try {
        const response = await fetch('/api/couriers', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isMounted) {
          setCouriers(Array.isArray(data) ? data : []);
        }
      } catch {
        // Kurye listesi yüklenemezse dashboard çalışmaya devam eder.
      }
    }

    loadCouriersForDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeCouriers = useMemo(() => {
    return couriers.filter((courier) => courier.isActive !== false);
  }, [couriers]);

  const activeOrders = useMemo(() => {
    return orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status));
  }, [orders]);

  function openCourierChangeModal(order: Order) {
    if (order.type !== 'DELIVERY' || order.status !== 'ON_DELIVERY') {
      return;
    }

    setCourierChangeOrder(order);
    setCourierChangeCourierId(order.courierId || '');
    setError('');
    setSuccess('');
  }

  function closeCourierChangeModal() {
    setCourierChangeOrder(null);
    setCourierChangeCourierId('');
  }

  async function submitCourierChange() {
    if (!courierChangeOrder) {
      return;
    }

    if (!courierChangeCourierId) {
      setError('Kuryeyi değiştirmek için kayıtlı kurye seçilmelidir.');
      return;
    }

    if (courierChangeCourierId === courierChangeOrder.courierId) {
      setError('Seçilen kurye zaten bu siparişe atanmış.');
      return;
    }

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');
    setUpdatingOrderId(courierChangeOrder.id);

    try {
      const response = await fetch(`/api/orders/${courierChangeOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ON_DELIVERY',
          courierId: courierChangeCourierId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş kuryesi güncellenemedi');
        return;
      }

      const latestOrders = await loadOrders(token);
      const latestOrder = latestOrders.find((order) => order.id === courierChangeOrder.id);

      setSelectedOrder((currentOrder) => {
        if (!currentOrder || currentOrder.id !== courierChangeOrder.id) {
          return currentOrder;
        }

        return latestOrder || data;
      });

      setSelectedCourierByOrderId((current) => {
        const next = { ...current };
        delete next[courierChangeOrder.id];
        return next;
      });

      closeCourierChangeModal();
      setSuccess('Sipariş kuryesi güncellendi');
    } catch {
      setError('Sipariş kuryesi güncellenirken hata oluştu');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function openDispatchCourierModal(order: Order) {
    if (order.type !== 'DELIVERY' || !DISPATCH_READY_STATUSES.has(order.status)) {
      return;
    }

    setDispatchCourierOrder(order);
    setDispatchCourierId(selectedCourierByOrderId[order.id] || '');
    setError('');
    setSuccess('');
  }

  function closeDispatchCourierModal() {
    setDispatchCourierOrder(null);
    setDispatchCourierId('');
  }

  async function submitDispatchCourier() {
    if (!dispatchCourierOrder) {
      return;
    }

    if (!dispatchCourierId) {
      setError('Yola çıkarmak için kayıtlı kurye seçilmelidir.');
      return;
    }

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');
    setUpdatingOrderId(dispatchCourierOrder.id);

    try {
      const response = await fetch(`/api/orders/${dispatchCourierOrder.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ON_DELIVERY',
          courierId: dispatchCourierId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş yola çıkarılamadı');
        return;
      }

      const latestOrders = await loadOrders(token);
      const latestSelectedOrder = latestOrders.find((order) => order.id === dispatchCourierOrder.id);

      setSelectedOrder((currentOrder) => {
        if (!currentOrder || currentOrder.id !== dispatchCourierOrder.id) {
          return currentOrder;
        }

        return latestSelectedOrder || data;
      });

      setSelectedCourierByOrderId((current) => {
        const next = { ...current };
        delete next[dispatchCourierOrder.id];
        return next;
      });

      closeDispatchCourierModal();
      setSuccess('Sipariş yola çıkarıldı');
    } catch {
      setError('Sipariş yola çıkarılırken hata oluştu');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(orderSearch);

    return activeOrders.filter((order) => {
      const statusMatches = orderFilter === 'ALL' || order.status === orderFilter;
      const searchMatches = orderMatchesSearch(order, normalizedSearch);

      return statusMatches && searchMatches;
    });
  }, [activeOrders, orderFilter, orderSearch]);

  const newOrderRows = useMemo(() => {
    return filteredOrders.filter((order) => order.status === 'PENDING');
  }, [filteredOrders]);

  const dispatchReadyRows = useMemo(() => {
    return filteredOrders.filter((order) => DISPATCH_READY_STATUSES.has(order.status));
  }, [filteredOrders]);

  const deliveryRows = useMemo(() => {
    return filteredOrders.filter((order) => order.status === 'ON_DELIVERY');
  }, [filteredOrders]);

  const orderCountsByStatus = useMemo(() => {
    return activeOrders.reduce<Record<string, number>>((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {});
  }, [orders]);

  const operationalSummary = useMemo(() => {
    const todayOrders = orders.filter((order) => isTodayOrder(order.createdAt));

    return {
      pending: orderCountsByStatus.PENDING || 0,
      preparing:
        (orderCountsByStatus.ACCEPTED || 0) +
        (orderCountsByStatus.PREPARING || 0) +
        (orderCountsByStatus.READY || 0),
      onDelivery: orderCountsByStatus.ON_DELIVERY || 0,
      todayOrderCount: todayOrders.length,
      todayRevenue: todayOrders.reduce((total, order) => total + getOrderNumericTotal(order.total), 0),
    };
  }, [orders, orderCountsByStatus]);

  const selectedFilterLabel =
    ORDER_FILTER_OPTIONS.find((filter) => filter.value === orderFilter)?.label || 'Tümü';

  const formattedTodayRevenue = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(operationalSummary.todayRevenue);

  const isDeliveryOrder = orderType === 'DELIVERY';
  const isTableOrder = orderType === 'TABLE';
  const isTakeawayOrder = orderType === 'TAKEAWAY';

  const orderTypeDescription = isDeliveryOrder
    ? 'Paket siparişlerde adres bilgisi alınır.'
    : isTableOrder
      ? 'Masa siparişinde masa numarası zorunludur. QR masa siparişi altyapısı için temel alan.'
      : 'Gel-al siparişinde adres gerekmez, müşteri adı ve telefon yeterlidir.';

  const customerNamePlaceholder = isTableOrder ? 'Masa müşterisi' : 'Ahmet Yılmaz';

  const orderNotePlaceholder = isTableOrder
    ? 'Masa notu, servis tercihi vb.'
    : isTakeawayOrder
      ? 'Gel-al saati, ödeme notu vb.'
      : 'Zil çalışmıyor, acısız olsun, kapıya bırak vb.';

  async function loadOrders(token: string) {
    const ordersResponse = await fetch('/api/orders', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const ordersData = ordersResponse.ok ? await ordersResponse.json() : [];
    const safeOrders = Array.isArray(ordersData) ? ordersData : [];

    setOrders(safeOrders);
    setLastOrdersRefreshAt(
      new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
    setOrderCode((currentCode) => currentCode || generateNextOrderCode(safeOrders));

    return safeOrders;
  }

  async function loadBranches(token: string) {
    const branchesResponse = await fetch('/api/branches', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const branchesData = branchesResponse.ok ? await branchesResponse.json() : [];
    const safeBranches = Array.isArray(branchesData) ? branchesData : [];

    setBranches(safeBranches);

    if (safeBranches.length > 0) {
      setSelectedBranchId((currentBranchId) => currentBranchId || safeBranches[0].id);
    }
  }

  async function loadMenu(token: string) {
    const [categoriesResponse, itemsResponse] = await Promise.all([
      fetch('/api/menu/categories', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      fetch('/api/menu/items', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
    ]);

    const categoriesData = categoriesResponse.ok ? await categoriesResponse.json() : [];
    const itemsData = itemsResponse.ok ? await itemsResponse.json() : [];

    const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
    const safeItems = Array.isArray(itemsData) ? itemsData : [];

    setMenuCategories(safeCategories);
    setMenuItems(safeItems);

    if (safeCategories.length > 0) {
      setItemCategoryId((currentCategoryId) => currentCategoryId || safeCategories[0].id);
      setOrderMenuCategoryId((currentCategoryId) => currentCategoryId || safeCategories[0].id);
    }
  }

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem('accessToken');

      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const meResponse = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!meResponse.ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          router.push('/login');
          return;
        }

        const meData = await meResponse.json();

        setUser(meData);
        await Promise.all([loadBranches(token), loadOrders(token), loadMenu(token)]);
      } catch {
        setError('Dashboard verileri yüklenirken hata oluştu');
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      return;
    }

    const accessToken = token;

    let isRefreshing = false;

    async function refreshOrdersSilently() {
      if (isRefreshing || updatingOrderId || dispatchCourierOrder || courierChangeOrder) {
        return;
      }

      isRefreshing = true;

      try {
        await loadOrders(accessToken);
      } catch (refreshError) {
        console.error('Sipariş otomatik yenileme hatası:', refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const intervalId = window.setInterval(refreshOrdersSilently, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [updatingOrderId, dispatchCourierOrder, courierChangeOrder]);


  const filteredOrderMenuItems = useMemo(() => {
    if (!orderMenuCategoryId) {
      return menuItems;
    }

    return menuItems.filter((item) => {
      const categoryId = String(
        (item as any).categoryId ||
          (item as any).menuCategoryId ||
          (item as any).category?.id ||
          '',
      );

      return categoryId === orderMenuCategoryId;
    });
  }, [menuItems, orderMenuCategoryId]);

  const orderCartTotal = useMemo(
    () => orderCartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [orderCartItems],
  );

  useEffect(() => {
    if (orderCartItems.length > 0) {
      setOrderTotal(String(orderCartTotal));
    }
  }, [orderCartItems.length, orderCartTotal]);

  function addMenuItemToOrderCart(menuItem: MenuItem) {
    const menuItemId = String((menuItem as any).id || '');
    const menuItemName = String((menuItem as any).name || 'Ürün');
    const menuItemPrice = Number((menuItem as any).totalPrice || (menuItem as any).price || 0);

    if (!menuItemId) {
      setError('Ürün bilgisi okunamadı.');
      return;
    }

    if (!Number.isFinite(menuItemPrice) || menuItemPrice <= 0) {
      setError('Ürün fiyatı geçerli değil.');
      return;
    }

    setError('');

    setOrderCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.menuItemId === menuItemId);

      if (existingItem) {
        return currentItems.map((item) =>
          item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...currentItems,
        {
          menuItemId,
          name: menuItemName,
          quantity: 1,
          unitPrice: menuItemPrice,
          note: '',
        },
      ];
    });
  }

  function increaseOrderCartItem(menuItemId: string) {
    setOrderCartItems((currentItems) =>
      currentItems.map((item) =>
        item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }

  function decreaseOrderCartItem(menuItemId: string) {
    setOrderCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.menuItemId === menuItemId ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeOrderCartItem(menuItemId: string) {
    setOrderCartItems((currentItems) => currentItems.filter((item) => item.menuItemId !== menuItemId));
  }

  function updateOrderCartItemNote(menuItemId: string, note: string) {
    setOrderCartItems((currentItems) =>
      currentItems.map((item) => (item.menuItemId === menuItemId ? { ...item, note } : item)),
    );
  }

  async function createCallerCartOrder() {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');

    if (!selectedBranchId) {
      setError('Lütfen şube seçin');
      return;
    }

    if (!customerPhone.trim()) {
      setError('Telefon siparişi için müşteri telefonu zorunludur');
      return;
    }

    if (!customerAddress.trim()) {
      setError('Paket siparişlerde adres zorunludur');
      return;
    }

    if (orderCartItems.length === 0) {
      setError('Sipariş oluşturmak için sepete ürün ekleyin');
      return;
    }

    if (!Number.isFinite(orderCartTotal) || orderCartTotal <= 0) {
      setError('Sepet toplamı 0’dan büyük olmalıdır');
      return;
    }

    setIsCreatingOrder(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: selectedBranchId,
          code: orderCode.trim() || generateNextOrderCode(orders),
          type: 'DELIVERY',
          tableNumber: '',
          total: orderCartTotal,
          paymentMethod: orderPaymentMethod,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          note: orderNote.trim(),
          items: orderCartItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            note: item.note.trim() || null,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Caller ID siparişi oluşturulamadı');
        return;
      }

      setOrderCartItems([]);
      setIsCallerOrderCartOpen(false);
      setOrderTotal('');
      setOrderNote('');
      setSuccess('Caller ID siparişi oluşturuldu');

      const latestOrders = await loadOrders(token);
      setOrderCode(generateNextOrderCode(latestOrders));
    } catch {
      setError('Caller ID siparişi oluşturulurken hata oluştu');
    } finally {
      setIsCreatingOrder(false);
    }
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');

    if (!selectedBranchId) {
      setError('Lütfen şube seçin');
      return;
    }

    if (!orderCode.trim()) {
      setError('Sipariş kodu zorunludur');
      return;
    }

    if (orderType === 'TABLE' && !tableNumber.trim()) {
      setError('Masa siparişlerinde masa numarası zorunludur');
      return;
    }

    if (!orderTotal.trim()) {
      setError('Toplam tutar zorunludur');
      return;
    }

    if (orderType === 'DELIVERY' && !customerAddress.trim()) {
      setError('Paket siparişlerde adres zorunludur');
      return;
    }

    const numericOrderTotal = getOrderNumericTotal(orderTotal);

    if (!Number.isFinite(numericOrderTotal) || numericOrderTotal <= 0) {
      setError('Toplam tutar 0’dan büyük olmalıdır');
      return;
    }

    setIsCreatingOrder(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: selectedBranchId,
          code: orderCode.trim(),
          type: orderType,
          tableNumber: orderType === 'TABLE' ? tableNumber.trim() : '',
          total: numericOrderTotal,
        paymentMethod: orderPaymentMethod,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: orderType === 'DELIVERY' ? customerAddress.trim() : '',
          note: orderNote.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş oluşturulamadı');
        return;
      }

      setOrderType('DELIVERY');
      setTableNumber('');
      setOrderTotal('');
      setOrderPaymentMethod('CASH');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderNote('');
      setSuccess('Sipariş oluşturuldu');

      const latestOrders = await loadOrders(token);
      setOrderCode(generateNextOrderCode(latestOrders));
    } catch {
      setError('Sipariş oluşturulurken hata oluştu');
    } finally {
      setIsCreatingOrder(false);
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');

    if (!categoryName.trim()) {
      setError('Kategori adı zorunludur');
      return;
    }

    setIsCreatingCategory(true);

    try {
      const response = await fetch('/api/menu/categories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: categoryName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Kategori oluşturulamadı');
        return;
      }

      setCategoryName('');
      setSuccess('Kategori oluşturuldu');
      await loadMenu(token);
    } catch {
      setError('Kategori oluşturulurken hata oluştu');
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function createMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');

    if (!itemName.trim()) {
      setError('Ürün adı zorunludur');
      return;
    }

    if (!itemPrice.trim()) {
      setError('Ürün fiyatı zorunludur');
      return;
    }

    const numericItemPrice = Number(itemPrice.replace(',', '.'));

    if (!Number.isFinite(numericItemPrice) || numericItemPrice < 0) {
      setError('Ürün fiyatı geçerli olmalıdır');
      return;
    }

    setIsCreatingItem(true);

    try {
      const response = await fetch('/api/menu/items', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: itemCategoryId || null,
          name: itemName.trim(),
          description: itemDescription.trim(),
          price: numericItemPrice,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Ürün oluşturulamadı');
        return;
      }

      setItemName('');
      setItemDescription('');
      setItemPrice('');
      setSuccess('Ürün oluşturuldu');
      await loadMenu(token);
    } catch {
      setError('Ürün oluşturulurken hata oluştu');
    } finally {
      setIsCreatingItem(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const courierId =
      status === 'ON_DELIVERY' ? (selectedCourierByOrderId[orderId] || '').trim() : undefined;

    if (status === 'ON_DELIVERY' && !courierId) {
      setError('Yola çıkarılan sipariş için kayıtlı kurye seçilmelidir.');
      return;
    }

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');
    setUpdatingOrderId(orderId);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, courierId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sipariş durumu güncellenemedi');
        return;
      }

      const latestOrders = await loadOrders(token);
      const latestSelectedOrder = latestOrders.find((order) => order.id === orderId);

      setSelectedOrder((currentOrder) => {
        if (!currentOrder || currentOrder.id !== orderId) {
          return currentOrder;
        }

        return latestSelectedOrder || data;
      });

      setSuccess('Sipariş durumu güncellendi');
    } catch {
      setError('Sipariş durumu güncellenirken hata oluştu');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function updateOrderCourier(order: Order) {
    const courierId = (selectedCourierByOrderId[order.id] || '').trim();

    if (!courierId) {
      setError('Kuryeyi değiştirmek için kayıtlı kurye seçilmelidir.');
      return;
    }

    if (courierId === order.courierId) {
      setError('Seçilen kurye zaten bu siparişe atanmış.');
      return;
    }

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');
    setUpdatingOrderId(order.id);

    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'ON_DELIVERY',
          courierId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Kurye güncellenemedi');
        return;
      }

      const latestOrders = await loadOrders(token);
      const latestSelectedOrder = latestOrders.find((latestOrder) => latestOrder.id === order.id);

      setSelectedOrder((currentOrder) => {
        if (!currentOrder || currentOrder.id !== order.id) {
          return currentOrder;
        }

        return latestSelectedOrder || data;
      });

      setSelectedCourierByOrderId((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });

      setSuccess('Sipariş kuryesi güncellendi');
    } catch {
      setError('Kurye güncellenirken hata oluştu');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function simulateIncomingCall(phone: string) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    setError('');
    setSuccess('');
    setCallerPanelMode('idle');
    setIncomingCall({
      phone,
      customer: null,
      selectedAddressId: '',
      isSearching: true,
      isUnknown: false,
    });

    try {
      const response = await fetch(`/api/customers/by-phone/${encodeURIComponent(phone)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (response.status === 404) {
        setIncomingCall({
          phone,
          customer: null,
          selectedAddressId: '',
          isSearching: false,
          isUnknown: true,
        });
        setCallerPanelMode('unknown');
        setError('');
        return;
      }

      if (!response.ok) {
        throw new Error('Arayan müşteri bilgisi alınamadı.');
      }

      const customer = (await response.json()) as CallerCustomer;
      const defaultAddress =
        customer.addresses?.find((address) => address.isDefault) || customer.addresses?.[0] || null;

      setIncomingCall({
        phone,
        customer,
        selectedAddressId: defaultAddress?.id || '',
        isSearching: false,
        isUnknown: false,
      });
      setCallerPanelMode('known');
      setError('');
    } catch (requestError) {
      console.error(requestError);
      setIncomingCall({
        phone,
        customer: null,
        selectedAddressId: '',
        isSearching: false,
        isUnknown: true,
      });
      setCallerPanelMode('unknown');
      setError('');
    }
  }

  function closeIncomingCall() {
    setIncomingCall(null);
    setCallerPanelMode('idle');
    setCallerRegistrationForm(DEFAULT_CALLER_REGISTRATION_FORM);
    setCallerRegistrationError('');
    setIsCallerOrderCartOpen(false);

  }

  function fillOrderFromIncomingCall() {
    if (!incomingCall?.customer) {
      return;
    }

    const selectedAddress =
      incomingCall.customer.addresses?.find((address) => address.id === incomingCall.selectedAddressId) ||
      incomingCall.customer.addresses?.[0] ||
      null;

    setOrderType('DELIVERY');
    setTableNumber('');
    setOrderCartItems([]);
    setOrderTotal('');
    if (!orderMenuCategoryId && menuCategories.length > 0) {
      setOrderMenuCategoryId(menuCategories[0].id);
    }
    setCustomerName(incomingCall.customer.name || '');
    setCustomerPhone(incomingCall.customer.phone || incomingCall.phone);
    setCustomerAddress(getCallerAddressText(selectedAddress));
    setOrderNote(incomingCall.customer.notes || '');
    setOrderFilter('ALL');
    setSuccess('Caller ID bilgileri sipariş formuna aktarıldı.');
    setIsCallerOrderCartOpen(true);

  }

  function updateCallerRegistrationField(field: keyof CallerRegistrationForm, value: string) {
    setCallerRegistrationForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function startUnknownCallerRegistration() {
    if (!incomingCall) {
      return;
    }

    setError('');
    setSuccess('');
    setCallerRegistrationError('');
    setCallerRegistrationForm({
      ...DEFAULT_CALLER_REGISTRATION_FORM,
      phone: incomingCall.phone,
    });
    setCallerPanelMode('register');
  }

  async function saveUnknownCallerCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem('accessToken');

    if (!token) {
      router.push('/login');
      return;
    }

    const name = callerRegistrationForm.name.trim();
    const phone = callerRegistrationForm.phone.trim();

    if (!name) {
      setCallerRegistrationError('Ad soyad zorunlu.');
      return;
    }

    if (!phone) {
      setCallerRegistrationError('Telefon numarası zorunlu.');
      return;
    }

    setIsSavingCallerCustomer(true);
    setCallerRegistrationError('');
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: selectedBranchId || null,
          name,
          phone,
          notes: 'Caller ID hızlı kayıt',
          addresses: [
            {
              title: callerRegistrationForm.addressTitle.trim() || callerRegistrationForm.addressType,
              type: callerRegistrationForm.addressType,
              district: callerRegistrationForm.district.trim() || null,
              neighborhood: callerRegistrationForm.neighborhood.trim() || null,
              street: callerRegistrationForm.street.trim() || null,
              buildingNo: callerRegistrationForm.buildingNo.trim() || null,
              floorNo: callerRegistrationForm.floorNo.trim() || null,
              doorNo: callerRegistrationForm.doorNo.trim() || null,
              description: callerRegistrationForm.description.trim() || null,
              isDefault: true,
            },
          ],
        }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const rawMessage = errorData?.message;
        const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;

        throw new Error(message || 'Müşteri kaydı oluşturulamadı.');
      }

      const customer = (await response.json()) as CallerCustomer;
      const defaultAddress =
        customer.addresses?.find((address) => address.isDefault) || customer.addresses?.[0] || null;

      setIncomingCall({
        phone: customer.phone || phone,
        customer,
        selectedAddressId: defaultAddress?.id || '',
        isSearching: false,
        isUnknown: false,
      });
      setCallerPanelMode('known');
      setCallerRegistrationForm(DEFAULT_CALLER_REGISTRATION_FORM);
      setSuccess('Yeni müşteri kaydı oluşturuldu. Siparişe Git aktif.');
    } catch (saveError) {
      console.error(saveError);
      setCallerRegistrationError(saveError instanceof Error ? saveError.message : 'Müşteri kaydı oluşturulamadı.');
    } finally {
      setIsSavingCallerCustomer(false);
    }
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/login');
  }

  if (isLoading) {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 bg-slate-100 text-slate-950">
        <p className="text-lg font-semibold">Dashboard yükleniyor...</p>
      </main>
    );
  }

  const roleLabel = user ? USER_ROLE_LABELS[user.role] || user.role : '-';

  function shouldShowCancelAction(order: Order) {
    return ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_DELIVERY'].includes(order.status);
  }


  function getOrderActionIcon(label: string) {
    if (label.includes('Kabul')) return '✓';
    if (label.includes('Yola')) return '↗';
    if (label.includes('Teslim')) return '✓';
    if (label.includes('İptal')) return '×';
    return '•';
  }

  function getOperationalSectionMeta(title: string) {
    if (title.includes('Yeni')) {
      return {
        code: '01',
        icon: '!',
        eyebrow: 'Yeni Akış',
        badgeClass: 'border-amber-200 bg-amber-100 text-amber-800',
        glowClass: 'from-amber-50 to-white',
      };
    }

    if (title.includes('Yola')) {
      return {
        code: '02',
        icon: '↗',
        eyebrow: 'Sevkiyat',
        badgeClass: 'border-sky-200 bg-sky-100 text-sky-800',
        glowClass: 'from-sky-50 to-white',
      };
    }

    if (title.includes('Teslim')) {
      return {
        code: '03',
        icon: '✓',
        eyebrow: 'Teslimat',
        badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        glowClass: 'from-emerald-50 to-white',
      };
    }

    return {
      code: '00',
      icon: '•',
      eyebrow: 'Operasyon',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-800',
      glowClass: 'from-slate-50 to-white',
    };
  }

  function renderEmptyOrderState(message: string) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-lg font-black text-slate-500 shadow-sm">
            Ø
          </div>

          <div>
            <p className="text-sm font-black text-slate-900">{message}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Bu bölümde aksiyon bekleyen kayıt olduğunda otomatik olarak listelenir.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderOrderActionArea(order: Order) {
    const primaryAction = getPrimaryOrderAction(order);
    const isDispatchAction = primaryAction?.value === 'ON_DELIVERY' && order.type === 'DELIVERY';

    const primaryActionClass =
      primaryAction?.value === 'ACCEPTED'
        ? 'border-emerald-700 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.24)] hover:bg-emerald-700'
        : primaryAction?.value === 'ON_DELIVERY'
          ? 'border-sky-700 bg-sky-600 text-white shadow-[0_10px_24px_rgba(2,132,199,0.24)] hover:bg-sky-700'
          : primaryAction?.value === 'DELIVERED'
            ? 'border-green-700 bg-green-600 text-white shadow-[0_10px_24px_rgba(22,163,74,0.24)] hover:bg-green-700'
            : 'border-slate-800 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] hover:bg-slate-800';

    const primaryButton = primaryAction ? (
      <button
        type="button"
        onClick={() =>
          isDispatchAction ? openDispatchCourierModal(order) : updateOrderStatus(order.id, primaryAction.value)
        }
        disabled={updatingOrderId === order.id || (isDispatchAction && activeCouriers.length === 0)}
        className={`min-w-[130px] rounded-2xl border px-5 py-3 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${primaryActionClass}`}
      >
        <span className="inline-flex items-center justify-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-sm leading-none" aria-hidden="true">
            {getOrderActionIcon(primaryAction.label)}
          </span>
          <span>{primaryAction.label}</span>
        </span>
      </button>
    ) : null;

    return (
      <div className="flex min-w-[290px] flex-wrap items-center gap-3">
        {primaryButton}

        {shouldShowCancelAction(order) ? (
          <button
            type="button"
            onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
            disabled={updatingOrderId === order.id}
            className="inline-flex h-[46px] min-w-[92px] items-center justify-center rounded-2xl border border-red-700 bg-red-600 px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(220,38,38,0.20)] transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            İptal Et
          </button>
        ) : null}

        {isDispatchAction && activeCouriers.length === 0 ? (
          <div className="basis-full rounded-xl border border-amber-400/30 bg-white px-3 py-2 text-xs font-bold text-amber-700">
            Aktif kurye yok.
          </div>
        ) : null}
      </div>
    );
  }

  function renderCourierAssignment(order: Order) {
    const orderWithCourier = order as Order & {
      courierId?: string | null;
      courierName?: string | null;
      courier?: { name?: string | null } | null;
    };

    const assignedCourierId = orderWithCourier.courierId || '';
    const courierName =
      orderWithCourier.courierName ||
      orderWithCourier.courier?.name ||
      activeCouriers.find((courier) => courier.id === assignedCourierId)?.name ||
      '';

    if (!courierName) {
      return null;
    }

    if (order.status === 'ON_DELIVERY') {
      return (
        <button
          type="button"
          onClick={() => setCourierChangeOrder(order)}
          className="mt-2 inline-flex items-center rounded-full border border-cyan-300/40 bg-white px-3 py-1 text-xs font-black text-sky-700 transition hover:bg-slate-100"
          title="Kuryeyi değiştir"
        >
          Kurye: {courierName}
        </button>
      );
    }

    return (
      <div className="mt-2 inline-flex items-center rounded-full border border-cyan-300/40 bg-white px-3 py-1 text-xs font-black text-sky-700">
        Kurye: {courierName}
      </div>
    );
  }


  function renderOperationalOrderSection(title: string, description: string, rows: Order[], emptyMessage: string) {
    const sectionMeta = getOperationalSectionMeta(title);

    return (
      <div className={`mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br ${sectionMeta.glowClass} p-5 shadow-[0_16px_42px_rgba(15,23,42,0.08)]`}>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-lg font-black shadow-sm ${sectionMeta.badgeClass}`}>
              {sectionMeta.icon}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {sectionMeta.eyebrow}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {sectionMeta.code}
                </span>
              </div>

              <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h3>
              <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">{description}</p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-800 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {rows.length} sipariş
          </span>
        </div>

        {rows.length === 0 ? (
          renderEmptyOrderState(emptyMessage)
        ) : (
          <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1180px] overflow-hidden rounded-[24px] text-left text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white first:rounded-tl-[24px]">Kod</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Tip</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Müşteri</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Telefon</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Şube</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Durum</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Toplam</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Ödeme</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Tarih</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Detay</th>
                  <th className="sticky right-0 z-20 min-w-[280px] rounded-tr-[24px] bg-slate-900 px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[-14px_0_24px_rgba(15,23,42,0.18)]">İşlem</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((order) => {
                  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                  const typeLabel = getOrderTypeDisplay(order);
                  const paymentLabel = PAYMENT_METHOD_LABELS[order.paymentMethod || ''] || '-';
                  const statusBadgeClass =
                    ORDER_STATUS_BADGE_CLASSES[order.status] ||
                    'border-slate-300 bg-slate-100 text-slate-800';

                  return (
                    <tr key={order.id} className="bg-white transition hover:bg-slate-50">
                      <td className="px-4 py-4 align-middle text-xs font-black text-slate-950">{order.code}</td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black text-slate-800 shadow-sm">
                          {typeLabel}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">
                        <div className="font-black text-slate-950">{order.customerName || '-'}</div>
                        {order.customerAddress ? (
                          <div className="mt-1 max-w-[220px] truncate text-xs font-semibold text-slate-500">
                            {order.customerAddress}
                          </div>
                        ) : null}
                        {order.note ? (
                          <div className="mt-1 max-w-[220px] truncate text-xs font-bold text-orange-700">
                            Not: {order.note}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">{order.customerPhone || '-'}</td>
                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">{order.branch?.name || '-'}</td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </span>
                        {renderCourierAssignment(order)}
                      </td>

                      <td className="px-4 py-4 align-middle text-xs font-black text-slate-950">{formatMoney(order.total)}</td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">
                        <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black text-slate-800 shadow-sm">
                          {paymentLabel}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">
                        {formatOrderDate(order.createdAt)}
                      </td>

                      <td className="px-4 py-4 align-middle text-xs font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          <span aria-hidden="true">↗</span>
                          <span>Detay</span>
                        </button>
                      </td>

                      <td className="sticky right-0 z-10 min-w-[280px] bg-white px-4 py-4 align-middle text-xs font-bold text-slate-900 shadow-[-14px_0_24px_rgba(15,23,42,0.08)]">
                        <div className="flex min-w-[250px] items-center justify-end gap-2 whitespace-nowrap">
                          {renderOrderActionArea(order)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen px-6 py-8 bg-slate-100 px-4 py-6 sm:px-6 lg:px-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
                Restoran SaaS
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Ana Sayfa</h1>
              <p className="mt-2 text-sm text-slate-500">
                {user ? `${user.name} • ${user.email} • ${roleLabel}` : 'Kullanıcı bilgisi yok'}
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-fit rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-red-400"
            >
              Çıkış Yap
            </button>
          </div>

          <nav className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
            <a
              href="/dashboard"
              className="rounded-2xl border border-cyan-400/30 bg-white px-5 py-4 text-sm font-black text-sky-700 transition hover:bg-slate-100"
            >
              Operasyon
            </a>

            <a
              href="/dashboard/caller-id"
              className="rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
            >
              CALLER ID
            </a>

                        <a
              href="/dashboard/table-service"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-inner text-sm font-black text-slate-700 transition hover:bg-slate-50/80"
            >
              Masa Servis
            </a>

<a
              href="/dashboard/menu"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-inner text-sm font-black text-slate-700 transition hover:bg-slate-50/80"
            >
              Menü
            </a>

            <a
              href="/dashboard/orders/history"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-inner text-sm font-black text-slate-700 transition hover:bg-slate-50/80"
            >
              Geçmiş Siparişler
            </a>

            <a
              href="/dashboard/couriers"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-4 shadow-inner text-sm font-black text-slate-700 transition hover:bg-slate-50/80"
            >
              Kuryeler / Gün Sonu
            </a>
          </nav>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-white p-4 text-sm font-semibold text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => setOrderFilter('PENDING')}
            className="rounded-3xl border border-yellow-400/20 bg-white p-5 text-left shadow-sm shadow-black/10 transition hover:bg-slate-100"
          >
            <p className="text-sm font-semibold text-amber-700">Bekleyen</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-amber-700">{operationalSummary.pending}</p>
            <p className="mt-1 text-xs text-amber-700/70">Aksiyon bekleyen sipariş</p>
          </button>



          <button
            type="button"
            onClick={() => setOrderFilter('PREPARING')}
            className="rounded-3xl border border-orange-400/20 bg-white p-5 text-left shadow-sm shadow-black/10 transition hover:bg-slate-100"
          >
            <p className="text-sm font-semibold text-orange-700">Hazırlanıyor</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-orange-700">{operationalSummary.preparing}</p>
            <p className="mt-1 text-xs text-orange-700/70">Mutfakta olan sipariş</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('ON_DELIVERY')}
            className="rounded-3xl border border-cyan-400/20 bg-white p-5 text-left shadow-sm shadow-black/10 transition hover:bg-slate-100"
          >
            <p className="text-sm font-semibold text-sky-700">Yolda</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-sky-700">{operationalSummary.onDelivery}</p>
            <p className="mt-1 text-xs text-sky-700/70">Kurye teslimatında</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('ALL')}
            className="rounded-3xl border border-emerald-400/20 bg-white p-5 text-left shadow-sm shadow-black/10 transition hover:bg-slate-100"
          >
            <p className="text-sm font-semibold text-emerald-700">Bugünkü Sipariş</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-emerald-700">
              {operationalSummary.todayOrderCount}
            </p>
            <p className="mt-1 text-xs text-emerald-700/70">Bugün oluşturulan sipariş</p>
          </button>

          <div className="rounded-3xl border border-purple-400/20 bg-white p-5 shadow-sm shadow-black/10">
            <p className="text-sm font-semibold text-violet-700">Bugünkü Ciro</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-violet-700">{formattedTodayRevenue}</p>
            <p className="mt-1 text-xs text-violet-700/70">Bugünkü sipariş toplamı</p>
          </div>
        </section>



        

                  <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-700">
                  Caller ID Gelen Arama Paneli
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Operasyonda canlı arama</h2>
                <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
                  Telefon araması geldiğinde müşteri ve adres bilgisi operasyon ekranında açılır. Şimdilik demo simülasyonla test ediyoruz.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => simulateIncomingCall('05320001122')}
                  className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                >
                  Kayıtlı Arama Simüle Et
                </button>
                <button
                  type="button"
                  onClick={() => simulateIncomingCall('05329998877')}
                  className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800 shadow-sm transition hover:bg-amber-100"
                >
                  Kayıtsız Arama Simüle Et
                </button>
              </div>
            </div>

            {incomingCall ? (
              <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-inner">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                      {incomingCall.isSearching ? 'Aranıyor' : callerPanelMode === 'known' ? 'Kayıtlı Müşteri' : 'Kayıtsız Numara'}
                    </p>
                    <h3 className="mt-2 text-3xl font-black text-slate-950">
                      {incomingCall.isSearching
                        ? `${incomingCall.phone} aranıyor...`
                        : incomingCall.customer
                          ? `${incomingCall.customer.name} Arıyor...`
                          : `${incomingCall.phone} Arıyor...`}
                    </h3>
                    <p className="mt-2 text-sm font-bold text-slate-500">Telefon: {incomingCall.phone}</p>
                  </div>

                  <button
                    type="button"
                    onClick={closeIncomingCall}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                  >
                    Kapat ×
                  </button>
                </div>

                {incomingCall.isSearching ? (
                  <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-black text-sky-800">
                    Telefon numarası müşteri kayıtlarında aranıyor...
                  </div>
                ) : callerPanelMode === 'register' ? (
                  <form
                    onSubmit={saveUnknownCallerCustomer}
                    className="mt-5 rounded-[28px] border border-sky-200 bg-sky-50 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-700">
                          Operasyon İçi Yeni Kayıt
                        </p>
                        <h4 className="mt-2 text-2xl font-black text-slate-950">Kayıtsız arayanı müşteriye çevir</h4>
                        <p className="mt-1 text-sm font-semibold text-slate-600">
                          Telefon numarası otomatik geldi. Müşteri ve adres bilgisini kaydedince Siparişe Git aktif olur.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCallerPanelMode('unknown');
                          setCallerRegistrationError('');
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        Geri
                      </button>
                    </div>

                    {callerRegistrationError ? (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                        {callerRegistrationError}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ad Soyad</span>
                        <input
                          value={callerRegistrationForm.name}
                          onChange={(event) => updateCallerRegistrationField('name', event.target.value)}
                          placeholder="Gökhan Köse"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Telefon</span>
                        <input
                          value={callerRegistrationForm.phone}
                          onChange={(event) => updateCallerRegistrationField('phone', event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Adres Tipi</span>
                        <select
                          value={callerRegistrationForm.addressType}
                          onChange={(event) => {
                            updateCallerRegistrationField('addressType', event.target.value);
                            updateCallerRegistrationField('addressTitle', event.target.value);
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        >
                          <option value="Ev">Ev</option>
                          <option value="İş">İş</option>
                          <option value="Diğer">Diğer</option>
                        </select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">İlçe</span>
                        <input
                          value={callerRegistrationForm.district}
                          onChange={(event) => updateCallerRegistrationField('district', event.target.value)}
                          placeholder="Giresun Merkez"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mahalle</span>
                        <input
                          value={callerRegistrationForm.neighborhood}
                          onChange={(event) => updateCallerRegistrationField('neighborhood', event.target.value)}
                          placeholder="Mahalle"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Cadde / Sokak</span>
                        <input
                          value={callerRegistrationForm.street}
                          onChange={(event) => updateCallerRegistrationField('street', event.target.value)}
                          placeholder="Atatürk Caddesi"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Bina No</span>
                        <input
                          value={callerRegistrationForm.buildingNo}
                          onChange={(event) => updateCallerRegistrationField('buildingNo', event.target.value)}
                          placeholder="12"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Kat</span>
                        <input
                          value={callerRegistrationForm.floorNo}
                          onChange={(event) => updateCallerRegistrationField('floorNo', event.target.value)}
                          placeholder="3"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Kapı No</span>
                        <input
                          value={callerRegistrationForm.doorNo}
                          onChange={(event) => updateCallerRegistrationField('doorNo', event.target.value)}
                          placeholder="7"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>

                      <label className="space-y-2 md:col-span-2 xl:col-span-3">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Adres Açıklaması</span>
                        <textarea
                          value={callerRegistrationForm.description}
                          onChange={(event) => updateCallerRegistrationField('description', event.target.value)}
                          placeholder="Zile basmayın, telefonla arayın."
                          rows={3}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setCallerPanelMode('unknown');
                          setCallerRegistrationError('');
                        }}
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingCallerCustomer}
                        className="rounded-2xl bg-sky-600 px-6 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(2,132,199,0.18)] transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {isSavingCallerCustomer ? 'Kaydediliyor...' : 'Kaydet ve Siparişe Hazırla'}
                      </button>
                    </div>
                  </form>
                ) : incomingCall.customer ? (
                  <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_340px]">
                    <div className="rounded-[24px] border border-white bg-white p-5 shadow-sm">
                      <p className="text-sm font-black text-slate-950">Kayıtlı adresler</p>

                      <div className="mt-4 grid gap-3">
                        {(incomingCall.customer.addresses || []).length > 0 ? (
                          incomingCall.customer.addresses?.map((address) => (
                            <label
                              key={address.id}
                              className={`cursor-pointer rounded-2xl border p-4 transition ${
                                incomingCall.selectedAddressId === address.id
                                  ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                                  : 'border-slate-200 bg-slate-50 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  name="incoming-address"
                                  checked={incomingCall.selectedAddressId === address.id}
                                  onChange={() =>
                                    setIncomingCall((current) =>
                                      current ? { ...current, selectedAddressId: address.id } : current,
                                    )
                                  }
                                  className="mt-1"
                                />
                                <div>
                                  <p className="font-black text-slate-950">
                                    {address.title || address.type || 'Adres'}
                                    {address.isDefault ? ' • Varsayılan' : ''}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-slate-600">
                                    {getCallerAddressText(address) || 'Adres detayı girilmemiş.'}
                                  </p>
                                </div>
                              </div>
                            </label>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-500">
                            Bu müşteriye kayıtlı adres yok. Düzenle ile adres eklenebilir.
                          </div>
                        )}
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-950">Son sipariş geçmişi</p>
                            <p className="text-xs font-semibold text-slate-500">
                              Aynı telefon numarasından açılmış son 5 sipariş.
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">
                            {(incomingCall.customer.recentOrders || []).length} kayıt
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3">
                          {(incomingCall.customer.recentOrders || []).length > 0 ? (
                            incomingCall.customer.recentOrders?.map((order) => (
                              <div
                                key={order.id || order.code || order.createdAt || 'recent-order'}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-black text-slate-950">{order.code || 'Sipariş'}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">
                                      {order.createdAt ? new Date(order.createdAt).toLocaleString('tr-TR') : '-'}
                                    </p>
                                  </div>
                                  <div className="text-left sm:text-right">
                                    <p className="text-sm font-black text-emerald-700">
                                      {Number(order.total || 0).toLocaleString('tr-TR', {
                                        style: 'currency',
                                        currency: 'TRY',
                                      })}
                                    </p>
                                    <p className="mt-1 text-xs font-black text-slate-500">{order.status || '-'}</p>
                                  </div>
                                </div>

                                {(order.items || []).length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {order.items?.slice(0, 4).map((item) => (
                                      <span
                                        key={item.id || `${item.name}-${item.quantity}`}
                                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600"
                                      >
                                        {item.quantity || 1}× {item.name || 'Ürün'}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-xs font-semibold text-slate-400">Ürün detayı yok.</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-bold text-slate-500">
                              Bu müşteri için henüz sipariş geçmişi bulunamadı.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                      <button
                        type="button"
                        onClick={fillOrderFromIncomingCall}
                        className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] transition hover:bg-emerald-600"
                      >
                        Siparişe Git
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push('/dashboard/caller-id')}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        Düzenle
                      </button>
                      <p className="text-xs font-semibold leading-5 text-slate-500">
                        Siparişe Git, müşteri bilgilerini aşağıdaki yeni sipariş formuna aktarır.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
                    <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                      <p className="text-sm font-black text-amber-900">Kayıtsız numara</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
                        Bu telefon numarası müşteri kayıtlarında bulunamadı. Yeni kayıt açıldıktan sonra adres seçilip siparişe devam edilecek.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-2xl bg-slate-200 px-5 py-4 text-sm font-black text-slate-500"
                      >
                        Siparişe Git
                      </button>
                      <button
                        type="button"
                        onClick={startUnknownCallerRegistration}
                        className="w-full rounded-2xl bg-sky-600 px-5 py-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(2,132,199,0.18)] transition hover:bg-sky-700"
                      >
                        Yeni Kayıt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </section>

<section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] shadow-black/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Operasyon
              </p>
              <h2 className="mt-2 text-2xl font-black">Sipariş Operasyon Ekranı V2</h2>
              <p className="mt-1 text-sm text-slate-500">
                Siparişler aşama aşama ilerler: Kabul Et → Yola Çıkar → Teslim Et. Teslim edilen ve iptal edilen siparişler Geçmiş Siparişler bölümüne aktarılır.
                {lastOrdersRefreshAt ? ` Son güncelleme: ${lastOrdersRefreshAt}` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/dashboard/couriers')}
              className="w-fit rounded-2xl border border-cyan-400/30 bg-white px-5 py-3 text-sm font-black text-sky-700 transition hover:bg-slate-100"
            >
              Kurye Takip / Gün Sonu
            </button>
          </div>


          <div className={`${!isCallerOrderCartOpen ? 'hidden ' : ''}mt-6 rounded-[30px] border border-emerald-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]`}>
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">
                  Caller ID Sepet
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Telefon Siparişi Sepeti</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Arayan müşteriyi seçtikten sonra ürünleri sepete ekle ve tek tuşla operasyon siparişi oluştur.
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-right">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Sepet Toplamı</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">{formatMoney(orderCartTotal)}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">Müşteri Bilgisi</p>

                <div className="mt-4 grid gap-3">
                  <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Ad Soyad
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Müşteri adı"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Telefon
                    <input
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="05xx xxx xx xx"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Adres
                    <textarea
                      value={customerAddress}
                      onChange={(event) => setCustomerAddress(event.target.value)}
                      placeholder="Teslimat adresi"
                      rows={4}
                      className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Ödeme
                    <select
                      value={orderPaymentMethod}
                      onChange={(event) => setOrderPaymentMethod(event.target.value as PaymentMethod)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    >
                      {PAYMENT_METHOD_OPTIONS.map((paymentOption) => (
                        <option key={paymentOption.value} value={paymentOption.value}>
                          {paymentOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setOrderMenuCategoryId('')}
                    className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition ${
                      !orderMenuCategoryId
                        ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Tümü
                  </button>

                  {menuCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setOrderMenuCategoryId(category.id)}
                      className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition ${
                        orderMenuCategoryId === category.id
                          ? 'border-emerald-700 bg-emerald-700 text-white shadow-lg shadow-emerald-700/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {filteredOrderMenuItems.length > 0 ? (
                  <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                    {filteredOrderMenuItems.map((menuItem) => (
                      <button
                        key={menuItem.id}
                        type="button"
                        onClick={() => addMenuItemToOrderCart(menuItem)}
                        className="group rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-xl hover:shadow-emerald-900/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{menuItem.name}</p>
                            {(menuItem as any).description ? (
                              <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                                {(menuItem as any).description}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-slate-200">
                            {formatMoney(Number((menuItem as any).totalPrice || (menuItem as any).price || 0))}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs font-black text-slate-500">
                          <span>Sepete ekle</span>
                          <span className="rounded-full bg-emerald-600 px-3 py-1 text-white transition group-hover:bg-emerald-700">
                            + Ekle
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <p className="text-sm font-black text-slate-900">Bu kategoride ürün yok</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Menü Yönetimi bölümünden ürün ekleyebilirsin.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-950">Sepet Ürünleri</p>
                  {orderCartItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderCartItems([]);
                        setOrderTotal('');
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100"
                    >
                      Temizle
                    </button>
                  ) : null}
                </div>

                {orderCartItems.length > 0 ? (
                  <div className="mt-4 max-h-[390px] space-y-3 overflow-y-auto pr-1">
                    {orderCartItems.map((cartItem) => (
                      <div key={cartItem.menuItemId} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">{cartItem.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              {formatMoney(cartItem.unitPrice)} x {cartItem.quantity}
                            </p>
                          </div>

                          <p className="text-sm font-black text-emerald-700">
                            {formatMoney(cartItem.unitPrice * cartItem.quantity)}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decreaseOrderCartItem(cartItem.menuItemId)}
                            className="h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 text-lg font-black text-slate-700 hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="min-w-10 text-center text-sm font-black text-slate-900">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => increaseOrderCartItem(cartItem.menuItemId)}
                            className="h-9 w-9 rounded-xl border border-emerald-200 bg-emerald-50 text-lg font-black text-emerald-700 hover:bg-emerald-100"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOrderCartItem(cartItem.menuItemId)}
                            className="ml-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                          >
                            Sil
                          </button>
                        </div>

                        <input
                          value={cartItem.note}
                          onChange={(event) => updateOrderCartItemNote(cartItem.menuItemId, event.target.value)}
                          placeholder="Ürün notu"
                          className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
                    <p className="text-sm font-black text-slate-900">Sepet boş</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Telefon siparişi için ürün seç.
                    </p>
                  </div>
                )}

                <label className="mt-4 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Sipariş Notu
                  <textarea
                    value={orderNote}
                    onChange={(event) => setOrderNote(event.target.value)}
                    placeholder="Zil çalışmıyor, acısız olsun vb."
                    rows={3}
                    className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-slate-950 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <button
                  type="button"
                  onClick={createCallerCartOrder}
                  disabled={isCreatingOrder || orderCartItems.length === 0}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-slate-900 px-5 py-4 text-sm font-black text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingOrder ? 'Sipariş Oluşturuluyor...' : 'Caller ID Siparişi Oluştur'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between">
            <div className="w-full">
              <label className="text-sm font-semibold text-slate-700">
                Sipariş Ara
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 shadow-inner text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-400"
                  placeholder="Kod, masa no, müşteri, telefon, adres, not, şube..."
                />
              </label>
            </div>

            {orderSearch ? (
              <button
                type="button"
                onClick={() => setOrderSearch('')}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3.5 shadow-inner text-sm font-bold text-slate-700 transition hover:bg-slate-50/80 md:mt-6"
              >
                Temizle
              </button>
            ) : null}
          </div>

          {orderSearch && filteredOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
              Bu arama sonucunda sipariş bulunamadı.
            </div>
          ) : (
            <>
              {renderOperationalOrderSection(
                'Yeni Siparişler',
                'Yeni gelen siparişlerde sadece Kabul Et ana aksiyonu görünür.',
                newOrderRows,
                'Yeni sipariş yok.',
              )}

              {renderOperationalOrderSection(
                'Yola Çıkarılması Gereken Siparişler',
                'Kabul edilen siparişlerde kurye seçilir ve sipariş yola çıkarılır.',
                dispatchReadyRows,
                'Yola çıkarılması gereken sipariş yok.',
              )}

              {renderOperationalOrderSection(
                'Teslim Edilmesi Gereken Siparişler',
                'Yola çıkan siparişlerde sadece Teslim Et ana aksiyonu görünür.',
                deliveryRows,
                'Teslim edilmesi gereken sipariş yok.',
              )}
            </>
          )}
        </section>
      </div>

      {dispatchCourierOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/70 p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Kurye Seçimi</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {dispatchCourierOrder.code} kodlu siparişi yola çıkarmak için kurye seç.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDispatchCourierModal}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50/80"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {activeCouriers.length === 0 ? (
                <div className="rounded-2xl border border-amber-400/30 bg-white p-4 text-sm font-bold text-amber-700">
                  Aktif kurye bulunamadı. Önce Kurye Tanımları bölümünden en az bir kuryeyi aktif yapmalısın.
                </div>
              ) : (
                activeCouriers.map((courier) => (
                  <label
                    key={courier.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition ${
                      dispatchCourierId === courier.id
                        ? 'border-emerald-400 bg-white'
                        : 'border-slate-200 bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="dispatchCourier"
                        value={courier.id}
                        checked={dispatchCourierId === courier.id}
                        onChange={(event) => setDispatchCourierId(event.target.value)}
                        className="h-4 w-4 accent-emerald-400"
                      />
                      <span className="font-black text-slate-800">{courier.name}</span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDispatchCourierModal}
                disabled={updatingOrderId === dispatchCourierOrder.id}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={submitDispatchCourier}
                disabled={
                  updatingOrderId === dispatchCourierOrder.id ||
                  activeCouriers.length === 0 ||
                  !dispatchCourierId
                }
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingOrderId === dispatchCourierOrder.id ? 'Yola çıkarılıyor...' : 'Yola Çıkar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {courierChangeOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/70 p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800">Kurye Seçimi</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {courierChangeOrder.code} kodlu sipariş yolda kalır, sadece atanmış kuryesi değişir.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCourierChangeModal}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50/80"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {activeCouriers.length === 0 ? (
                <div className="rounded-2xl border border-amber-400/30 bg-white p-4 text-sm font-bold text-amber-700">
                  Aktif kurye bulunamadı. Önce Kurye Tanımları bölümünden en az bir kuryeyi aktif yapmalısın.
                </div>
              ) : (
                activeCouriers.map((courier) => (
                  <label
                    key={courier.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition ${
                      courierChangeCourierId === courier.id
                        ? 'border-emerald-400 bg-white'
                        : 'border-slate-200 bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="courierChange"
                        value={courier.id}
                        checked={courierChangeCourierId === courier.id}
                        onChange={(event) => setCourierChangeCourierId(event.target.value)}
                        className="h-4 w-4 accent-emerald-400"
                      />
                      <span className="font-black text-slate-800">{courier.name}</span>
                    </span>

                    {courier.id === courierChangeOrder.courierId ? (
                      <span className="rounded-full border border-cyan-400/30 bg-white px-3 py-1 text-xs font-black text-sky-700">
                        Mevcut
                      </span>
                    ) : null}
                  </label>
                ))
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCourierChangeModal}
                disabled={updatingOrderId === courierChangeOrder.id}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={submitCourierChange}
                disabled={
                  updatingOrderId === courierChangeOrder.id ||
                  activeCouriers.length === 0 ||
                  !courierChangeCourierId ||
                  courierChangeCourierId === courierChangeOrder.courierId
                }
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingOrderId === courierChangeOrder.id ? 'Kaydediliyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] shadow-black">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  Sipariş Detayı
                </p>
                <h3 className="mt-2 text-2xl font-black">{selectedOrder.code}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {formatOrderDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50/80"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sipariş Tipi
                </p>
                <p className="mt-2 text-lg font-bold">
                  {ORDER_TYPE_LABELS[selectedOrder.type || ''] || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Masa No
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.tableNumber || '-'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Durum
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${
                    ORDER_STATUS_BADGE_CLASSES[selectedOrder.status] ||
                    'border-slate-400/30 bg-slate-50/10 text-slate-700'
                  }`}
                >
                  {ORDER_STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Müşteri
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.customerName || '-'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Telefon
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.customerPhone || '-'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Şube
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.branch?.name || '-'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Toplam
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.total} TL</p>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-white p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Sipariş Ürünleri
                  </p>

                  <div className="mt-3 space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)]"
                      >
                        <div>
                          <p className="font-bold text-slate-950">{item.name}</p>
                          {item.note ? (
                            <p className="mt-1 text-xs text-amber-700">Not: {item.note}</p>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-500">
                            {item.quantity} x {formatMoney(item.unitPrice)}
                          </p>
                          <p className="mt-1 text-base font-black text-emerald-300">
                            {formatMoney(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Adres
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedOrder.customerAddress || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-white p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Not
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-700">
                  {selectedOrder.note || '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-3 text-sm font-bold text-slate-500">Durum Güncelle</p>

              {renderOrderActionArea(selectedOrder)}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
