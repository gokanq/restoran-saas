'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CourierLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function pressKey(k: string) {
    if (pin.length < 6) {
      setPin(pin + k);
      setError('');
    }
  }

  function clearPin() {
    setPin('');
    setError('');
  }

  function backspace() {
    setPin(pin.slice(0, -1));
    setError('');
  }

  async function handleSubmit() {
    if (pin.length < 4) {
      setError('PIN en az 4 haneli olmalı');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/courier-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: pin }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('courierToken', data.token);
        localStorage.setItem('courierName', data.courier.name);
        router.push('/kurye');
      } else {
        const err = await res.json();
        setError(err.message || 'Geçersiz PIN');
        setPin('');
      }
    } catch {
      setError('Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🚴</div>
          <h1 className="text-2xl font-bold text-gray-900">Kurye Girişi</h1>
          <p className="text-sm text-gray-500 mt-1">PIN kodunuzu girin</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition ${
                i < pin.length ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="text-center text-red-500 text-sm mb-4 bg-red-50 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === 'C') clearPin();
                else if (k === '⌫') backspace();
                else pressKey(k);
              }}
              className={`h-16 rounded-2xl font-semibold text-xl transition active:scale-95 ${
                k === 'C' || k === '⌫'
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={pin.length < 4 || loading}
          className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-6">
          PIN kodunuzu yöneticinizden alın
        </p>
      </div>
    </div>
  );
}
