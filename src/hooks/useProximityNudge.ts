'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Haversine formula: returns distance in metres between two lat/lon points
function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371000; // Earth's radius in metres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Nudge {
    id: string;
    title: string;
    body: string;
    latitude: number;
    longitude: number;
    radius_m?: number; // optional per-nudge radius, defaults to 500
}

interface UseProximityNudgeOptions {
    /** Distance threshold in metres. Defaults to 500. */
    defaultRadius?: number;
}

/** Hook that watches the device's position and fires a browser notification
 *  whenever the user enters the radius of a Nudge stored in Supabase.
 */
export function useProximityNudge(options: UseProximityNudgeOptions = {}) {
    const { defaultRadius = 500 } = options;
    const [nudges, setNudges] = useState<Nudge[]>([]);
    const [position, setPosition] = useState<GeolocationCoordinates | null>(null);
    const [error, setError] = useState<string | null>(null);
    const notifiedIds = useRef<Set<string>>(new Set());
    const watchIdRef = useRef<number | null>(null);

    // ── 1. Fetch nudges from Supabase ──────────────────────────────────────────
    useEffect(() => {
        async function fetchNudges() {
            const { data, error } = await supabase
                .from('nudges')
                .select('id, title, body, latitude, longitude, radius_m');

            if (error) {
                console.error('[useProximityNudge] Supabase error:', error.message);
                setError(error.message);
                return;
            }
            setNudges(data ?? []);
        }

        fetchNudges();
    }, []);

    // ── 2. Watch geolocation ───────────────────────────────────────────────────
    useEffect(() => {
        if (!navigator.geolocation) {
            // Defer to avoid synchronous setState inside effect body
            const id = setTimeout(() =>
                setError('Geolocation is not supported by this browser.'), 0);
            return () => clearTimeout(id);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => setPosition(pos.coords),
            (err) => setError(err.message),
            { enableHighAccuracy: true, maximumAge: 10_000, timeout: 10_000 }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []);

    // ── 3. Compare & notify ────────────────────────────────────────────────────
    useEffect(() => {
        if (!position || nudges.length === 0) return;

        nudges.forEach((nudge) => {
            const radius = nudge.radius_m ?? defaultRadius;
            const dist = haversineDistance(
                position.latitude, position.longitude,
                nudge.latitude, nudge.longitude
            );

            if (dist < radius && !notifiedIds.current.has(nudge.id)) {
                notifiedIds.current.add(nudge.id);

                if (Notification.permission === 'granted') {
                    new Notification(nudge.title, {
                        body: nudge.body,
                        icon: '/icons/icon-192x192.png',
                    });
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then((perm) => {
                        if (perm === 'granted') {
                            new Notification(nudge.title, {
                                body: nudge.body,
                                icon: '/icons/icon-192x192.png',
                            });
                        }
                    });
                }
            }

            // Reset badge when the user moves away (re-arm when re-entering)
            if (dist >= radius) {
                notifiedIds.current.delete(nudge.id);
            }
        });
    }, [position, nudges, defaultRadius]);

    return { position, nudges, error };
}
