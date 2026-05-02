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
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
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



        

        <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)] shadow-black/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Operasyon
              </p>
              <h2 className="mt-2 text-2xl font-black">Sipariş Operasyon Ekranı V2</h2>
              <p className="mt-1 text-sm text-slate-500">
                Siparişler aşama aşama ilerler: Kabul Et → Yola Çıkar → Teslim Et. Teslim edilen ve iptal edilen siparişler Geçmiş Siparişler bölümüne aktarılır.
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

          {activeOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
              Aktif sipariş yok.
            </div>
          ) : filteredOrders.length === 0 ? (
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
