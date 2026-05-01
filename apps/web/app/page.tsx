'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState('');

  useEffect(() => {
    fetch('http://localhost:4000')
      .then(res => res.json())
      .then(res => setData(res.message))
      .catch(() => setData('API bağlanamadı ❌'));
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Frontend çalışıyor</h1>
      <p className="mt-4">API: {data}</p>
    </div>
  );
}