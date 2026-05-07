"use client";

import { useEffect, useState } from "react";

type NotificationSettings = {
  newOrder: boolean;
  callerId: boolean;
  platformOrder: boolean;
  courierWarning: boolean;
  tableService: boolean;
  sound: boolean;
  desktop: boolean;
  smsFallback: boolean;
};

const defaultSettings: NotificationSettings = {
  newOrder: true,
  callerId: true,
  platformOrder: true,
  courierWarning: true,
  tableService: true,
  sound: true,
  desktop: false,
  smsFallback: false,
};

const settingGroups = [
  {
    title: "Operasyon Bildirimleri",
    description: "Günlük sipariş ve servis akışı için gerekli uyarılar.",
    items: [
      {
        key: "newOrder",
        label: "Yeni sipariş bildirimi",
        text: "Panelden veya QR menüden gelen yeni siparişlerde uyarı üretir.",
      },
      {
        key: "callerId",
        label: "Caller ID arama bildirimi",
        text: "Telefon araması geldiğinde canlı popup ve çağrı uyarısı gösterir.",
      },
      {
        key: "tableService",
        label: "Masa servis bildirimi",
        text: "Masa açma, ödeme ve servis akışlarında uyarı üretir.",
      },
    ],
  },
  {
    title: "Platform Bildirimleri",
    description: "Trendyol ve diğer platformlar bağlandığında kullanılacak alan.",
    items: [
      {
        key: "platformOrder",
        label: "Platform siparişi bildirimi",
        text: "Trendyol / Getir / Yemeksepeti siparişleri geldiğinde uyarı verir.",
      },
      {
        key: "courierWarning",
        label: "Kurye gecikme uyarısı",
        text: "Yola çıkma veya teslimat süresi gecikirse operasyon uyarısı verir.",
      },
    ],
  },
  {
    title: "Bildirim Kanalları",
    description: "Uyarının hangi kanaldan gösterileceğini belirler.",
    items: [
      {
        key: "sound",
        label: "Sesli uyarı",
        text: "Panel açıkken kritik olaylarda sesli uyarı vermek için kullanılır.",
      },
      {
        key: "desktop",
        label: "Masaüstü bildirimi",
        text: "Tarayıcı izin verirse işletim sistemi bildirimi gösterir.",
      },
      {
        key: "smsFallback",
        label: "SMS yedek uyarı",
        text: "İleride kritik bildirimler için opsiyonel SMS kanalı olarak kullanılabilir.",
      },
    ],
  },
] as const;

export default function NotificationSettingsPage() {
  const [settings, setSettings] =
    useState<NotificationSettings>(defaultSettings);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("restaurant_notification_settings");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      setSettings({ ...defaultSettings, ...parsed });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  function toggle(key: keyof NotificationSettings) {
    setSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setSavedMessage("");
  }

  async function requestDesktopPermission() {
    if (!("Notification" in window)) {
      setSavedMessage("Bu tarayıcı masaüstü bildirimini desteklemiyor.");
      return;
    }

    const result = await Notification.requestPermission();
    setSavedMessage(
      result === "granted"
        ? "Masaüstü bildirimi izni verildi."
        : "Masaüstü bildirimi izni verilmedi.",
    );
  }

  function saveLocal() {
    localStorage.setItem(
      "restaurant_notification_settings",
      JSON.stringify(settings),
    );
    setSavedMessage(
      "Ayarlar bu cihazda kaydedildi. Backend kayıt akışı hazır olduğunda veritabanına bağlanacak.",
    );
  }

  const activeCount = Object.values(settings).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.09),transparent_34%)]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-300">
                  Bildirim Ayarları
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Kritik operasyon uyarılarını yönet
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Yeni sipariş, Caller ID, masa servis, platform siparişleri ve
                  kurye gecikme uyarıları için profesyonel bildirim merkezi.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/dashboard/settings"
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200"
                >
                  Ayarlara Dön
                </a>
                <button
                  type="button"
                  onClick={saveLocal}
                  className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Ayarları Kaydet
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Aktif Ayar
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
              {activeCount} / {Object.keys(settings).length}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Bildirim seçeneği aktif.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Güvenli Mod
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Canlı sistemi bozmaz
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Bu ekran şimdilik ayarı cihazda saklar; backend bağlantısı ayrıca
              kontrollü eklenecek.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Masaüstü İzni
            </p>
            <button
              type="button"
              onClick={requestDesktopPermission}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200"
            >
              Tarayıcı İzni İste
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          {settingGroups.map((group) => (
            <article
              key={group.title}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80"
            >
              <h2 className="text-xl font-black text-slate-950">{group.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {group.description}
              </p>

              <div className="mt-5 space-y-3">
                {group.items.map((item) => {
                  const key = item.key as keyof NotificationSettings;
                  const active = settings[key];

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100/50 p-4 text-left transition hover:bg-slate-100"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-black text-slate-950">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {item.text}
                          </p>
                        </div>
                        <span
                          className={`mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
                            active ? "bg-emerald-400" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-white transition ${
                              active ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </section>

        {savedMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold leading-6 text-emerald-900">
            {savedMessage}
          </div>
        ) : null}
      </div>
    </main>
  );
}
