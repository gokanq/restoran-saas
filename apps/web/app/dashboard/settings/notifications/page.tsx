'use client';

import { useState, useEffect, useRef } from 'react';

const SOUNDS = [
  { id: 'bell', name: 'Zil' },
  { id: 'chime', name: 'Chime' },
  { id: 'ding', name: 'Ding' },
  { id: 'alert', name: 'Alarm' },
];

// Generate simple notification beeps using Web Audio API
function playBeep(type: string, volume: number) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  gainNode.gain.value = volume / 100;

  const configs: Record<string, { freq: number; duration: number; type: OscillatorType }> = {
    bell: { freq: 830, duration: 0.3, type: 'sine' },
    chime: { freq: 1200, duration: 0.2, type: 'sine' },
    ding: { freq: 600, duration: 0.5, type: 'triangle' },
    alert: { freq: 440, duration: 0.8, type: 'square' },
  };

  const config = configs[type] || configs.bell;
  oscillator.type = config.type;
  oscillator.frequency.value = config.freq;

  oscillator.start();

  // Fade out
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.duration);
  oscillator.stop(ctx.currentTime + config.duration);
}

export default function NotificationSettingsPage() {
  const [sound, setSound] = useState('bell');
  const [volume, setVolume] = useState(80);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  useEffect(() => {
    if (!token) return;
    fetch('/api/restaurant-settings', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(s => {
        if (s) {
          setSound(s.notificationSound || 'bell');
          setVolume(s.notificationVolume ?? 80);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/restaurant-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationSound: sound, notificationVolume: volume }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Bildirim ve Ses Ayarları</h1>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Sound Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Bildirim Sesi</label>
          <div className="grid grid-cols-2 gap-2">
            {SOUNDS.map(s => (
              <button
                key={s.id}
                onClick={() => { setSound(s.id); playBeep(s.id, volume); }}
                className={`flex items-center gap-2 p-3 rounded border text-sm transition ${
                  sound === s.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{'\u{1F514}'}</span>
                <span className="font-medium">{s.name}</span>
                {sound === s.id && <span className="ml-auto text-blue-500">{'\u2713'}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Volume */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ses Seviyesi: {volume}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Sessiz</span>
            <span>Maksimum</span>
          </div>
        </div>

        {/* Test Button */}
        <button
          onClick={() => playBeep(sound, volume)}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
        >
          {'\u{1F50A}'} Sesi Test Et
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Kaydediliyor...' : saved ? '\u2713 Kaydedildi!' : 'Kaydet'}
        </button>
      </div>

      <a href="/dashboard/settings" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
        {'\u2190'} Ayarlara D{'\u00F6'}n
      </a>
    </div>
  );
}
