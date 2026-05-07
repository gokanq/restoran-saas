const settingsCards = [
  {
    title: "Restoran Bilgileri",
    description:
      "Restoran adı, şube bilgileri, iletişim ve operasyon ayarları için temel alan.",
    href: "/dashboard/settings",
    badge: "Temel",
  },
  {
    title: "Bildirim Ayarları",
    description:
      "Caller ID, yeni sipariş, platform siparişi ve operasyon uyarılarını yönet.",
    href: "/dashboard/settings/notifications",
    badge: "Hazır",
  },
  {
    title: "Platform Entegrasyonları",
    description:
      "Trendyol, Getir, Yemeksepeti ve Migros Yemek bağlantı hazırlıklarını takip et.",
    href: "/dashboard/integrations",
    badge: "Önemli",
  },
  {
    title: "Caller ID Cihazları",
    description:
      "Android Caller ID uygulaması ve cihaz anahtarlarını ayrı ayar ekranından yönet.",
    href: "/dashboard/settings/cagrilar",
    badge: "Yeni",
  },
  {
    title: "Caller ID Operasyonu",
    description:
      "Telefon aramalarından sipariş başlatma ve çağrı ekranına git.",
    href: "/dashboard/caller-id",
    badge: "Aktif",
  },
];

const operationalChecks = [
  "API bilgileri GitHub’a yazılmayacak",
  "PM2 env üzerinden çalışacak",
  "Her restoran kendi ayarını görecek",
  "Testten sonra build ve route kontrolü yapılacak",
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.09),transparent_34%)]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-sky-700">
                  Sistem Ayarları
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Restoran operasyon ayarları
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Bu alan restoranın genel ayarları, bildirim tercihleri,
                  platform entegrasyonları ve Caller ID ayar ekranları için
                  merkezi kontrol sayfasıdır.
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
                  href="/dashboard/integrations"
                  className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-300"
                >
                  Entegrasyonlar
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {settingsCards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/80 transition hover:-translate-y-1 hover:border-sky-300 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-black text-slate-950">{card.title}</h2>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-black text-sky-700">
                  {card.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
              <p className="mt-5 text-sm font-black text-sky-700 transition group-hover:text-sky-800">
                Aç →
              </p>
            </a>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 lg:col-span-2">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
              Yakındaki İşler
            </p>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              Trendyol mağaza testine hazırlık
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Gerçek mağaza bilgileri geldiğinde önce bağlantı doğrulama, sonra
              sipariş çekme, ardından gelen siparişi mevcut sipariş akışına
              bağlama testi yapılacak. Bu süreçte gizli bilgiler kod içine
              yazılmayacak.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {operationalChecks.map((check) => (
                <div
                  key={check}
                  className="rounded-2xl border border-slate-200 bg-slate-100/50 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  ✓ {check}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
              Stabil Checkpoint
            </p>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              Sistem temiz durumda
            </h2>
            <p className="mt-3 text-sm leading-7 text-emerald-900/80">
              Caller ID cihaz yönetimi artık ayrı bir ayar sayfasında tutulur.
              Commit öncesinde yine build ve route testi yapılacak.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
