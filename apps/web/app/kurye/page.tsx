'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Assignment {
  id: string;
  status: string;
  distance: number | null;
  duration: number | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  earnings: number | null;
  order: {
    id: string;
    code: string;
    customerName: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
    total: number;
    items: Array<{ id: string; quantity: number; menuItem: { name: string } }>;
  };
}

interface CourierMe {
  id: string;
  name: string;
  phone: string | null;
  isAvailable: boolean;
  isOnline: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Yeni Atama',
  ACCEPTED: 'Kabul Edildi',
  PICKED_UP: 'Sipariş Alındı',
  DELIVERING: 'Teslimat Yolda',
  DELIVERED: 'Teslim Edildi',
};

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: 'bg-blue-500',
  ACCEPTED: 'bg-purple-500',
  PICKED_UP: 'bg-amber-500',
  DELIVERING: 'bg-cyan-500',
  DELIVERED: 'bg-green-500',
};

export default function CourierDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<CourierMe | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'active' | 'denied'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  function getToken() {
    return typeof window !== 'undefined' ? localStorage.getItem('courierToken') : null;
  }

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-courier-token': getToken() || '',
    };
  }

  // Auth check
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/kurye/login');
      return;
    }
    fetchMe();
    fetchAssignments();
    startLocationTracking();
    const interval = setInterval(fetchAssignments, 10000);
    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMe() {
    try {
      const res = await fetch('/api/courier-portal/me', { headers: authHeaders() });
      if (res.ok) setMe(await res.json());
      else if (res.status === 401) {
        localStorage.removeItem('courierToken');
        router.push('/kurye/login');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchAssignments() {
    try {
      const res = await fetch('/api/courier-portal/assignments', { headers: authHeaders() });
      if (res.ok) {
        setAssignments(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function startLocationTracking() {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setLocationStatus('active');
        try {
          await fetch('/api/courier-portal/location', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          });
        } catch (e) {
          console.error('location update failed', e);
        }
      },
      (err) => {
        console.error('geolocation error:', err);
        setLocationStatus('denied');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );
  }

  async function toggleAvailability() {
    if (!me) return;
    try {
      const res = await fetch('/api/courier-portal/availability', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ isAvailable: !me.isAvailable }),
      });
      if (res.ok) await fetchMe();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAction(id: string, action: 'accept' | 'picked-up' | 'delivering' | 'delivered' | 'reject') {
    setActionLoading(id + action);
    try {
      const res = await fetch(`/api/courier-portal/assignments/${id}/${action}`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (res.ok) {
        await fetchAssignments();
      } else {
        const err = await res.json();
        alert(err.message || 'İşlem başarısız');
      }
    } catch {
      alert('Bağlantı hatası');
    } finally {
      setActionLoading(null);
    }
  }

  function logout() {
    fetch('/api/courier-auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
    localStorage.removeItem('courierToken');
    localStorage.removeItem('courierName');
    router.push('/kurye/login');
  }

  function openMaps(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">{me?.name || 'Kurye'}</h1>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`flex items-center gap-1 ${
                  locationStatus === 'active'
                    ? 'text-green-600'
                    : locationStatus === 'denied'
                      ? 'text-red-500'
                      : 'text-gray-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    locationStatus === 'active'
                      ? 'bg-green-500'
                      : locationStatus === 'denied'
                        ? 'bg-red-500'
                        : 'bg-gray-300'
                  }`}
                />
                {locationStatus === 'active'
                  ? 'Konum aktif'
                  : locationStatus === 'denied'
                    ? 'Konum izni yok'
                    : 'Konum bekleniyor...'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-red-500 px-2 py-1"
          >
            Çıkış
          </button>
        </div>

        {/* Availability Toggle */}
        <div className="max-w-md mx-auto px-4 pb-3">
          <button
            onClick={toggleAvailability}
            className={`w-full py-3 rounded-xl font-semibold transition ${
              me?.isAvailable
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {me?.isAvailable ? '🟢 Müsaitim — Sipariş Alabilirim' : '⚪ Müsait Değilim'}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {assignments.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-gray-500 font-medium">Şu an aktif teslimat yok</p>
            <p className="text-xs text-gray-400 mt-1">
              Yeni atama geldiğinde burada görünecek
            </p>
          </div>
        ) : (
          assignments.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className={`${STATUS_COLORS[a.status] || 'bg-gray-500'} px-4 py-2 text-white text-sm font-semibold`}>
                {STATUS_LABELS[a.status] || a.status} · #{a.order.code}
              </div>

              <div className="p-4 space-y-3">
                {/* Customer Info */}
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Müşteri</div>
                  <div className="font-semibold text-gray-900">{a.order.customerName || '-'}</div>
                  {a.order.customerPhone && (
                    <a
                      href={`tel:${a.order.customerPhone}`}
                      className="text-blue-600 text-sm font-medium"
                    >
                      📞 {a.order.customerPhone}
                    </a>
                  )}
                </div>

                {/* Address */}
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Teslimat Adresi</div>
                  <div className="text-sm text-gray-700">{a.order.customerAddress || '-'}</div>
                  {a.order.deliveryLat && a.order.deliveryLng && (
                    <button
                      onClick={() => openMaps(Number(a.order.deliveryLat), Number(a.order.deliveryLng))}
                      className="mt-2 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium"
                    >
                      🗺️ Harita ile yol tarifi
                    </button>
                  )}
                </div>

                {/* Order Info */}
                <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                  <div>
                    <div className="text-xs text-gray-500">Sipariş Tutarı</div>
                    <div className="font-bold text-green-600">₺{Number(a.order.total).toFixed(2)}</div>
                  </div>
                  {a.distance && (
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Mesafe</div>
                      <div className="font-bold text-gray-900">
                        {Number(a.distance).toFixed(1)} km · {a.duration} dk
                      </div>
                    </div>
                  )}
                </div>

                {/* Items */}
                {a.order.items?.length > 0 && (
                  <details className="bg-gray-50 rounded-lg p-3">
                    <summary className="text-xs text-gray-600 cursor-pointer font-medium">
                      Sipariş içeriği ({a.order.items.length})
                    </summary>
                    <div className="mt-2 space-y-1">
                      {a.order.items.map((it) => (
                        <div key={it.id} className="text-sm text-gray-700">
                          {it.quantity}x {it.menuItem.name}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  {a.status === 'ASSIGNED' && (
                    <>
                      <button
                        onClick={() => handleAction(a.id, 'accept')}
                        disabled={actionLoading === a.id + 'accept'}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50"
                      >
                        ✓ Kabul Et
                      </button>
                      <button
                        onClick={() => handleAction(a.id, 'reject')}
                        disabled={actionLoading === a.id + 'reject'}
                        className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-medium text-sm disabled:opacity-50"
                      >
                        Reddet
                      </button>
                    </>
                  )}
                  {a.status === 'ACCEPTED' && (
                    <button
                      onClick={() => handleAction(a.id, 'picked-up')}
                      disabled={actionLoading === a.id + 'picked-up'}
                      className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold disabled:opacity-50"
                    >
                      📦 Siparişi Aldım
                    </button>
                  )}
                  {a.status === 'PICKED_UP' && (
                    <button
                      onClick={() => handleAction(a.id, 'delivering')}
                      disabled={actionLoading === a.id + 'delivering'}
                      className="w-full py-3 bg-cyan-500 text-white rounded-xl font-semibold disabled:opacity-50"
                    >
                      🛵 Yola Çıktım
                    </button>
                  )}
                  {a.status === 'DELIVERING' && (
                    <button
                      onClick={() => handleAction(a.id, 'delivered')}
                      disabled={actionLoading === a.id + 'delivered'}
                      className="w-full py-3 bg-green-500 text-white rounded-xl font-semibold disabled:opacity-50"
                    >
                      ✅ Teslim Edildi
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
