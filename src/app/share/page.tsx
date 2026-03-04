'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
    { key: 'extracting', label: '🧠 Understanding your content...', icon: '🧠' },
    { key: 'geocoding', label: '🗺️ Finding the location...', icon: '🗺️' },
    { key: 'saving', label: '💾 Saving your Nudge...', icon: '💾' },
];

function ProgressBar({ step }: { step: Step }) {
    const idx = STEPS.findIndex((s) => s.key === step);
    return (
        <div className="w-full max-w-sm">
            {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500
            ${i < idx ? 'bg-green-500 text-white' :
                            i === idx ? 'bg-blue-500 text-white animate-pulse' :
                                'bg-gray-700 text-gray-500'}`}>
                        {i < idx ? '✓' : s.icon}
                    </div>
                    <span className={`text-sm transition-colors duration-300
            ${i < idx ? 'text-green-400' :
                            i === idx ? 'text-white' :
                                'text-gray-600'}`}>
                        {s.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

import { Suspense } from 'react';

function ShareTargetInner() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState<Step>('extracting');
    const [nudge, setNudge] = useState<NudgeData | null>(null);
    const [geo, setGeo] = useState<GeoResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const title = searchParams.get('title');
        const text = searchParams.get('text');
        const url = searchParams.get('url');
        const sharedText = [title, text, url].filter(Boolean).join(' ');

        if (!sharedText.trim()) {
            setStep('empty');
            return;
        }

        async function run() {
            try {
                // ── Step 1: Gemini extracts structured intent ────────────────────
                setStep('extracting');
                const nudgeRes = await fetch('/api/nudge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sharedText }),
                });
                if (!nudgeRes.ok) throw new Error(`Gemini API error: ${nudgeRes.status}`);
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
                            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
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
                    if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
                    geoData = await geoRes.json();
                    setGeo(geoData && geoData.length > 0 ? geoData[0] : null);
                }

                // ── Step 3: Save to Supabase (or IndexedDB as fallback) ──────────
                setStep('saving');

                const nudgePayload = {
                    title: nudgeData.title,
                    body: nudgeData.body,
                    latitude: geoData?.[0]?.latitude ?? 0,
                    longitude: geoData?.[0]?.longitude ?? 0,
                    locations: geoData ?? [],
                    radius_m: 500,
                };

                try {
                    // Try server-side save via a dedicated save API route
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
        }

        run();
    }, [searchParams]);

    /* ── Render ─────────────────────────────────────────────────────────── */
    if (step === 'empty') {
        return (
            <Shell>
                <span className="text-5xl">🤷</span>
                <h1 className="text-xl font-semibold text-white">Nothing was shared</h1>
                <p className="text-gray-400 text-sm">Try sharing a link or text from another app.</p>
            </Shell>
        );
    }

    if (step === 'error') {
        return (
            <Shell>
                <span className="text-5xl">⚠️</span>
                <h1 className="text-xl font-semibold text-red-400">Something went wrong</h1>
                <p className="text-gray-400 text-sm text-center max-w-xs">{error}</p>
            </Shell>
        );
    }

    if (step === 'done') {
        return (
            <Shell>
                <span className="text-5xl">✅</span>
                <h1 className="text-2xl font-bold text-white">Nudge Created!</h1>
                <div className="bg-gray-800 rounded-2xl p-5 w-full max-w-sm text-left space-y-2">
                    <p className="text-lg font-semibold text-white">{nudge?.title}</p>
                    <p className="text-sm text-gray-300">{nudge?.body}</p>
                    {geo && (
                        <p className="text-xs text-blue-400 mt-2">
                            📍 {geo.display_name}<br />
                            <span className="text-gray-500">
                                {geo.latitude.toFixed(5)}, {geo.longitude.toFixed(5)}
                            </span>
                        </p>
                    )}
                    {!nudge?.location_query && (
                        <p className="text-xs text-yellow-500">⚠️ No location found — nudge saved without GPS trigger.</p>
                    )}
                </div>
                <p className="text-xs text-gray-600 mt-2">
                    You&apos;ll be notified when you&apos;re within 500m of this place.
                </p>
            </Shell>
        );
    }

    return (
        <Shell>
            <h1 className="text-2xl font-bold text-white mb-6">Processing your Nudge</h1>
            <ProgressBar step={step} />
        </Shell>
    );
}

export default function ShareTarget() {
    return (
        <Suspense fallback={
            <Shell>
                <h1 className="text-2xl font-bold text-white mb-6">Loading...</h1>
            </Shell>
        }>
            <ShareTargetInner />
        </Suspense>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gray-950 p-10">
            {children}
        </div>
    );
}
