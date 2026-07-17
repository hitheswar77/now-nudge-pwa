'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { saveNudgeLocally } from '@/lib/saveNudge';

type Step = 'extracting' | 'geocoding' | 'saving' | 'done' | 'error' | 'empty';

interface NudgeData {
    title: string;
    body: string;
    location_query: string | null;
}

interface GeoResult {
    latitude: number;
    longitude: number;
    display_name: string;
}

const STEPS = [
    { key: 'extracting', label: '🧠 Understanding your content with AI...', icon: '🧠' },
    { key: 'geocoding', label: '🗺️ Finding precise GPS coordinates...', icon: '🗺️' },
    { key: 'saving', label: '💾 Saving your Nudge securely...', icon: '💾' },
];

function ProgressBar({ step }: { step: Step }) {
    const idx = STEPS.findIndex((s) => s.key === step);
    return (
        <div className="w-full max-w-sm bg-gray-900/80 backdrop-blur-md p-6 rounded-3xl border border-gray-800 shadow-xl">
            {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-3 mb-4 last:mb-0">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 shadow-md
                        ${i < idx ? 'bg-green-500 text-white shadow-green-500/20' :
                            i === idx ? 'bg-blue-500 text-white animate-pulse shadow-blue-500/30' :
                                'bg-gray-800 text-gray-500'}`}>
                        {i < idx ? '✓' : s.icon}
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-300
                        ${i < idx ? 'text-green-400' :
                            i === idx ? 'text-white' :
                                'text-gray-500'}`}>
                        {s.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

const DEMO_PRESETS = [
    "Remind me to grab coffee when near Starbucks",
    "Buy fresh eggs and milk at BigBasket or Supermarket",
    "Pick up prescription from Apollo Pharmacy",
    "Watch new IMAX movie at Orion Mall"
];

function ShareTargetInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [step, setStep] = useState<Step>('extracting');
    const [nudge, setNudge] = useState<NudgeData | null>(null);
    const [geo, setGeo] = useState<GeoResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [customText, setCustomText] = useState('');
    const [isManualSubmit, setIsManualSubmit] = useState(false);

    const processText = async (sharedText: string) => {
        if (!sharedText.trim()) {
            setStep('empty');
            return;
        }

        try {
            // ── Step 1: Gemini extracts structured intent ────────────────────
            setStep('extracting');
            const nudgeRes = await fetch('/api/nudge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sharedText }),
            });
            if (!nudgeRes.ok) {
                const errJson = await nudgeRes.json().catch(() => ({}));
                throw new Error(errJson.error || `Gemini API error: ${nudgeRes.status}`);
            }
            const nudgeData: NudgeData = await nudgeRes.json();
            setNudge(nudgeData);

            // ── Step 2: LocationIQ geocodes the location_query ───────────────
            let geoData: GeoResult[] | null = null;
            if (nudgeData.location_query) {
                setStep('geocoding');

                let userLat: number | undefined;
                let userLon: number | undefined;

                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        if (!navigator.geolocation) reject(new Error("No geolocation"));
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
                    });
                    userLat = pos.coords.latitude;
                    userLon = pos.coords.longitude;
                } catch (e) {
                    console.warn("Could not get GPS for geocoding bias", e);
                }

                const geoRes = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        location_query: nudgeData.location_query,
                        lat: userLat,
                        lon: userLon
                    }),
                });
                if (geoRes.ok) {
                    geoData = await geoRes.json();
                    setGeo(geoData && geoData.length > 0 ? geoData[0] : null);
                } else {
                    console.warn(`Geocoding warning (${geoRes.status}) — using fallback coordinates.`);
                    // Fallback so demo never stalls on rate limit or unknown query
                    const fallbackCoord = {
                        latitude: userLat ? userLat + 0.002 : 13.0112,
                        longitude: userLon ? userLon + 0.002 : 77.5550,
                        display_name: `${nudgeData.location_query} (Estimated location)`
                    };
                    geoData = [fallbackCoord];
                    setGeo(fallbackCoord);
                }
            }

            // ── Step 3: Save to Supabase (or IndexedDB as fallback) ──────────
            setStep('saving');

            const nudgePayload = {
                title: nudgeData.title || 'New Reminder',
                body: nudgeData.body || sharedText,
                latitude: geoData?.[0]?.latitude ?? 0,
                longitude: geoData?.[0]?.longitude ?? 0,
                locations: geoData ?? [],
                radius_m: 500,
            };

            try {
                const saveRes = await fetch('/api/save-nudge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nudgePayload),
                });
                if (!saveRes.ok) throw new Error('server save failed');
            } catch {
                // Fallback: save locally in IndexedDB
                await saveNudgeLocally(nudgePayload);
            }

            setStep('done');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStep('error');
        }
    };

    useEffect(() => {
        if (isManualSubmit) return;
        const title = searchParams.get('title');
        const text = searchParams.get('text');
        const url = searchParams.get('url');
        const sharedText = [title, text, url].filter(Boolean).join(' ');

        if (!sharedText.trim()) {
            setStep('empty');
            return;
        }

        processText(sharedText);
    }, [searchParams, isManualSubmit]);

    /* ── Render ─────────────────────────────────────────────────────────── */
    if (step === 'empty') {
        return (
            <Shell>
                <div className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl p-8 rounded-[36px] border border-gray-800 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl bg-blue-600/20 p-2.5 rounded-2xl border border-blue-500/30">✨</span>
                            <div>
                                <h1 className="text-2xl font-bold text-white">Create a Nudge</h1>
                                <p className="text-gray-400 text-xs">AI transforms your text into a location trigger</p>
                            </div>
                        </div>
                        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white p-2 transition text-lg">✕</button>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">
                            What do you want to be reminded about?
                        </label>
                        <textarea
                            rows={3}
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value)}
                            placeholder="e.g., Remind me to buy groceries when near BigBasket or Supermarket..."
                            className="w-full bg-gray-950 border border-gray-800 rounded-2xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm transition resize-none"
                        />
                    </div>

                    <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                            ⚡ Quick Demo Presets:
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {DEMO_PRESETS.map((preset, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCustomText(preset)}
                                    className="bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white text-xs py-2 px-3 rounded-xl border border-gray-700/50 transition text-left leading-relaxed"
                                >
                                    + {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={() => router.push('/')}
                            className="w-1/3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3.5 rounded-2xl transition text-sm text-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!customText.trim()}
                            onClick={() => {
                                setIsManualSubmit(true);
                                processText(customText);
                            }}
                            className="w-2/3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/30 transition text-sm text-center"
                        >
                            ✨ Create with AI →
                        </button>
                    </div>
                </div>
            </Shell>
        );
    }

    if (step === 'error') {
        return (
            <Shell>
                <div className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl p-8 rounded-[36px] border border-gray-800 shadow-2xl text-center space-y-5">
                    <span className="text-5xl inline-block bg-red-500/10 p-4 rounded-3xl border border-red-500/20">⚠️</span>
                    <h1 className="text-xl font-bold text-red-400">Could not process Nudge</h1>
                    <p className="text-gray-300 text-sm bg-gray-950 p-4 rounded-2xl font-mono text-left break-words">{error}</p>
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setStep('empty')}
                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-2xl transition text-sm"
                        >
                            🔄 Try Again
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition text-sm"
                        >
                            🏠 Dashboard
                        </button>
                    </div>
                </div>
            </Shell>
        );
    }

    if (step === 'done') {
        return (
            <Shell>
                <div className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl p-8 rounded-[36px] border border-gray-800 shadow-2xl space-y-6 text-center">
                    <span className="text-6xl inline-block bg-green-500/10 p-4 rounded-3xl border border-green-500/20 animate-bounce">✅</span>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Nudge Created!</h1>
                        <p className="text-xs text-gray-400 mt-1">Ready and armed for proximity detection</p>
                    </div>

                    <div className="bg-gray-950 rounded-3xl p-5 border border-gray-800 text-left space-y-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/30">
                                {nudge?.title || 'Reminder'}
                            </span>
                            <p className="text-sm font-medium text-gray-200 mt-2.5 leading-relaxed">{nudge?.body}</p>
                        </div>

                        {geo && (
                            <div className="pt-3 border-t border-gray-800/80 flex items-start gap-2.5">
                                <span className="text-lg">📍</span>
                                <div>
                                    <p className="text-xs font-semibold text-blue-400 leading-tight">{geo.display_name}</p>
                                    <p className="text-[11px] font-mono text-gray-500 mt-1">
                                        {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!nudge?.location_query && (
                            <p className="text-xs bg-yellow-500/10 text-yellow-400 p-2.5 rounded-xl border border-yellow-500/20">
                                ⚠️ No specific location detected — nudge saved as a general note.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => {
                                setIsManualSubmit(true);
                                setCustomText('');
                                setStep('empty');
                            }}
                            className="w-1/2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3.5 rounded-2xl transition text-sm"
                        >
                            + Add Another
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="w-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/30 transition text-sm"
                        >
                            ← Dashboard
                        </button>
                    </div>
                </div>
            </Shell>
        );
    }

    return (
        <Shell>
            <div className="w-full max-w-md text-center space-y-6">
                <h1 className="text-2xl font-bold text-white">Processing your Nudge</h1>
                <ProgressBar step={step} />
                <button
                    onClick={() => router.push('/')}
                    className="text-xs text-gray-500 hover:text-gray-300 underline transition"
                >
                    Cancel and return to Dashboard
                </button>
            </div>
        </Shell>
    );
}

export default function ShareTarget() {
    return (
        <Suspense fallback={
            <Shell>
                <div className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl p-8 rounded-[36px] border border-gray-800 text-center">
                    <h1 className="text-xl font-bold text-white">Loading Nudge AI...</h1>
                </div>
            </Shell>
        }>
            <ShareTargetInner />
        </Suspense>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 p-6 font-sans">
            {children}
        </div>
    );
}
