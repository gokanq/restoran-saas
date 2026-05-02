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
  PENDING: 'border-yellow-400/30 bg-yellow-500/10 text-yellow-200',
  ACCEPTED: 'border-blue-400/30 bg-blue-500/10 text-blue-200',
  PREPARING: 'border-orange-400/30 bg-orange-500/10 text-orange-200',
  READY: 'border-purple-400/30 bg-purple-500/10 text-purple-200',
  ON_DELIVERY: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  DELIVERED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  CANCELLED: 'border-red-400/30 bg-red-500/10 text-red-200',
};

const ORDER_ACTION_BUTTON_CLASSES: Record<string, string> = {
  ACCEPTED: 'border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20',
  PREPARING: 'border-orange-400/30 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20',
  READY: 'border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20',
  ON_DELIVERY: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20',
  DELIVERED: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
  CANCELLED: 'border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20',
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
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-lg font-semibold">Dashboard yükleniyor...</p>
      </main>
    );
  }

  const roleLabel = user ? USER_ROLE_LABELS[user.role] || user.role : '-';

  function renderOrderActionArea(order: Order) {
    const primaryAction = getPrimaryOrderAction(order);
    const isDispatchAction = primaryAction?.value === 'ON_DELIVERY' && order.type === 'DELIVERY';

    const primaryActionClass =
      primaryAction?.value === 'ACCEPTED'
        ? 'border-emerald-300/60 bg-emerald-500 text-slate-950 shadow-emerald-950/30 hover:bg-emerald-400'
        : primaryAction?.value === 'ON_DELIVERY'
          ? 'border-cyan-300/60 bg-cyan-500 text-slate-950 shadow-cyan-950/30 hover:bg-cyan-400'
          : primaryAction?.value === 'DELIVERED'
            ? 'border-green-300/60 bg-green-500 text-slate-950 shadow-green-950/30 hover:bg-green-400'
            : 'border-white/10 bg-slate-800 text-slate-100 hover:bg-slate-700';

    const primaryButton = primaryAction ? (
      <button
        type="button"
        onClick={() =>
          isDispatchAction ? openDispatchCourierModal(order) : updateOrderStatus(order.id, primaryAction.value)
        }
        disabled={updatingOrderId === order.id || (isDispatchAction && activeCouriers.length === 0)}
        className={`min-w-[130px] rounded-2xl border px-5 py-3 text-sm font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${primaryActionClass}`}
      >
        {primaryAction.label}
      </button>
    ) : null;

    return (
      <div className="flex min-w-[220px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">{primaryButton}</div>

        {isDispatchAction && activeCouriers.length === 0 ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">
            Aktif kurye yok.
          </div>
        ) : null}

        {shouldShowCancelAction(order) ? (
          <button
            type="button"
            onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
            disabled={updatingOrderId === order.id}
            className="w-fit rounded-2xl border border-red-300/50 bg-red-500/15 px-5 py-3 text-sm font-black text-red-100 shadow-lg shadow-red-950/20 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            İptal Et
          </button>
        ) : null}
      </div>
    );
  }

  function renderCourierAssignment(order: Order) {
    if (order.courierName) {
      return (
        <div className="mt-2 inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
          Kurye: {order.courierName}
        </div>
      );
    }

    return null;
  }

  function renderOperationalOrderSection(title: string, description: string, rows: Order[], emptyMessage: string) {
    return (
      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-800/55 p-5 shadow-xl shadow-black/10">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-100">{title}</h3>
            <p className="mt-1 text-sm text-slate-300">{description}</p>
          </div>

          <span className="w-fit rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-slate-100">
            {rows.length} sipariş
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-800/70 p-5 text-sm text-slate-100">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1350px] overflow-hidden rounded-2xl text-left text-sm shadow-xl shadow-black/10">
              <thead className="bg-slate-700/80 text-slate-100">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Tip</th>
                  <th className="px-4 py-3">Müşteri</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3">Şube</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Toplam</th>
                  <th className="px-4 py-3">Ödeme</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Detay</th>
                  <th className="px-4 py-3">İşlem</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {rows.map((order) => {
                  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                  const typeLabel = getOrderTypeDisplay(order);
                  const paymentLabel = PAYMENT_METHOD_LABELS[order.paymentMethod || ''] || '-';
                  const statusBadgeClass =
                    ORDER_STATUS_BADGE_CLASSES[order.status] ||
                    'border-slate-400/30 bg-slate-500/10 text-slate-200';

                  return (
                    <tr key={order.id} className="bg-slate-800/45 transition hover:bg-slate-700/55">
                      <td className="px-4 py-4 font-bold">{order.code}</td>

                      <td className="px-4 py-4">
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-slate-100">
                          {typeLabel}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold">{order.customerName || '-'}</div>
                        {order.customerAddress ? (
                          <div className="mt-1 max-w-[220px] truncate text-xs text-slate-300">
                            {order.customerAddress}
                          </div>
                        ) : null}
                        {order.note ? (
                          <div className="mt-1 max-w-[220px] truncate text-xs text-amber-200">
                            Not: {order.note}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">{order.customerPhone || '-'}</td>
                      <td className="px-4 py-4">{order.branch?.name || '-'}</td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusBadgeClass}`}
                        >
                          {statusLabel}
                        </span>
                        {renderCourierAssignment(order)}
                      </td>

                      <td className="px-4 py-4 font-semibold">{formatMoney(order.total)}</td>

                      <td className="px-4 py-4">
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-slate-100">
                          {paymentLabel}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-300">
                        {formatOrderDate(order.createdAt)}
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="rounded-2xl border border-white/10 bg-slate-700/80 px-4 py-3 text-sm font-black text-slate-100 shadow-lg transition hover:bg-slate-600/80"
                        >
                          Detay
                        </button>
                      </td>

                      <td className="px-4 py-4">{renderOrderActionArea(order)}</td>
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
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
              Restoran SaaS
            </p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-300">
              {user ? `${user.name} • ${user.email} • ${roleLabel}` : 'Kullanıcı bilgisi yok'}
            </p>
          </div>

                        <button
                type="button"
                onClick={() => router.push('/dashboard/caller-id')}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-500/20"
              >
                CALLER ID
              </button>

<button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-400"
          >
            Çıkış Yap
          </button>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-3">
            <a
              href="/dashboard/menu"
              className="rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-400"
            >
              Menü
            </a>

            <a
              href="/dashboard/orders/history"
              className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-sm font-black text-slate-200 transition hover:bg-slate-800"
            >
              Geçmiş Siparişler
            </a>

            <a
              href="/dashboard/couriers"
              className="rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-sm font-black text-slate-200 transition hover:bg-slate-800"
            >
              Kuryeler / Gün Sonu
            </a>
          </div>
        </section>


        


        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
            {success}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={() => setOrderFilter('PENDING')}
            className="rounded-3xl border border-yellow-400/20 bg-yellow-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-yellow-500/20"
          >
            <p className="text-sm font-semibold text-yellow-200">Bekleyen</p>
            <p className="mt-2 text-3xl font-black text-yellow-100">{operationalSummary.pending}</p>
            <p className="mt-1 text-xs text-yellow-100/70">Aksiyon bekleyen sipariş</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('PREPARING')}
            className="rounded-3xl border border-orange-400/20 bg-orange-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-orange-500/20"
          >
            <p className="text-sm font-semibold text-orange-200">Hazırlanıyor</p>
            <p className="mt-2 text-3xl font-black text-orange-100">{operationalSummary.preparing}</p>
            <p className="mt-1 text-xs text-orange-100/70">Mutfakta olan sipariş</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('ON_DELIVERY')}
            className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-cyan-500/20"
          >
            <p className="text-sm font-semibold text-cyan-200">Yolda</p>
            <p className="mt-2 text-3xl font-black text-cyan-100">{operationalSummary.onDelivery}</p>
            <p className="mt-1 text-xs text-cyan-100/70">Kurye teslimatında</p>
          </button>

          <button
            type="button"
            onClick={() => setOrderFilter('ALL')}
            className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-left shadow-xl shadow-black/10 transition hover:bg-emerald-500/20"
          >
            <p className="text-sm font-semibold text-emerald-200">Bugünkü Sipariş</p>
            <p className="mt-2 text-3xl font-black text-emerald-100">
              {operationalSummary.todayOrderCount}
            </p>
            <p className="mt-1 text-xs text-emerald-100/70">Bugün oluşturulan sipariş</p>
          </button>

          <div className="rounded-3xl border border-purple-400/20 bg-purple-500/10 p-5 shadow-xl shadow-black/10">
            <p className="text-sm font-semibold text-purple-200">Bugünkü Ciro</p>
            <p className="mt-2 text-3xl font-black text-purple-100">{formattedTodayRevenue}</p>
            <p className="mt-1 text-xs text-purple-100/70">Bugünkü sipariş toplamı</p>
          </div>
        </section>



        

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Operasyon
              </p>
              <h2 className="mt-2 text-2xl font-black">Sipariş Operasyon Ekranı V2</h2>
              <p className="mt-1 text-sm text-slate-400">
                Siparişler aşama aşama ilerler: Kabul Et → Yola Çıkar → Teslim Et. Teslim edilen ve iptal edilen siparişler Geçmiş Siparişler bölümüne aktarılır.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/dashboard/couriers')}
              className="w-fit rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Kurye Takip / Gün Sonu
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 md:flex-row md:items-center md:justify-between">
            <div className="w-full">
              <label className="text-sm font-semibold text-slate-200">
                Sipariş Ara
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
                  placeholder="Kod, masa no, müşteri, telefon, adres, not, şube..."
                />
              </label>
            </div>

            {orderSearch ? (
              <button
                type="button"
                onClick={() => setOrderSearch('')}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 md:mt-6"
              >
                Temizle
              </button>
            ) : null}
          </div>

          {activeOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
              Aktif sipariş yok.
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900 p-6 text-slate-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-100">Kurye Seçimi</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {dispatchCourierOrder.code} kodlu siparişi yola çıkarmak için kurye seç.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDispatchCourierModal}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {activeCouriers.length === 0 ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                  Aktif kurye bulunamadı. Önce Kurye Tanımları bölümünden en az bir kuryeyi aktif yapmalısın.
                </div>
              ) : (
                activeCouriers.map((courier) => (
                  <label
                    key={courier.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition ${
                      dispatchCourierId === courier.id
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
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
                      <span className="font-black text-slate-100">{courier.name}</span>
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
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingOrderId === dispatchCourierOrder.id ? 'Yola çıkarılıyor...' : 'Yola Çıkar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {courierChangeOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-100">Kurye Seçimi</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {courierChangeOrder.code} kodlu sipariş yolda kalır, sadece atanmış kuryesi değişir.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCourierChangeModal}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {activeCouriers.length === 0 ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                  Aktif kurye bulunamadı. Önce Kurye Tanımları bölümünden en az bir kuryeyi aktif yapmalısın.
                </div>
              ) : (
                activeCouriers.map((courier) => (
                  <label
                    key={courier.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition ${
                      courierChangeCourierId === courier.id
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
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
                      <span className="font-black text-slate-100">{courier.name}</span>
                    </span>

                    {courier.id === courierChangeOrder.courierId ? (
                      <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-200">
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
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingOrderId === courierChangeOrder.id ? 'Kaydediliyor...' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  Sipariş Detayı
                </p>
                <h3 className="mt-2 text-2xl font-black">{selectedOrder.code}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  {formatOrderDate(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sipariş Tipi
                </p>
                <p className="mt-2 text-lg font-bold">
                  {ORDER_TYPE_LABELS[selectedOrder.type || ''] || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Masa No
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.tableNumber || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Durum
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${
                    ORDER_STATUS_BADGE_CLASSES[selectedOrder.status] ||
                    'border-slate-400/30 bg-slate-500/10 text-slate-200'
                  }`}
                >
                  {ORDER_STATUS_LABELS[selectedOrder.status] || selectedOrder.status}
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Müşteri
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.customerName || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Telefon
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.customerPhone || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Şube
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.branch?.name || '-'}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Toplam
                </p>
                <p className="mt-2 text-lg font-bold">{selectedOrder.total} TL</p>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    Sipariş Ürünleri
                  </p>

                  <div className="mt-3 space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                      >
                        <div>
                          <p className="font-bold text-white">{item.name}</p>
                          {item.note ? (
                            <p className="mt-1 text-xs text-amber-200">Not: {item.note}</p>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-300">
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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Adres
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {selectedOrder.customerAddress || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                  Not
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-100">
                  {selectedOrder.note || '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-3 text-sm font-bold text-slate-300">Durum Güncelle</p>

              {renderOrderActionArea(selectedOrder)}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
