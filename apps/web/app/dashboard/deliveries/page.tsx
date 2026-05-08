'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const DEFAULT_CENTER: [number, number] = [29.0271, 40.9923];

interface Courier {
  id: string;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
  isAvailable: boolean;
  lastLocationAt: string | null;
  assignments: Array<{
    id: string;
    orderId: string;
    status: string;
    distance: number | null;
    duration: number | null;
    order: {
      code: string;
      customerName: string | null;
      customerAddress: string | null;
      deliveryLat: number | null;
      deliveryLng: number | null;
      total: number;
    };
  }>;
}

interface UnassignedOrder {
  id: string;
  code: string;
  status: string;
  customerName: string | null;
  customerAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  total: number;
  createdAt: string;
}

interface ActiveAssignment {
  id: string;
  status: string;
  distance: number | null;
  duration: number | null;
  routeGeometry: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  order: {
    id: string;
    code: string;
    customerName: string | null;
    customerAddress: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
    total: number;
  };
  courier: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: '#3b82f6',
  ACCEPTED: '#8b5cf6',
  PICKED_UP: '#f59e0b',
  DELIVERING: '#06b6d4',
  DELIVERED: '#10b981',
};

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Atandı',
  ACCEPTED: 'Kabul Edildi',
  PICKED_UP: 'Sipariş Alındı',
  DELIVERING: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  PENDING: 'Yeni',
  PREPARING: 'Hazırlanıyor',
  READY: 'Hazır',
};

const STATUS_BG: Record<string, string> = {
  ASSIGNED: 'bg-blue-50 text-blue-700 ring-blue-200',
  ACCEPTED: 'bg-violet-50 text-violet-700 ring-violet-200',
  PICKED_UP: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELIVERING: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

type Toast = { id: number; type: 'success' | 'error' | 'info'; message: string };

// Haversine fallback distance for sorting
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '-';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} sn önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

export default function DeliveriesPage() {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const routeLayersRef = useRef<string[]>([]);
  const mapReadyRef = useRef(false);

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedOrder[]>([]);
  const [active, setActive] = useState<ActiveAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<UnassignedOrder | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [activeTab, setActiveTab] = useState<'unassigned' | 'active' | 'couriers'>('unassigned');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusOnMap, setFocusOnMap] = useState<{ lat: number; lng: number } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  function showToast(type: Toast['type'], message: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  // Map init
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN) {
      setTokenError(true);
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    map.current.on('load', () => {
      mapReadyRef.current = true;
    });

    return () => {
      map.current?.remove();
      map.current = null;
      mapReadyRef.current = false;
    };
  }, []);

  // Fetch
  const fetchAll = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const [couriersRes, unassignedRes, activeRes] = await Promise.all([
          fetch('/api/deliveries/active-couriers', { headers }),
          fetch('/api/deliveries/orders/unassigned', { headers }),
          fetch('/api/deliveries/assignments/active', { headers }),
        ]);

        if (couriersRes.status === 401) {
          router.push('/login');
          return;
        }

        if (couriersRes.ok) setCouriers(await couriersRes.json());
        if (unassignedRes.ok) setUnassigned(await unassignedRes.json());
        if (activeRes.ok) setActive(await activeRes.json());
        setLastUpdate(new Date());
      } catch (e) {
        if (!silent) showToast('error', 'Bağlantı hatası');
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(true), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers + routes update
  useEffect(() => {
    if (!map.current || tokenError || !mapReadyRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Clear old route layers
    routeLayersRef.current.forEach((id) => {
      if (map.current?.getLayer(id)) map.current.removeLayer(id);
      if (map.current?.getSource(id)) map.current.removeSource(id);
    });
    routeLayersRef.current = [];

    // Courier markers (with pulse animation for online)
    couriers.forEach((c) => {
      if (!c.latitude || !c.longitude) return;

      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.cursor = 'pointer';

      if (c.isOnline) {
        const pulse = document.createElement('div');
        pulse.className = 'courier-pulse';
        wrapper.appendChild(pulse);
      }

      const dot = document.createElement('div');
      dot.style.width = '36px';
      dot.style.height = '36px';
      dot.style.borderRadius = '50%';
      dot.style.background = c.isOnline
        ? c.isAvailable
          ? 'linear-gradient(135deg, #10b981, #059669)'
          : 'linear-gradient(135deg, #f59e0b, #d97706)'
        : '#9ca3af';
      dot.style.border = '3px solid white';
      dot.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
      dot.style.display = 'flex';
      dot.style.alignItems = 'center';
      dot.style.justifyContent = 'center';
      dot.style.fontSize = '15px';
      dot.style.color = 'white';
      dot.style.fontWeight = '700';
      dot.style.position = 'relative';
      dot.style.zIndex = '2';
      dot.innerText = c.name.charAt(0).toUpperCase();
      wrapper.appendChild(dot);

      const popup = new mapboxgl.Popup({ offset: 28, closeButton: false, className: 'rs-popup' })
        .setHTML(
          `<div style="padding:8px;min-width:180px">
            <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:4px">${c.name}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${c.phone || '—'}</div>
            <div style="display:flex;gap:6px;align-items:center;font-size:11px">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${
                c.isOnline ? (c.isAvailable ? '#10b981' : '#f59e0b') : '#9ca3af'
              }"></span>
              <span style="color:${c.isOnline ? '#111827' : '#6b7280'};font-weight:500">${
                c.isOnline ? (c.isAvailable ? 'Müsait' : 'Meşgul') : 'Çevrimdışı'
              }</span>
              <span style="color:#9ca3af;margin-left:auto">${c.assignments.length} aktif</span>
            </div>
          </div>`,
        );

      const marker = new mapboxgl.Marker(wrapper)
        .setLngLat([Number(c.longitude), Number(c.latitude)])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Unassigned order markers (red pin)
    unassigned.forEach((o) => {
      if (!o.deliveryLat || !o.deliveryLng) return;

      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow${o.id}" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
            </filter>
          </defs>
          <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#ef4444" filter="url(#shadow${o.id})"/>
          <circle cx="14" cy="14" r="6" fill="white"/>
          <text x="14" y="18" font-size="10" font-weight="700" text-anchor="middle" fill="#ef4444">!</text>
        </svg>`;

      const popup = new mapboxgl.Popup({ offset: 30, closeButton: false, className: 'rs-popup' })
        .setHTML(
          `<div style="padding:8px;min-width:200px">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
              <span style="font-weight:700;font-size:14px;color:#111827">#${o.code}</span>
              <span style="font-size:10px;background:#fef2f2;color:#b91c1c;padding:2px 6px;border-radius:99px;font-weight:600">ATANMAMIŞ</span>
            </div>
            <div style="font-size:13px;color:#374151;margin-bottom:2px">${o.customerName || '—'}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${o.customerAddress || ''}</div>
            <div style="font-size:14px;font-weight:700;color:#10b981">₺${Number(o.total).toFixed(2)}</div>
          </div>`,
        );

      const marker = new mapboxgl.Marker(el, { anchor: 'bottom' })
        .setLngLat([Number(o.deliveryLng), Number(o.deliveryLat)])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Active assignment routes + dropoff markers
    active.forEach((a, idx) => {
      if (!a.dropoffLat || !a.dropoffLng) return;

      // Dropoff marker (colored by status)
      const el = document.createElement('div');
      el.style.cursor = 'pointer';
      const statusColor = STATUS_COLORS[a.status] || '#3b82f6';
      el.innerHTML = `
        <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${statusColor}"/>
          <circle cx="14" cy="14" r="6" fill="white"/>
        </svg>`;

      const popup = new mapboxgl.Popup({ offset: 30, closeButton: false, className: 'rs-popup' })
        .setHTML(
          `<div style="padding:8px;min-width:200px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-weight:700;font-size:14px">#${a.order.code}</span>
              <span style="font-size:10px;background:${statusColor}20;color:${statusColor};padding:2px 6px;border-radius:99px;font-weight:600">${
                STATUS_LABELS[a.status] || a.status
              }</span>
            </div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">🚴 ${a.courier.name}</div>
            <div style="font-size:13px;color:#374151;margin-bottom:2px">${a.order.customerName || '—'}</div>
            ${
              a.distance
                ? `<div style="font-size:11px;color:#6b7280">${Number(a.distance).toFixed(1)} km · ${a.duration} dk</div>`
                : ''
            }
          </div>`,
        );

      const marker = new mapboxgl.Marker(el, { anchor: 'bottom' })
        .setLngLat([Number(a.dropoffLng), Number(a.dropoffLat)])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);

      // Route line (if Mapbox geometry available)
      if (a.routeGeometry) {
        try {
          const geo = JSON.parse(a.routeGeometry);
          const layerId = `route-${a.id}-${idx}`;
          map.current!.addSource(layerId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: geo,
            },
          });
          map.current!.addLayer({
            id: layerId,
            type: 'line',
            source: layerId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': statusColor,
              'line-width': 4,
              'line-opacity': 0.7,
            },
          });
          routeLayersRef.current.push(layerId);
        } catch (e) {
          console.warn('route geom parse failed', e);
        }
      } else if (a.courier.latitude && a.courier.longitude) {
        // Fallback: straight line from courier to dropoff
        const layerId = `route-line-${a.id}-${idx}`;
        map.current!.addSource(layerId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [Number(a.courier.longitude), Number(a.courier.latitude)],
                [Number(a.dropoffLng), Number(a.dropoffLat)],
              ],
            },
          },
        });
        map.current!.addLayer({
          id: layerId,
          type: 'line',
          source: layerId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': statusColor,
            'line-width': 3,
            'line-opacity': 0.5,
            'line-dasharray': [2, 2],
          },
        });
        routeLayersRef.current.push(layerId);
      }
    });
  }, [couriers, unassigned, active, tokenError]);

  // Auto-fit bounds (sadece ilk yüklemede)
  const [hasFit, setHasFit] = useState(false);
  useEffect(() => {
    if (!map.current || hasFit || tokenError || !mapReadyRef.current) return;
    const points: [number, number][] = [];
    couriers.forEach((c) => {
      if (c.latitude && c.longitude) points.push([Number(c.longitude), Number(c.latitude)]);
    });
    unassigned.forEach((o) => {
      if (o.deliveryLat && o.deliveryLng) points.push([Number(o.deliveryLng), Number(o.deliveryLat)]);
    });
    active.forEach((a) => {
      if (a.dropoffLat && a.dropoffLng) points.push([Number(a.dropoffLng), Number(a.dropoffLat)]);
    });
    if (points.length > 1) {
      const bounds = points.reduce(
        (b, p) => b.extend(p),
        new mapboxgl.LngLatBounds(points[0], points[0]),
      );
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
      setHasFit(true);
    }
  }, [couriers, unassigned, active, hasFit, tokenError]);

  // Focus on map (when user clicks list item)
  useEffect(() => {
    if (focusOnMap && map.current && mapReadyRef.current) {
      map.current.flyTo({
        center: [focusOnMap.lng, focusOnMap.lat],
        zoom: 15,
        duration: 800,
      });
      setFocusOnMap(null);
    }
  }, [focusOnMap]);

  async function handleAutoAssign(orderId: string) {
    try {
      const res = await fetch(`/api/deliveries/orders/${orderId}/auto-assign`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        showToast('success', `${data.courier?.name || 'Kurye'}'a otomatik atandı`);
        await fetchAll();
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Atama başarısız');
      }
    } catch {
      showToast('error', 'Bağlantı hatası');
    }
  }

  async function handleManualAssign(orderId: string, courierId: string) {
    try {
      const res = await fetch(`/api/deliveries/orders/${orderId}/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ courierId }),
      });
      if (res.ok) {
        const c = couriers.find((x) => x.id === courierId);
        showToast('success', `${c?.name || 'Kurye'}'a atandı`);
        await fetchAll();
        setShowAssignModal(false);
        setSelectedOrder(null);
      } else {
        const err = await res.json();
        showToast('error', err.message || 'Atama başarısız');
      }
    } catch {
      showToast('error', 'Bağlantı hatası');
    }
  }

  async function handleCancel(assignmentId: string) {
    if (!confirm('Bu atamayı iptal etmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/deliveries/assignments/${assignmentId}/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: 'manuel iptal' }),
      });
      if (res.ok) {
        showToast('success', 'Atama iptal edildi');
        await fetchAll();
      }
    } catch {
      showToast('error', 'Hata');
    }
  }

  // Stats
  const onlineCount = couriers.filter((c) => c.isOnline).length;
  const availableCount = couriers.filter((c) => c.isOnline && c.isAvailable).length;
  const totalRevenueActive = active.reduce((s, a) => s + Number(a.order.total || 0), 0);

  // Sort couriers by distance from selected order in modal
  const sortedCouriersForModal = selectedOrder?.deliveryLat && selectedOrder?.deliveryLng
    ? [...couriers].sort((a, b) => {
        const distA =
          a.latitude && a.longitude
            ? haversine(a.latitude, a.longitude, selectedOrder.deliveryLat!, selectedOrder.deliveryLng!)
            : 9999;
        const distB =
          b.latitude && b.longitude
            ? haversine(b.latitude, b.longitude, selectedOrder.deliveryLat!, selectedOrder.deliveryLng!)
            : 9999;
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        return distA - distB;
      })
    : couriers;

  // Filtered lists by search
  const filteredUnassigned = unassigned.filter(
    (o) =>
      !searchQuery ||
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerAddress || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredActive = active.filter(
    (a) =>
      !searchQuery ||
      a.order.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.courier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.order.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredCouriers = couriers.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || '').includes(searchQuery),
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <div className="text-sm text-slate-500 font-medium">Teslimatlar yükleniyor…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style jsx global>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .courier-pulse {
          position: absolute;
          top: -3px;
          left: -3px;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.4);
          animation: pulse-ring 2s ease-out infinite;
          z-index: 1;
        }
        .rs-popup .mapboxgl-popup-content {
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          padding: 0;
        }
        .rs-popup .mapboxgl-popup-tip {
          border-top-color: white !important;
        }
        @keyframes slide-in-right {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast-enter {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>

      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Back */}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 transition text-slate-600"
              title="Panele dön"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Breadcrumb + Title */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Panel</span>
                <span className="text-slate-300">/</span>
                <span className="font-medium text-slate-700">Canlı Teslimat</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight truncate">Teslimat Operasyonu</h1>
            </div>

            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 bg-emerald-50 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-700">CANLI</span>
              <span className="text-xs text-emerald-600/80">
                {lastUpdate ? `· ${formatRelativeTime(lastUpdate.toISOString())}` : ''}
              </span>
            </div>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => fetchAll()}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:opacity-60"
              >
                <svg
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 014.582 15M19.418 15H15" />
                </svg>
                <span className="hidden sm:inline">Yenile</span>
              </button>
              <button
                onClick={() => router.push('/dashboard/couriers')}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
              >
                Kurye Yönetimi
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          <KpiCard
            label="Online Kurye"
            value={onlineCount}
            sublabel={`${couriers.length} toplam`}
            color="emerald"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h-2m4 6H9m6 0v6m-6 0v-6m4 0V9a4 4 0 00-8 0v4m4 0a4 4 0 008 0V9" />
              </svg>
            }
          />
          <KpiCard
            label="Müsait"
            value={availableCount}
            sublabel="atamaya hazır"
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            }
          />
          <KpiCard
            label="Atanmamış"
            value={unassigned.length}
            sublabel={unassigned.length > 0 ? 'aksiyon bekliyor' : 'tüm siparişler atandı'}
            color={unassigned.length > 0 ? 'red' : 'slate'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <KpiCard
            label="Aktif Teslimat"
            value={active.length}
            sublabel={`₺${totalRevenueActive.toFixed(0)} cironun yolda`}
            color="violet"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m12 0h2a1 1 0 001-1v-4.586a1 1 0 00-.293-.707l-1.414-1.414A1 1 0 0017 9H13m-6 8h6" />
              </svg>
            }
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
          {/* Map */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden h-[600px] xl:h-[calc(100vh-220px)] xl:min-h-[600px] relative">
              {tokenError ? (
                <div className="h-full flex items-center justify-center bg-slate-50 p-8">
                  <div className="text-center max-w-md">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                      <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-slate-900 mb-2">Mapbox Token Tanımlı Değil</p>
                    <p className="text-sm text-slate-600 mb-3">
                      Harita için <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> environment variable&apos;ı tanımlanmalı.
                    </p>
                  </div>
                </div>
              ) : (
                <div ref={mapContainer} className="w-full h-full" />
              )}

              {/* Floating Legend */}
              {!tokenError && (
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200/60 p-3 text-xs space-y-2">
                  <div className="font-semibold text-slate-700 mb-1">Harita Açıklama</div>
                  <div className="flex items-center gap-2">
                    <span className="relative w-3 h-3">
                      <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                      <span className="relative w-3 h-3 inline-block rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-slate-700">Online · Müsait</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-slate-700">Online · Meşgul</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-slate-700">Çevrimdışı</span>
                  </div>
                  <div className="border-t border-slate-200/70 my-1.5"></div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-slate-700">Atanmamış sipariş</span>
                  </div>
                </div>
              )}

              {/* Active count badge top-left */}
              {!tokenError && active.length > 0 && (
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200/60 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{active.length}</span>
                    <span className="text-slate-600">aktif teslimat haritada</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Tabbed */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-[600px] xl:h-[calc(100vh-220px)] xl:min-h-[600px]">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <TabButton
                label="Atanmamış"
                count={unassigned.length}
                active={activeTab === 'unassigned'}
                onClick={() => setActiveTab('unassigned')}
                badge={unassigned.length > 0}
              />
              <TabButton
                label="Aktif"
                count={active.length}
                active={activeTab === 'active'}
                onClick={() => setActiveTab('active')}
              />
              <TabButton
                label="Kuryeler"
                count={couriers.length}
                active={activeTab === 'couriers'}
                onClick={() => setActiveTab('couriers')}
              />
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/40">
              <div className="relative">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Sipariş, müşteri veya kurye ara…"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'unassigned' && (
                <div className="p-3 space-y-2">
                  {filteredUnassigned.length === 0 ? (
                    <EmptyState
                      icon="📦"
                      title={searchQuery ? 'Sonuç bulunamadı' : 'Tüm siparişler atandı'}
                      subtitle={searchQuery ? 'Farklı bir arama deneyin' : 'Yeni sipariş geldiğinde burada görünecek'}
                    />
                  ) : (
                    filteredUnassigned.map((o) => (
                      <UnassignedCard
                        key={o.id}
                        order={o}
                        onAuto={() => handleAutoAssign(o.id)}
                        onManual={() => {
                          setSelectedOrder(o);
                          setShowAssignModal(true);
                        }}
                        onLocate={() => {
                          if (o.deliveryLat && o.deliveryLng)
                            setFocusOnMap({ lat: o.deliveryLat, lng: o.deliveryLng });
                        }}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'active' && (
                <div className="p-3 space-y-2">
                  {filteredActive.length === 0 ? (
                    <EmptyState
                      icon="🛵"
                      title={searchQuery ? 'Sonuç bulunamadı' : 'Aktif teslimat yok'}
                      subtitle={searchQuery ? 'Farklı bir arama deneyin' : 'Atanan siparişler buraya düşecek'}
                    />
                  ) : (
                    filteredActive.map((a) => (
                      <ActiveCard
                        key={a.id}
                        a={a}
                        onCancel={() => handleCancel(a.id)}
                        onLocate={() => {
                          if (a.dropoffLat && a.dropoffLng)
                            setFocusOnMap({ lat: a.dropoffLat, lng: a.dropoffLng });
                        }}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'couriers' && (
                <div className="p-3 space-y-2">
                  {filteredCouriers.length === 0 ? (
                    <EmptyState icon="🚴" title="Kurye yok" subtitle="Kurye yönetiminden ekleyin" />
                  ) : (
                    filteredCouriers.map((c) => (
                      <CourierRow
                        key={c.id}
                        courier={c}
                        onLocate={() => {
                          if (c.latitude && c.longitude)
                            setFocusOnMap({ lat: c.latitude, lng: c.longitude });
                        }}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedOrder && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowAssignModal(false)}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Kurye Ata</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    <span className="font-semibold text-slate-700">#{selectedOrder.code}</span>
                    {' · '}
                    {selectedOrder.customerName || '—'}
                    {' · ₺'}
                    {Number(selectedOrder.total).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 -m-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-3 max-h-[60vh] overflow-y-auto">
              {sortedCouriersForModal.length === 0 ? (
                <EmptyState icon="🚴" title="Kurye yok" subtitle="Kurye eklemek için kurye yönetimine gidin" />
              ) : (
                <div className="space-y-2">
                  {sortedCouriersForModal.map((c) => {
                    const dist =
                      c.latitude && c.longitude && selectedOrder.deliveryLat && selectedOrder.deliveryLng
                        ? haversine(
                            c.latitude,
                            c.longitude,
                            selectedOrder.deliveryLat,
                            selectedOrder.deliveryLng,
                          )
                        : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleManualAssign(selectedOrder.id, c.id)}
                        disabled={!c.isOnline}
                        className={`w-full text-left p-3 rounded-xl border transition group ${
                          c.isOnline
                            ? 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-sm'
                            : 'border-slate-100 bg-slate-50/60 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                              c.isOnline
                                ? c.isAvailable
                                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                  : 'bg-gradient-to-br from-amber-500 to-amber-600'
                                : 'bg-gradient-to-br from-slate-400 to-slate-500'
                            }`}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                              <StatusPill courier={c} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                              {c.phone && <span>{c.phone}</span>}
                              {c.assignments.length > 0 && (
                                <span>{c.assignments.length} aktif</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {dist !== null && (
                              <div className="text-sm font-bold text-slate-900">
                                {dist.toFixed(1)} <span className="text-xs text-slate-500 font-medium">km</span>
                              </div>
                            )}
                            {c.isOnline && (
                              <div className="text-[10px] text-blue-600 font-semibold mt-0.5 group-hover:underline">
                                Ata →
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex gap-2">
              <button
                onClick={() => {
                  if (selectedOrder) handleAutoAssign(selectedOrder.id);
                  setShowAssignModal(false);
                }}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
              >
                ⚡ Otomatik Ata (en yakın)
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[60] space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-start gap-3 backdrop-blur ${
              t.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
                : t.type === 'error'
                  ? 'bg-red-50/95 border-red-200 text-red-800'
                  : 'bg-blue-50/95 border-blue-200 text-blue-800'
            }`}
          >
            <span className="text-lg leading-none mt-0.5">
              {t.type === 'success' ? '✓' : t.type === 'error' ? '!' : 'ℹ'}
            </span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Sub Components =====

function KpiCard({
  label,
  value,
  sublabel,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  sublabel: string;
  color: 'emerald' | 'blue' | 'red' | 'violet' | 'slate';
  icon: React.ReactNode;
}) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-100' },
    blue: { bg: 'bg-blue-50', fg: 'text-blue-700', ring: 'ring-blue-100' },
    red: { bg: 'bg-red-50', fg: 'text-red-700', ring: 'ring-red-100' },
    violet: { bg: 'bg-violet-50', fg: 'text-violet-700', ring: 'ring-violet-100' },
    slate: { bg: 'bg-slate-50', fg: 'text-slate-700', ring: 'ring-slate-100' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
          <div className="text-3xl font-bold text-slate-900 mt-1 leading-none">{value}</div>
          <div className="text-xs text-slate-500 mt-2">{sublabel}</div>
        </div>
        <div className={`${c.bg} ${c.fg} ring-1 ${c.ring} rounded-xl p-2`}>{icon}</div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
  badge,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-3 text-sm font-semibold transition relative ${
        active
          ? 'text-blue-700 bg-blue-50/40'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span>{label}</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
            active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {count}
        </span>
        {badge && count > 0 && !active && (
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
        )}
      </div>
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-t-full" />
      )}
    </button>
  );
}

function StatusPill({ courier }: { courier: Courier }) {
  if (!courier.isOnline) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
        Offline
      </span>
    );
  }
  if (courier.isAvailable) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
        Müsait
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      Meşgul
    </span>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3 opacity-70">{icon}</div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <div className="text-xs text-slate-400 mt-1">{subtitle}</div>
    </div>
  );
}

function UnassignedCard({
  order,
  onAuto,
  onManual,
  onLocate,
}: {
  order: UnassignedOrder;
  onAuto: () => void;
  onManual: () => void;
  onLocate: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition p-3">
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onLocate}
            className="text-xs font-bold text-slate-900 hover:text-blue-600 truncate"
            title="Haritada göster"
          >
            #{order.code}
          </button>
          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-50 text-red-700 ring-1 ring-red-100">
            Atanmamış
          </span>
        </div>
        <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
          ₺{Number(order.total).toFixed(2)}
        </span>
      </div>
      <div className="text-xs text-slate-600 truncate">{order.customerName || '—'}</div>
      <div className="text-xs text-slate-400 truncate mb-2.5">{order.customerAddress || '—'}</div>
      <div className="flex gap-1.5">
        <button
          onClick={onAuto}
          className="flex-1 px-2 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          ⚡ Otomatik
        </button>
        <button
          onClick={onManual}
          className="flex-1 px-2 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
        >
          Manuel
        </button>
        <button
          onClick={onLocate}
          className="px-2 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          title="Haritada göster"
        >
          📍
        </button>
      </div>
    </div>
  );
}

function ActiveCard({
  a,
  onCancel,
  onLocate,
}: {
  a: ActiveAssignment;
  onCancel: () => void;
  onLocate: () => void;
}) {
  const statusBg = STATUS_BG[a.status] || 'bg-slate-100 text-slate-700 ring-slate-200';
  const steps = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'DELIVERING'];
  const currentStep = steps.indexOf(a.status);

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition p-3">
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onLocate}
            className="text-xs font-bold text-slate-900 hover:text-blue-600 truncate"
            title="Haritada göster"
          >
            #{a.order.code}
          </button>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ${statusBg}`}
          >
            {STATUS_LABELS[a.status] || a.status}
          </span>
        </div>
        <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
          ₺{Number(a.order.total).toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-700 mb-1">
        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
          {a.courier.name.charAt(0)}
        </span>
        <span className="font-medium truncate">{a.courier.name}</span>
        {a.distance && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 whitespace-nowrap">
              {Number(a.distance).toFixed(1)}km · {a.duration}dk
            </span>
          </>
        )}
      </div>

      <div className="text-xs text-slate-600 truncate">{a.order.customerName || '—'}</div>
      <div className="text-xs text-slate-400 truncate mb-2">{a.order.customerAddress || '—'}</div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-2.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${
              i <= currentStep
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={onLocate}
          className="flex-1 px-2 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
        >
          📍 Haritada Göster
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
        >
          İptal
        </button>
      </div>
    </div>
  );
}

function CourierRow({ courier, onLocate }: { courier: Courier; onLocate: () => void }) {
  return (
    <button
      onClick={onLocate}
      disabled={!courier.latitude || !courier.longitude}
      className="w-full bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition p-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              courier.isOnline
                ? courier.isAvailable
                  ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  : 'bg-gradient-to-br from-amber-500 to-amber-600'
                : 'bg-gradient-to-br from-slate-400 to-slate-500'
            }`}
          >
            {courier.name.charAt(0).toUpperCase()}
          </div>
          {courier.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 truncate">{courier.name}</span>
            <StatusPill courier={courier} />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            {courier.phone && <span>{courier.phone}</span>}
            <span>·</span>
            <span>{courier.assignments.length} aktif</span>
            {courier.lastLocationAt && (
              <>
                <span>·</span>
                <span className="truncate">{formatRelativeTime(courier.lastLocationAt)}</span>
              </>
            )}
          </div>
        </div>
        {courier.latitude && courier.longitude && (
          <span className="text-slate-400 text-sm">📍</span>
        )}
      </div>
    </button>
  );
}
