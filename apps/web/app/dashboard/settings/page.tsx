'use client';

import { useRouter } from 'next/navigation';

type SettingsCard = {
  title: string;
  description: string;
  href: string;
  badge: string;
  status: 'ready' | 'soon';
};

const SETTINGS_CARDS: SettingsCard[] = [
  {
    title: 'Restoran ve Şube Ayarları',
    description: 'Restoran bilgileri, şubeler, adres, telefon ve temel işletme bilgileri.',
    href: '/dashboard',
    badge: 'Temel Ayarlar',
    status: 'soon',
  },
  {
    title: 'Menü Yönetimi',
    description: 'Kategoriler, ürünler, fiyatlar ve menü görünürlüğü.',
    href: '/dashboard/menu',
    badge: 'Menü',
    status: 'ready',
  },
  {
    title: 'Ürün Opsiyonları',
    description: 'Porsiyon, ekstra malzeme, çıkarılacak malzeme ve opsiyon grupları.',
    href: '/dashboard/options',
    badge: 'Opsiyon',
    status: 'ready',
  },
  {
    title: 'Caller ID Ayarları',
    description: 'Caller ID cihazları, cihaz anahtarları, çağrı geçmişi ve telefon siparişi ayarları.',
    href: '/dashboard/caller-id',
    badge: 'Caller ID',
    status: 'ready',
  },
  {
    title: 'Kurye Ayarları',
    description: 'Kurye ekleme, düzenleme, aktif/pasif durumu, saatlik ücret ve paket başı ücret.',
    href: '/dashboard/couriers',
    badge: 'Kurye',
    status: 'ready',
  },
  {
    title: 'Masa Servis Ayarları',
    description: 'Salonlar, masalar, QR kodlar, rezervasyon ve masa servis yapılandırması.',
    href: '/dashboard/table-service',
    badge: 'Masa Servis',
    status: 'ready',
  },
  {
    title: 'Ödeme Ayarları',
    description: 'Nakit, kart, online ödeme, yemek kartı ve açık hesap seçenekleri.',
    href: '/dashboard',
    badge: 'Ödeme',
    status: 'soon',
  },
  {
    title: 'Kullanıcılar ve Roller',
    description: 'Owner, admin, manager, staff, courier kullanıcıları ve yetki ayarları.',
    href: '/dashboard',
    badge: 'Yetki',
    status: 'soon',
  },
];

export default function SettingsPage() {
  const router = useRouter();

  const readyCards = SETTINGS_CARDS.filter((card) => card.status === 'ready');
  const soonCards = SETTINGS_CARDS.filter((card) => card.status === 'soon');

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                Sistem Ayarları
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Yönetim Merkezi
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                Günlük operasyon ekranını sade tutmak için menü, opsiyon, kurye, Caller ID, masa servis,
                ödeme ve kullanıcı ayarlarını tek merkezde topluyoruz.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-fit rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Operasyon Ekranına Dön
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Aktif Modül</p>
            <p className="mt-2 text-3xl font-black text-emerald-950">{readyCards.length}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">Şu an çalışan ayar alanı</p>
          </div>

          <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Planlanan</p>
            <p className="mt-2 text-3xl font-black text-amber-950">{soonCards.length}</p>
            <p className="mt-1 text-sm font-semibold text-amber-700">Sonraki yapılandırma alanı</p>
          </div>

          <div className="rounded-[26px] border border-sky-200 bg-sky-50 p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700">Amaç</p>
            <p className="mt-2 text-3xl font-black text-sky-950">Temiz Panel</p>
            <p className="mt-1 text-sm font-semibold text-sky-700">Operasyon ekranını sadeleştirme</p>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Ayar Modülleri</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Ayarları modül modül taşıyacağız. Çalışan sayfalar korunur, sadece merkezi erişim buraya alınır.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SETTINGS_CARDS.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => router.push(card.href)}
                className="group rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                    {card.badge}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${
                      card.status === 'ready'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {card.status === 'ready' ? 'Aktif' : 'Planlandı'}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-black text-slate-950">{card.title}</h3>
                <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-500">
                  {card.description}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-black text-emerald-700">
                    {card.status === 'ready' ? 'Aç' : 'Yakında'}
                  </span>
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white transition group-hover:bg-emerald-700">
                    →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Taşıma Planı</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">Ekran kalabalığını azaltma sırası</h2>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              'Önce merkezi ayarlar sayfası',
              'Sonra dashboard üst menüsünü sadeleştirme',
              'Sonra ayar formlarını modül sayfalarına taşıma',
              'Sonra müşteri / CRM altyapısı',
            ].map((item, index) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Adım {index + 1}
                </p>
                <p className="mt-2 text-sm font-black text-slate-800">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
