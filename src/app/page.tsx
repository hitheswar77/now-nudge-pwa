'use client';
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
  const { nudges, position } = useProximityNudge();

  // Enrich nudges with live distance
  const enriched = nudges.map((n) => ({
    ...n,
    dist: position
      ? haversine(position.latitude, position.longitude, n.latitude, n.longitude)
      : null,
  }));

  // Sort: nearby first
  const sorted = [...enriched].sort((a, b) =>
    (a.dist ?? Infinity) - (b.dist ?? Infinity)
  );

  const heroNudge = sorted[0] ?? null;
  const scheduled = sorted.slice(1);

  const nearbyCount = sorted.filter((n) => n.dist !== null && n.dist < 500).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-28">

      {/* ── 1. Header ──────────────────────────────────────────────── */}
      <header className="px-6 pt-16 pb-8 bg-white">
        <h1 className="text-4xl font-light text-blue-600">Now</h1>
        <p className="text-lg text-gray-500">
          {nudges.length === 0
            ? 'No nudges yet — share a place to start'
            : `You have ${nearbyCount > 0 ? nearbyCount : nudges.length} nudge${nudges.length !== 1 ? 's' : ''} ${nearbyCount > 0 ? 'nearby' : 'active'}`}
        </p>
      </header>

      {/* ── 2. Main Content ────────────────────────────────────────── */}
      <main className="px-4 space-y-6 -mt-4">

        {/* Hero Card */}
        {heroNudge ? (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-blue-200">
            <div className="flex justify-between items-start">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md">
                📍 {heroNudge.dist !== null ? distLabel(heroNudge.dist) : 'Locating…'}
              </span>
            </div>
            <h2 className="text-2xl font-semibold mt-4">{heroNudge.title}</h2>
            <p className="opacity-80">{heroNudge.body}</p>
            <a
              href={`https://maps.google.com/?q=${heroNudge.latitude},${heroNudge.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full bg-white text-blue-600 font-bold py-3 rounded-2xl hover:bg-gray-100 transition text-center">
              Get Directions
            </a>
          </div>
        ) : (
          /* Empty hero — prompt to share */
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] p-6 text-white shadow-xl shadow-blue-200">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md">
              📍 No location yet
            </span>
            <h2 className="text-2xl font-semibold mt-4">Add your first Nudge</h2>
            <p className="opacity-80">Share a place, website or text to get started</p>
            <a
              href="/share?text=Coffee+shop+near+me"
              className="mt-6 block w-full bg-white text-blue-600 font-bold py-3 rounded-2xl hover:bg-gray-100 transition text-center">
              Try a demo Nudge →
            </a>
          </div>
        )}

        {/* Scheduled List */}
        <div className="space-y-3">
          <h3 className="px-2 text-sm font-bold text-gray-400 uppercase tracking-wider">Scheduled</h3>

          {scheduled.length === 0 && nudges.length === 0 && (
            <>
              {/* Placeholder cards so the UI never looks empty */}
              <PlaceholderCard emoji="🛒" title="Buy Groceries" sub="Shared from BigBasket" />
              <PlaceholderCard emoji="🏋️" title="Gym Session" sub="Proximity nudge active" />
            </>
          )}

          {scheduled.map((n) => (
            <div key={n.id} className="bg-white rounded-[24px] p-5 flex items-center shadow-sm border border-gray-100">
              <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                📍
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <p className="font-semibold truncate">{n.title}</p>
                <p className="text-sm text-gray-500">{n.dist !== null ? distLabel(n.dist) : 'Locating…'}</p>
              </div>
              {n.dist !== null && n.dist < 500 && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-1 rounded-full">Nearby</span>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* ── 3. Floating Bottom Nav (Glassmorphism) ─────────────────── */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/70 backdrop-blur-xl border border-white/20 rounded-[32px] shadow-2xl p-4 flex justify-around items-center z-50">
        <button className="text-blue-600 text-2xl" aria-label="Home">🏠</button>
        <button className="text-gray-400 text-2xl" aria-label="Map">📍</button>
        <a
          href="/share?text="
          className="bg-blue-600 h-12 w-12 rounded-2xl text-white text-2xl shadow-lg shadow-blue-300 flex items-center justify-center hover:bg-blue-500 transition"
          aria-label="Add nudge">
          +
        </a>
        <button className="text-gray-400 text-2xl" aria-label="Stats">📊</button>
        <button className="text-gray-400 text-2xl" aria-label="Settings">⚙️</button>
      </nav>

    </div>
  );
}

function PlaceholderCard({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-[24px] p-5 flex items-center shadow-sm border border-gray-100 opacity-50">
      <div className="h-12 w-12 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl">{emoji}</div>
      <div className="ml-4">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-gray-500">{sub}</p>
      </div>
    </div>
  );
}
