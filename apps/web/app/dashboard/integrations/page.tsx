'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Integration {
  id: string;
  platform: string;
  name: string;
  supplierId: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  baseUrl: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

const PLATFORMS = [
  { id: 'TRENDYOL', name: 'Trendyol Yemek', color: 'bg-orange-500', letter: 'T', fields: ['supplierId', 'apiKey', 'apiSecret', 'baseUrl'] },
  { id: 'GETIR', name: 'Getir Yemek', color: 'bg-purple-500', letter: 'G', fields: ['apiKey', 'baseUrl'] },
  { id: 'YEMEKSEPETI', name: 'Yemeksepeti', color: 'bg-red-500', letter: 'Y', fields: [] },
];

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState('');

  const [form, setForm] = useState({
    name: '',
    platform: '',
    supplierId: '',
    apiKey: '',
    apiSecret: '',
    baseUrl: '',
  });

  const [testing, setTesting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => { fetchIntegrations(); }, []);

  async function fetchIntegrations() {
    try {
      const res = await fetch('/api/integrations', { headers });
      if (res.ok) setIntegrations(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openAddForm(platformId: string) {
    setSelectedPlatform(platformId);
    setEditingId(null);
    setForm({ name: '', platform: platformId, supplierId: '', apiKey: '', apiSecret: '', baseUrl: '' });
    setShowForm(true);
    setTestResult(null);
  }

  function openEditForm(integration: Integration) {
    setSelectedPlatform(integration.platform);
    setEditingId(integration.id);
    setForm({
      name: integration.name || '',
      platform: integration.platform,
      supplierId: integration.supplierId || '',
      apiKey: integration.apiKey || '',
      apiSecret: integration.apiSecret || '',
      baseUrl: integration.baseUrl || '',
    });
    setShowForm(true);
    setTestResult(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingId ? `/api/integrations/${editingId}` : '/api/integrations';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(form) });
      if (res.ok) {
        await fetchIntegrations();
        setShowForm(false);
        setEditingId(null);
      } else {
        const err = await res.json();
        alert(err.message || 'Kayit hatasi');
      }
    } catch (e) { alert('Baglanti hatasi'); }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await fetch(`/api/integrations/${id}/toggle`, {
        method: 'PATCH', headers, body: JSON.stringify({ isActive: !isActive }),
      });
      await fetchIntegrations();
    } catch (e) { alert('Guncelleme hatasi'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu entegrasyonu silmek istediginize emin misiniz?')) return;
    try {
      await fetch(`/api/integrations/${id}`, { method: 'DELETE', headers });
      await fetchIntegrations();
    } catch (e) { alert('Silme hatasi'); }
  }

  async function handleTest(id: string) {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${id}/test`, { method: 'POST', headers });
      const data = await res.json();
      setTestResult({ id, ...data });
    } catch (e) { setTestResult({ id, success: false, message: 'Baglanti hatasi' }); }
    finally { setTesting(null); }
  }

  async function handleSync(id: string) {
    setSyncing(id);
    try {
      await fetch(`/api/integrations/${id}/sync`, { method: 'POST', headers });
      await fetchIntegrations();
    } catch (e) { alert('Senkronizasyon hatasi'); }
    finally { setSyncing(null); }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-500">Yukleniyor...</div></div>;

  const platformConfig = PLATFORMS.find(p => p.id === selectedPlatform);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/dashboard')} className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Entegrasyonlari</h1>
            <p className="text-sm text-gray-500">Birden fazla magaza ekleyebilir ve her birini ayri yonetebilirsiniz</p>
          </div>
        </div>

        {/* Platform Sections */}
        {PLATFORMS.map(platform => {
          const platformIntegrations = integrations.filter(i => i.platform === platform.id);
          return (
            <div key={platform.id} className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 ${platform.color} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>{platform.letter}</span>
                  <h2 className="text-lg font-semibold text-gray-800">{platform.name}</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{platformIntegrations.length} magaza</span>
                </div>
                {platform.fields.length > 0 && (
                  <button onClick={() => openAddForm(platform.id)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Yeni Magaza Ekle
                  </button>
                )}
              </div>

              {platform.fields.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    <p className="font-semibold mb-2">API Basvurusu Gerekli</p>
                    <p>Yemeksepeti API erisimi icin restoran partneri olarak basvuru yapmaniz gerekiyor. Onaylandiginda buradan entegrasyon ekleyebilirsiniz.</p>
                  </div>
                </div>
              ) : platformIntegrations.length === 0 ? (
                <div className="bg-white border border-gray-200 border-dashed rounded-xl p-8 text-center shadow-sm">
                  <p className="text-gray-400 text-sm">Henuz magaza eklenmemis</p>
                  <button onClick={() => openAddForm(platform.id)} className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">+ Ilk magazanizi ekleyin</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {platformIntegrations.map(integration => (
                    <div key={integration.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${integration.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                          <div>
                            <p className="font-medium text-gray-900">{integration.name || 'Isimsiz Magaza'}</p>
                            <p className="text-xs text-gray-400">{integration.supplierId ? `ID: ${integration.supplierId}` : integration.apiKey ? `Key: ${integration.apiKey.slice(0, 8)}...` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Toggle */}
                          <button onClick={() => handleToggle(integration.id, integration.isActive)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${integration.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${integration.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                          {/* Test */}
                          <button onClick={() => handleTest(integration.id)} disabled={testing === integration.id} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">{testing === integration.id ? '...' : 'Test'}</button>
                          {/* Sync */}
                          <button onClick={() => handleSync(integration.id)} disabled={syncing === integration.id} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50">{syncing === integration.id ? '...' : 'Sync'}</button>
                          {/* Edit */}
                          <button onClick={() => openEditForm(integration)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Duzenle</button>
                          {/* Delete */}
                          <button onClick={() => handleDelete(integration.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">Sil</button>
                        </div>
                      </div>
                      {/* Test result inline */}
                      {testResult && testResult.id === integration.id && (
                        <div className={`mt-2 text-xs px-3 py-2 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {testResult.success ? '\u2713' : '\u2717'} {testResult.message}
                        </div>
                      )}
                      {integration.lastSyncAt && (
                        <div className="mt-2 text-xs text-gray-400">
                          Son sync: {new Date(integration.lastSyncAt).toLocaleString('tr-TR')}
                          {integration.lastError && <span className="text-red-400 ml-2">Hata: {integration.lastError}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Add/Edit Modal */}
        {showForm && platformConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <span className={`w-8 h-8 ${platformConfig.color} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>{platformConfig.letter}</span>
                <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Magazayi Duzenle' : 'Yeni Magaza Ekle'}</h3>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Magaza Adi</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="orn: Kadikoy Subesi" required />
                </div>
                {platformConfig.fields.includes('supplierId') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                    <input type="text" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Trendyol Supplier ID" required />
                  </div>
                )}
                {platformConfig.fields.includes('apiKey') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                    <input type="text" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="API Key" required />
                  </div>
                )}
                {platformConfig.fields.includes('apiSecret') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                    <input type="password" value={form.apiSecret} onChange={e => setForm({ ...form, apiSecret: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="API Secret" />
                  </div>
                )}
                {platformConfig.fields.includes('baseUrl') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base URL (opsiyonel)</label>
                    <input type="text" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Varsayilan URL kullanilacak" />
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">{editingId ? 'Guncelle' : 'Ekle'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition">Iptal</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
