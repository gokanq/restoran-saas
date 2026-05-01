type Restaurant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

async function getRestaurants(): Promise<Restaurant[]> {
  const res = await fetch('http://localhost:4000/restaurants', {
    cache: 'no-store',
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export default async function Home() {
  const restaurants = await getRestaurants();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Restoran SaaS
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Yönetim Paneli
          </h1>

          <p className="mt-4 max-w-2xl text-slate-300">
            NestJS API, PostgreSQL, Prisma ve Next.js bağlantısı başarıyla çalışıyor.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-sm text-slate-400">API Durumu</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">Çalışıyor</p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Restoran Sayısı</p>
              <p className="mt-2 text-2xl font-bold">{restaurants.length}</p>
            </div>

            <div className="rounded-2xl bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Veritabanı</p>
              <p className="mt-2 text-2xl font-bold text-sky-400">PostgreSQL</p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-bold">Restoranlar</h2>

          {restaurants.length === 0 ? (
            <p className="mt-4 text-slate-300">Henüz restoran kaydı yok.</p>
          ) : (
            <div className="mt-6 grid gap-4">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">{restaurant.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Slug: {restaurant.slug}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
                      Aktif
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
