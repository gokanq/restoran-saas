"use client";

import { useEffect, useMemo, useState } from "react";

type IntegrationRecord = {
  id?: string;
  platform?: string;
  provider?: string;
  name?: string;
  label?: string;
  merchantId?: string;
  supplierId?: string;
  restaurantId?: string;
  branchId?: string;
  isActive?: boolean;
  enabled?: boolean;
  status?: string;
  syncStatus?: string;
  lastSyncAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function apiPath(path: string) {
  return API_BASE ? `${API_BASE}${path}` : `/api${path}`;
}

const platforms = [
  {
    key: "TRENDYOL",
    title: "Trendyol Yemek",
    badge: "Test için hazır",
    description:
      "Mağaza bilgileri geldiğinde ilk canlı bağlantı testi burada yapılacak.",
    readiness: 80,
    accent: "from-orange-50 to-amber-50",
    bar: "bg-orange-500",
    checklist: [
      "Supplier / mağaza ID",
      "API Key ve Secret",
      "Şube / restoran ID",
      "User-Agent bilgisi",
    ],
  },
  {
    key: "GETIR",
    title: "Getir Yemek",
    badge: "Altyapı hazır",
    description:
      "Getir tarafı için bağlantı alanları ve senkron altyapı genişletilebilir durumda.",
    readiness: 60,
    accent: "from-violet-50 to-fuchsia-50",
    bar: "bg-violet-500",
    checklist: ["Mağaza ID", "API bilgileri", "Sipariş endpointleri"],
  },
  {
    key: "YEMEKSEPETI",
    title: "Yemeksepeti",
    badge: "Planlandı",
    description:
      "Çoklu platform mimarisi sayesinde sıradaki entegrasyon adayı olabilir.",
    readiness: 35,
    accent: "from-rose-50 to-red-50",
    bar: "bg-rose-500",
    checklist: ["Partner erişimi", "Webhook/polling kararı", "Menü eşleme"],
  },
  {
    key: "MIGROS",
    title: "Migros Yemek",
    badge: "Planlandı",
    description:
      "Sipariş, müşteri ve platform kodu eşleme kurgusu için ayrıldı.",
    readiness: 30,
    accent: "from-emerald-50 to-lime-50",
    bar: "bg-emerald-500",
    checklist: ["API erişimi", "Platform kodu", "Durum eşleme"],
  },
];

function normalizePlatform(value?: string) {
  const raw = (value || "").toUpperCase();

  if (raw.includes("TRENDYOL")) return "TRENDYOL";
  if (raw.includes("GETIR") || raw.includes("GETİR")) return "GETIR";
  if (raw.includes("YEMEK")) return "YEMEKSEPETI";
  if (raw.includes("MIGROS") || raw.includes("MİGROS")) return "MIGROS";

  return raw || "UNKNOWN";
}

function formatDate(value?: string) {
  if (!value) return "Henüz yok";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusText(item?: IntegrationRecord) {
  if (!item) return "Henüz bağlanmadı";
  if (item.isActive === false || item.enabled === false) return "Pasif";
  return item.syncStatus || item.status || "Aktif / kayıtlı";
}

function getAuthToken() {
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

async function copyTextFallback(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);

  return ok;
}

export default function IntegrationsPage() {
  const [items, setItems] = useState<IntegrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Entegrasyon kayıtları yükleniyor...");
  const [copied, setCopied] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadIntegrations() {
      try {
        const token = getAuthToken();

        if (!token) {
          if (!mounted) return;

          setItems([]);
          setMessage(
            "Giriş tokenı bulunamadı. Panele yeniden giriş yapınca kayıtlı entegrasyonlar okunur. Hazırlık ekranı yine kullanılabilir.",
          );
          setDebugInfo("Token yok");
          return;
        }

        const url = apiPath("/integrations");

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");

          throw new Error(
            `HTTP ${response.status}${text ? ` - ${text.slice(0, 160)}` : ""}`,
          );
        }

        const json = await response.json();

        const list = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.items)
              ? json.items
              : [];

        if (!mounted) return;

        setItems(list);
        setMessage(
          list.length > 0
            ? `${list.length} entegrasyon kaydı bulundu.`
            : "Henüz kayıtlı entegrasyon yok. Trendyol mağaza bilgileri geldiğinde ilk kayıt buradan yapılacak.",
        );
        setDebugInfo(`API okundu: ${url}`);
      } catch (error) {
        if (!mounted) return;

        setItems([]);
        setMessage(
          "Entegrasyon kayıtları okunamadı. Hazırlık ekranı kullanılabilir; API detayını aşağıda gösteriyorum.",
        );
        setDebugInfo(error instanceof Error ? error.message : "Bilinmeyen hata");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadIntegrations();

    return () => {
      mounted = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, IntegrationRecord[]>();

    for (const item of items) {
      const key = normalizePlatform(item.platform || item.provider);
      const current = map.get(key) || [];
      current.push(item);
      map.set(key, current);
    }

    return map;
  }, [items]);

  async function copyChecklist(platformTitle: string, checklist: string[]) {
    const text = `${platformTitle} test günü gerekli bilgiler:\n- ${checklist.join(
      "\n-",
    )}`;

    try {
      const ok = await copyTextFallback(text);

      if (ok) {
        setCopied(platformTitle);
        setTimeout(() => setCopied(null), 1800);
      } else {
        setCopied(null);
        setMessage(
          "Kopyalama tarayıcı tarafından engellendi. Listeyi manuel seçip kopyalayabilirsin.",
        );
      }
    } catch {
      setCopied(null);
      setMessage(
        "Kopyalama tarayıcı tarafından engellendi. HTTP ortamında bazı tarayıcılar kopyalamaya izin vermeyebilir.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.13),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.10),transparent_34%)]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-600">
                  Platform Entegrasyonları
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Paket platformlarını tek panelden yöneteceğiz
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Bu ekran Trendyol, Getir, Yemeksepeti ve Migros Yemek gibi
                  platformlar için bağlantı hazırlığı, güvenli test adımları ve
                  entegrasyon durumlarını takip etmek için düzenlendi.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/dashboard"
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200"
                >
                  Panele Dön
                </a>
                <a
                  href="/dashboard/settings"
                  className="rounded-2xl bg-orange-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-orange-300"
                >
                  Ayarlar
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Sistem Durumu
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {loading ? "Kontrol ediliyor" : "Hazır"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            {debugInfo ? (
              <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-500">
                Detay: {debugInfo}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Güvenlik Notu
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              API bilgileri gizli tutulacak
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              API Key / Secret bilgileri GitHub’a, frontend dosyasına veya açık
              loglara yazılmayacak.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              İlk Hedef
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Trendyol mağaza testi
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Mağaza bilgileri geldiğinde önce bağlantı doğrulama, sonra sipariş
              senkronizasyonu test edilecek.
            </p>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {platforms.map((platform) => {
            const records = grouped.get(platform.key) || [];
            const firstRecord = records[0];

            return (
              <article
                key={platform.key}
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/80"
              >
                <div className={`bg-gradient-to-br ${platform.accent} p-5 sm:p-6`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-black text-slate-950">
                          {platform.title}
                        </h3>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700">
                          {platform.badge}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {platform.description}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
                      <p className="text-xs font-bold text-slate-500">
                        Hazırlık
                      </p>
                      <p className="text-2xl font-black text-slate-950">
                        %{platform.readiness}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${platform.bar}`}
                      style={{ width: `${platform.readiness}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
                  <div>
                    <p className="text-sm font-black text-slate-950">
                      Bağlantı Durumu
                    </p>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-black text-orange-700">
                        {statusText(firstRecord)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Kayıt sayısı: {records.length}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Son güncelleme:{" "}
                        {formatDate(
                          firstRecord?.lastSyncAt ||
                            firstRecord?.updatedAt ||
                            firstRecord?.createdAt,
                        )}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-black text-slate-950">
                      Test Günü Gerekli Bilgiler
                    </p>
                    <ul className="mt-3 space-y-2">
                      {platform.checklist.map((item) => (
                        <li
                          key={item}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() =>
                        copyChecklist(platform.title, platform.checklist)
                      }
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-200"
                    >
                      {copied === platform.title
                        ? "Kopyalandı"
                        : "Listeyi Kopyala"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[2rem] border border-orange-200 bg-orange-50 p-5 sm:p-6">
          <h2 className="text-xl font-black text-orange-900">
            Trendyol test günü sırası
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {[
              "API bilgilerini güvenli al",
              "Bağlantı doğrulama yap",
              "Sipariş çekme testini çalıştır",
              "Siparişi panele bağla",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-orange-200 bg-white px-4 py-3"
              >
                <p className="text-xs font-black text-orange-700">
                  ADIM {index + 1}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-900">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
