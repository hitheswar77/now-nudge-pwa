'use client';
import { useState } from 'react';
import { useProximityNudge } from '@/hooks/useProximityNudge';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distLabel(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km away` : `${Math.round(m)} m away`;
}

export default function Dashboard() {
  const {
    nudges,
    position,
    error,
    notificationPermission,
    requestPermission,
    triggerTestNotification,
    simulateLocation,
    simulated,
    refreshNudges,
  } = useProximityNudge();

  const [demoBannerOpen, setDemoBannerOpen] = useState(true);

  async function handleDelete(id: string) {
    try {
      await fetch('/api/delete-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (typeof window !== 'undefined' && window.indexedDB) {
        const req = indexedDB.open('nudge-db', 1);
        req.onsuccess = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (db.objectStoreNames.contains('nudges')) {
            const tx = db.transaction('nudges', 'readwrite');
            tx.objectStore('nudges').delete(id);
            tx.oncomplete = () => refreshNudges();
          } else {
            refreshNudges();
          }
        };
      } else {
        refreshNudges();
      }
    } catch (e) {
      console.error('Failed to delete nudge:', e);
      alert('Could not delete nudge securely.');
    }
  }

  // Enrich nudges with live min distance across all their locations
  const enriched = nudges.map((n) => {
    let minDist: number | null = null;
    if (position) {
      const distances = [
        haversine(position.latitude, position.longitude, n.latitude, n.longitude)
      ];
      if (n.locations) {
        for (const loc of n.locations) {
          distances.push(haversine(position.latitude, position.longitude, loc.latitude, loc.longitude));
        }
      }
      minDist = Math.min(...distances);
    }
    return { ...n, dist: minDist };
  });

  // Sort: nearby first
  const sorted = [...enriched].sort((a, b) =>
    (a.dist ?? Infinity) - (b.dist ?? Infinity)
  );

  const heroNudge = sorted[0] ?? null;
  const scheduled = sorted.slice(1);

  const nearbyCount = sorted.filter((n) => n.dist !== null && n.dist < 500).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-32">

      {/* ── 1. Header ──────────────────────────────────────────────── */}
      <header className="px-6 pt-12 pb-6 bg-white shadow-xs">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-light text-blue-600">Now</h1>
            <p className="text-sm text-gray-500 mt-1">
              {nudges.length === 0
                ? 'No nudges yet — share a place to start'
                : `You have ${nearbyCount > 0 ? nearbyCount : nudges.length} nudge${nudges.length !== 1 ? 's' : ''} ${nearbyCount > 0 ? 'nearby' : 'active'}`}
            </p>
          </div>
          <button
            onClick={() => setDemoBannerOpen(!demoBannerOpen)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition border border-blue-200"
            title="Toggle Demo Tools"
          >
            {demoBannerOpen ? '🎯 Hide Demo Mode' : '🎯 Interview Demo Tools'}
          </button>
        </div>
      </header>

      {/* ── Demo / Interview Controls Toolbar ──────────────────────── */}
      {demoBannerOpen && (
        <div className="mx-4 my-4 p-4 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl text-white shadow-lg border border-blue-700/50 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-blue-300">
            <span>🎯 Interview Demo Panel</span>
            <button
              onClick={refreshNudges}
              className="hover:text-white transition underline flex items-center gap-1"
            >
              🔄 Refresh Nudges
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {/* GPS Position Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="text-xs text-blue-200 font-medium">GPS Status:</div>
                <div className="font-mono text-xs mt-1">
                  {position ? (
                    <>
                      {simulated ? '🎮 Simulated: ' : '📡 Live: '}
                      {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                    </>
                  ) : (
                    'Searching for GPS...'
                  )}
                </div>
                {error && <div className="text-xs text-red-300 mt-1">{error}</div>}
              </div>
              <div className="mt-2 flex gap-2">
                {heroNudge && (
                  <button
                    onClick={() => {
                      // Place user 50 meters away from the top nudge so proximity alert fires right away
                      simulateLocation(heroNudge.latitude + 0.0004, heroNudge.longitude + 0.0004);
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold py-1.5 px-2 rounded-xl transition text-center"
                  >
                    📍 Simulate Near First Nudge
                  </button>
                )}
                {simulated && (
                  <button
                    onClick={() => simulateLocation(null, null)}
                    className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-1.5 px-2 rounded-xl transition"
                  >
                    Reset GPS
                  </button>
                )}
              </div>
            </div>

            {/* Notification Tester Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="text-xs text-blue-200 font-medium">Notification Permission:</div>
                <div className="text-xs font-bold mt-1 uppercase tracking-wide flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${notificationPermission === 'granted' ? 'bg-green-400' : notificationPermission === 'denied' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  {notificationPermission}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                {notificationPermission !== 'granted' ? (
                  <button
                    onClick={requestPermission}
                    className="flex-1 bg-green-500 hover:bg-green-400 text-white text-xs font-semibold py-1.5 px-2 rounded-xl transition text-center"
                  >
                    🔔 Enable Notifications
                  </button>
                ) : (
                  <button
                    onClick={() => triggerTestNotification()}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold py-1.5 px-2 rounded-xl transition text-center"
                  >
                    🔔 Test Proximity Alert
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Main Content ────────────────────────────────────────── */}
      <main className="px-4 space-y-6">

        {/* Hero Card */}
        {heroNudge ? (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-blue-200">
            <div className="flex justify-between items-start">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md flex items-center gap-1">
                📍 {heroNudge.dist !== null ? distLabel(heroNudge.dist) : 'Locating…'}
                {heroNudge.dist !== null && heroNudge.dist < 500 && (
                  <span className="bg-green-400 text-green-950 font-extrabold px-1.5 py-0.5 rounded-full text-[10px]">NEARBY</span>
                )}
              </span>
              <button onClick={() => handleDelete(heroNudge.id)} className="text-white/70 hover:text-white transition p-1" aria-label="Delete Nudge">
                ✖
              </button>
            </div>
            <h2 className="text-2xl font-semibold mt-4">{heroNudge.title}</h2>
            <p className="opacity-80 mt-1">{heroNudge.text || heroNudge.body}</p>
            <div className="flex gap-2 mt-6">
              <a
                href={`https://maps.google.com/?q=${heroNudge.latitude},${heroNudge.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-white text-blue-600 font-bold py-3 px-4 rounded-2xl hover:bg-gray-100 transition text-center text-sm shadow-md">
                🗺️ Get Directions
              </a>
              <button
                onClick={() => simulateLocation(heroNudge.latitude + 0.0003, heroNudge.longitude + 0.0003)}
                className="bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-4 rounded-2xl transition text-xs flex items-center justify-center backdrop-blur-md"
                title="Simulate arriving right at this location"
              >
                🎯 Teleport Here
              </button>
            </div>
          </div>
        ) : (
          /* Empty hero — prompt to share */
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-blue-200">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md">
              📍 No location yet
            </span>
            <h2 className="text-2xl font-semibold mt-4">Add your first Nudge</h2>
            <p className="opacity-80 mt-1">Create a reminder linked to a location or product keyword.</p>
            <a
              href="/share"
              className="mt-6 block w-full bg-white text-blue-600 font-bold py-3 rounded-2xl hover:bg-gray-100 transition text-center shadow-md">
              + Create a Nudge Now →
            </a>
          </div>
        )}

        {/* Scheduled List */}
        <div className="space-y-3">
          <h3 className="px-2 text-sm font-bold text-gray-400 uppercase tracking-wider">Scheduled Nudges</h3>

          {scheduled.length === 0 && nudges.length === 0 && (
            <>
              <PlaceholderCard emoji="☕" title="Coffee at Starbucks" sub="Proximity alert ready" />
              <PlaceholderCard emoji="🛒" title="Buy Groceries" sub="Trigger when near BigBasket or Supermarket" />
            </>
          )}

          {scheduled.map((n) => (
            <div key={n.id} className="bg-white rounded-[24px] p-5 flex items-center shadow-sm border border-gray-100 hover:border-blue-200 transition">
              <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 cursor-pointer" onClick={() => simulateLocation(n.latitude + 0.0003, n.longitude + 0.0003)} title="Click to simulate standing right next to this nudge!">
                📍
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <p className="font-semibold truncate">{n.title}</p>
                <p className="text-sm text-gray-500 truncate">{n.text || n.body}</p>
                <p className="text-xs text-blue-600 font-medium mt-0.5">{n.dist !== null ? distLabel(n.dist) : 'Locating…'}</p>
              </div>
              {n.dist !== null && n.dist < 500 && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 font-bold px-2.5 py-1 rounded-full border border-green-200 animate-pulse">Nearby</span>
              )}
              <button onClick={() => handleDelete(n.id)} className="ml-3 text-gray-400 hover:text-red-500 transition p-2" aria-label="Delete Nudge">
                ✕
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* ── 3. Floating Bottom Nav (Glassmorphism) ─────────────────── */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/80 backdrop-blur-xl border border-white/40 rounded-[32px] shadow-2xl p-3 flex justify-around items-center z-50">
        <a href="/" className="text-blue-600 text-2xl p-2 hover:scale-110 transition" aria-label="Home">🏠</a>
        <button onClick={() => setDemoBannerOpen(true)} className="text-gray-400 text-2xl p-2 hover:scale-110 transition" aria-label="Demo Tools">📍</button>
        <a
          href="/share"
          className="bg-blue-600 h-14 w-14 rounded-2xl text-white text-3xl font-light shadow-lg shadow-blue-400/50 flex items-center justify-center hover:bg-blue-500 hover:scale-105 transition transform"
          aria-label="Add nudge">
          +
        </a>
        <button onClick={() => requestPermission()} className="text-gray-400 text-2xl p-2 hover:scale-110 transition" aria-label="Permissions">🔔</button>
        <button onClick={() => refreshNudges()} className="text-gray-400 text-2xl p-2 hover:scale-110 transition" aria-label="Refresh">🔄</button>
      </nav>

    </div>
  );
}

function PlaceholderCard({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-[24px] p-5 flex items-center shadow-xs border border-gray-100 opacity-60">
      <div className="h-12 w-12 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl">{emoji}</div>
      <div className="ml-4">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-500">{sub}</p>
      </div>
    </div>
  );
}
