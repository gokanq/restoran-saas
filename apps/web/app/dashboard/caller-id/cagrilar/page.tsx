"use client";

import { useEffect, useMemo, useState } from "react";

type CallerEvent = {
  id: string;
  phone?: string | null;
  customerName?: string | null;
  status?: string | null;
  seenAt?: string | null;
  receivedAt?: string | null;
  createdAt?: string | null;
  convertedAt?: string | null;
  orderId?: string | null;
  orderCode?: string | null;
  source?: string | null;
  callerDeviceId?: string | null;
  callerDeviceName?: string | null;
};

type CallTab = "ALL" | "NEW" | "CONVERTED";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function apiPath(path: string) {
  return API_BASE ? `${API_BASE}${path}` : `/api${path}`;
}

function getToken() {
  if (typeof window === "undefined") return "";

  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("restaurant_token") ||
    localStorage.getItem("restoran_token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Henüz yok";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getEventTime(event: CallerEvent) {
  const time = new Date(event.receivedAt || event.createdAt || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function isConverted(event: CallerEvent) {
  return Boolean(event.orderId || event.orderCode || event.convertedAt);
}

function isNewCall(event: CallerEvent) {
  return !event.seenAt && event.status !== "SEEN" && !isConverted(event);
}

function normalizeList(json: unknown): CallerEvent[] {
  if (Array.isArray(json)) return json as CallerEvent[];

  if (json && typeof json === "object") {
    const maybe = json as { data?: unknown; items?: unknown };
    if (Array.isArray(maybe.data)) return maybe.data as CallerEvent[];
    if (Array.isArray(maybe.items)) return maybe.items as CallerEvent[];
  }

  return [];
}

export default function CallerIdCallsPage() {
  const [events, setEvents] = useState<CallerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Çağrılar yükleniyor...");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CallTab>("ALL");

  async function loadEvents() {
    setLoading(true);

    try {
      const token = getToken();

      if (!token) {
        setEvents([]);
        setMessage("Giriş tokenı bulunamadı. Panele yeniden giriş yapıp tekrar dene.");
        return;
      }

      const response = await fetch(apiPath("/caller-events"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      const list = normalizeList(json).sort((first, second) => {
        return getEventTime(second) - getEventTime(first);
      });

      setEvents(list);
      setMessage(list.length > 0 ? `${list.length} çağrı kaydı bulundu.` : "Henüz çağrı kaydı yok.");
    } catch (error) {
      setEvents([]);
      setMessage(
        error instanceof Error ? `Çağrılar okunamadı: ${error.message}` : "Çağrılar okunamadı.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const key = search.trim().toLocaleLowerCase("tr-TR");

    return events.filter((event) => {
      if (tab === "NEW" && !isNewCall(event)) return false;
      if (tab === "CONVERTED" && !isConverted(event)) return false;

      if (!key) return true;

      return [
        event.phone || "",
        event.customerName || "",
        event.orderCode || "",
        event.status || "",
        event.source || "",
        event.callerDeviceName || "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(key);
    });
  }, [events, search, tab]);

  const newCount = events.filter(isNewCall).length;
  const convertedCount = events.filter(isConverted).length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-sky-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">
                CALLER ID
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Çağrılar
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Gelen aramaları, görülmeyen çağrıları ve siparişe dönüşen kayıtları buradan takip et.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/dashboard"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Ana Sayfa
              </a>

              <a
                href="/dashboard/caller-id"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Caller ID
              </a>

              <a
                href="/dashboard/orders/history"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Geçmiş Siparişler
              </a>

              <button
                type="button"
                onClick={loadEvents}
                className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-sky-600"
              >
                Yenile
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Toplam Çağrı</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{events.length}</p>
          </div>

          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Yeni / Görülmeyen</p>
            <p className="mt-2 text-3xl font-black text-orange-900">{newCount}</p>
          </div>

          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Siparişe Dönüşen</p>
            <p className="mt-2 text-3xl font-black text-violet-900">{convertedCount}</p>
          </div>

          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Durum</p>
            <p className="mt-2 text-xl font-black text-emerald-900">
              {loading ? "Yükleniyor" : "Hazır"}
            </p>
            <p className="mt-1 text-xs font-bold text-emerald-800">{message}</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Telefon, müşteri adı veya sipariş kodu ara..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 xl:max-w-xl"
            />

            <div className="flex flex-wrap gap-2">
              {[
                { key: "ALL" as CallTab, label: "Tüm Çağrılar", count: events.length },
                { key: "NEW" as CallTab, label: "Yeni / Görülmeyen", count: newCount },
                { key: "CONVERTED" as CallTab, label: "Siparişe Dönüşenler", count: convertedCount },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                    tab === item.key
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                  <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Kaynak</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Sipariş</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4 font-black text-slate-950">{event.phone || "-"}</td>
                      <td className="px-4 py-4 font-bold text-slate-700">{event.customerName || "Yeni müşteri"}</td>
                      <td className="px-4 py-4 font-bold text-slate-600">
                        {formatDate(event.receivedAt || event.createdAt)}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-600">
                        {event.source || event.callerDeviceName || "Caller ID"}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                            isConverted(event)
                              ? "border-violet-200 bg-violet-50 text-violet-800"
                              : isNewCall(event)
                                ? "border-orange-200 bg-orange-50 text-orange-800"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {isConverted(event)
                            ? "Siparişe dönüştü"
                            : isNewCall(event)
                              ? "Yeni çağrı"
                              : "Görüldü"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-slate-700">
                        {event.orderCode || (event.orderId ? "Siparişe bağlı" : "-")}
                      </td>
                    </tr>
                  ))}

                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <p className="text-lg font-black text-slate-950">Çağrı bulunamadı</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">
                          Filtreyi değiştir veya yeni çağrı geldiğinde tekrar yenile.
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
