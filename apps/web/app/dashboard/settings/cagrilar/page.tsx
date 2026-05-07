"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CallerDevice = {
  id: string;
  name: string;
  keyPreview?: string | null;
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

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

function buildHeaders(json = false) {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

function formatDate(value?: string | null) {
  if (!value) return "Henüz bağlantı yok";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function copyTextToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

export default function SettingsCallerDevicesPage() {
  const [callerDevices, setCallerDevices] = useState<CallerDevice[]>([]);
  const [callerDeviceName, setCallerDeviceName] = useState("Android Caller ID");
  const [newCallerDeviceKey, setNewCallerDeviceKey] = useState("");
  const [callerDeviceMessage, setCallerDeviceMessage] = useState("");
  const [isLoadingCallerDevices, setIsLoadingCallerDevices] = useState(false);
  const [isSavingCallerDevice, setIsSavingCallerDevice] = useState(false);
  const [updatingCallerDeviceId, setUpdatingCallerDeviceId] = useState<string | null>(null);
  const [showInactiveCallerDevices, setShowInactiveCallerDevices] = useState(false);

  const activeCallerDevices = useMemo(
    () => callerDevices.filter((device) => device.isActive),
    [callerDevices],
  );

  const inactiveCallerDevices = useMemo(
    () => callerDevices.filter((device) => !device.isActive),
    [callerDevices],
  );

  async function loadCallerDevices() {
    setIsLoadingCallerDevices(true);

    try {
      const response = await fetch("/api/caller-devices", {
        headers: buildHeaders(),
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setCallerDevices(Array.isArray(data) ? data : []);
    } catch (error) {
      setCallerDeviceMessage(
        error instanceof Error
          ? `Caller ID cihaz listesi alınamadı: ${error.message}`
          : "Caller ID cihaz listesi alınamadı.",
      );
    } finally {
      setIsLoadingCallerDevices(false);
    }
  }

  async function createCallerDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = callerDeviceName.trim();

    if (!name) {
      setCallerDeviceMessage("Cihaz adı zorunludur.");
      return;
    }

    setIsSavingCallerDevice(true);
    setCallerDeviceMessage("");
    setNewCallerDeviceKey("");

    try {
      const response = await fetch("/api/caller-devices", {
        method: "POST",
        headers: buildHeaders(true),
        body: JSON.stringify({
          name,
          branchId: null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);

      setNewCallerDeviceKey(data.deviceKey || "");
      setCallerDeviceMessage(data.message || "Caller ID cihazı oluşturuldu.");
      setCallerDeviceName("Android Caller ID");
      await loadCallerDevices();
    } catch (error) {
      setCallerDeviceMessage(
        error instanceof Error ? error.message : "Caller ID cihazı oluşturulamadı.",
      );
    } finally {
      setIsSavingCallerDevice(false);
    }
  }

  async function toggleCallerDevice(device: CallerDevice) {
    setUpdatingCallerDeviceId(device.id);
    setCallerDeviceMessage("");

    try {
      const action = device.isActive ? "deactivate" : "activate";

      const response = await fetch(`/api/caller-devices/${device.id}/${action}`, {
        method: "PATCH",
        headers: buildHeaders(),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);

      setCallerDeviceMessage(
        device.isActive
          ? "Caller ID cihazı pasife alındı."
          : "Caller ID cihazı aktife alındı.",
      );

      await loadCallerDevices();
    } catch (error) {
      setCallerDeviceMessage(
        error instanceof Error ? error.message : "Caller ID cihazı güncellenemedi.",
      );
    } finally {
      setUpdatingCallerDeviceId(null);
    }
  }

  useEffect(() => {
    loadCallerDevices();
  }, []);

  function renderCallerDeviceRow(device: CallerDevice) {
    return (
      <div
        key={device.id}
        className={`grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[1.35fr_1fr_1fr_auto] lg:items-center ${
          device.isActive ? "" : "opacity-80"
        }`}
      >
        <div>
          <p className="text-sm font-black text-slate-950">{device.name}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Caller ID cihazı</p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Anahtar
          </p>
          <p className="mt-1 font-mono text-sm font-black text-slate-700">
            {device.keyPreview || "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Son Bağlantı
          </p>
          <p className="mt-1 text-sm font-black text-slate-700">
            {formatDate(device.lastSeenAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black ${
              device.isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-500"
            }`}
          >
            {device.isActive ? "Aktif" : "Pasif"}
          </span>

          <button
            type="button"
            onClick={() => toggleCallerDevice(device)}
            disabled={updatingCallerDeviceId === device.id}
            className={`rounded-2xl px-4 py-2 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              device.isActive
                ? "bg-red-700 hover:bg-red-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {updatingCallerDeviceId === device.id
              ? "Güncelleniyor..."
              : device.isActive
                ? "Pasife Al"
                : "Aktife Al"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-700">
                Caller ID Ayarları
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Caller ID Cihaz Yönetimi
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Android uygulama veya fiziksel Caller ID cihazı bu cihaz anahtarıyla
                arama event’i gönderebilir. Yeni anahtar sadece oluşturulduğu anda
                tam görünür.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/dashboard/settings"
                className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200"
              >
                Ayarlara Dön
              </a>
              <a
                href="/dashboard/caller-id"
                className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-800 transition hover:bg-sky-100"
              >
                Caller ID
              </a>
              <button
                type="button"
                onClick={loadCallerDevices}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-600"
              >
                Cihazları Yenile
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Toplam Cihaz
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">{callerDevices.length}</p>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Aktif Cihaz
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-900">{activeCallerDevices.length}</p>
            </div>

            <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">
                Durum
              </p>
              <p className="mt-2 text-xl font-black text-sky-900">
                {isLoadingCallerDevices ? "Yükleniyor" : "Hazır"}
              </p>
            </div>
          </div>

          <form
            onSubmit={createCallerDevice}
            className="mt-5 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
          >
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Cihaz Adı
              </span>
              <input
                value={callerDeviceName}
                onChange={(event) => setCallerDeviceName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                placeholder="Android Caller ID"
              />
            </label>

            <button
              type="submit"
              disabled={isSavingCallerDevice || !callerDeviceName.trim()}
              className="self-end rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingCallerDevice ? "Oluşturuluyor..." : "Cihaz Anahtarı Oluştur"}
            </button>
          </form>

          {callerDeviceMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
              {callerDeviceMessage}
            </div>
          ) : null}

          {newCallerDeviceKey ? (
            <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Yeni cihaz anahtarı
              </p>
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
                        ? "Cihaz anahtarı kopyalandı."
                        : "Kopyalama tarayıcı tarafından engellendi. Anahtarı elle seçip kopyalayabilirsin.",
                    );
                  }}
                  className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-700"
                >
                  Kopyala
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4">
            {isLoadingCallerDevices ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-500">
                Caller ID cihazları yükleniyor...
              </div>
            ) : callerDevices.length > 0 ? (
              <>
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
                        Aktif Cihazlar
                      </p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">
                        Kullanımdaki Caller ID cihazları
                      </h2>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                      {activeCallerDevices.length} aktif
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {activeCallerDevices.length > 0 ? (
                      activeCallerDevices.map(renderCallerDeviceRow)
                    ) : (
                      <div className="rounded-2xl border border-dashed border-emerald-300 bg-white/70 p-4 text-sm font-bold text-emerald-800">
                        Aktif Caller ID cihazı yok. Pasif cihazlardan birini aktife alabilir veya yeni cihaz anahtarı oluşturabilirsin.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                        Pasif Cihazlar
                      </p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">
                        Eski / test cihazları
                      </h2>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        Pasif cihazlar geçmiş kayıtlar için saklanır, varsayılan olarak kapalı tutulur.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowInactiveCallerDevices((current) => !current)}
                      className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-100"
                    >
                      {showInactiveCallerDevices
                        ? "Pasif Cihazları Gizle"
                        : `Pasif Cihazları Göster (${inactiveCallerDevices.length})`}
                    </button>
                  </div>

                  {showInactiveCallerDevices ? (
                    <div className="mt-4 grid gap-3">
                      {inactiveCallerDevices.length > 0 ? (
                        inactiveCallerDevices.map(renderCallerDeviceRow)
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-bold text-slate-500">
                          Pasif cihaz yok.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                Henüz Caller ID cihazı yok. Android uygulama veya fiziksel cihaz bağlamak için cihaz anahtarı oluştur.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
