'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

export interface Nudge {
    id: string;
    title: string;
    body: string; // The raw JSON string
    text?: string; // Parsed display text
    locations?: { latitude: number; longitude: number; display_name?: string }[];
    latitude: number;
    longitude: number;
    radius_m?: number;
}

interface UseProximityNudgeOptions {
    /** Distance threshold in metres. Defaults to 500. */
    defaultRadius?: number;
}

async function getLocalNudges(): Promise<Nudge[]> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            return resolve([]);
        }
        const request = indexedDB.open('nudge-db', 1);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('nudges')) {
                db.createObjectStore('nudges', { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('nudges')) {
                return resolve([]);
            }
            const tx = db.transaction('nudges', 'readonly');
            const store = tx.objectStore('nudges');
            const getAllReq = store.getAll();
            getAllReq.onsuccess = () => {
                const items = getAllReq.result || [];
                const parsed = items.map((item: any) => {
                    let text = item.body;
                    let locations = [];
                    try {
                        const p = JSON.parse(item.body);
                        text = p.text || text;
                        locations = p.locations || [];
                    } catch {
                        // plain text
                    }
                    return {
                        id: String(item.id || `local_${Math.random()}`),
                        title: item.title,
                        body: typeof item.body === 'string' ? item.body : JSON.stringify(item.body),
                        text,
                        locations: locations || item.locations || [],
                        latitude: item.latitude || 0,
                        longitude: item.longitude || 0,
                        radius_m: item.radius_m || 500,
                    };
                });
                resolve(parsed);
            };
            getAllReq.onerror = () => resolve([]);
        };
        request.onerror = () => resolve([]);
    });
}

async function showPwaNotification(title: string, body: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title, {
                    body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-192x192.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                } as any);
                return;
            }
        } catch (e) {
            console.warn('SW showNotification failed, using fallback', e);
        }
    }
    new Notification(title, { body, icon: '/icons/icon-192x192.png' });
}

/** Hook that watches the device's position and fires a browser notification
 *  whenever the user enters the radius of a Nudge stored in Supabase or IndexedDB.
 */
export function useProximityNudge(options: UseProximityNudgeOptions = {}) {
    const { defaultRadius = 500 } = options;
    const [nudges, setNudges] = useState<Nudge[]>([]);
    const [livePosition, setLivePosition] = useState<GeolocationCoordinates | null>(null);
    const [simulatedPosition, setSimulatedPosition] = useState<{ latitude: number; longitude: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const notifiedIds = useRef<Set<string>>(new Set());
    const watchIdRef = useRef<number | null>(null);

    // Check notification permission state
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const requestPermission = useCallback(async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            const perm = await Notification.requestPermission();
            setNotificationPermission(perm);
            if (perm === 'granted' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.catch(() => {});
            }
            return perm;
        }
        return 'denied';
    }, []);

    const triggerTestNotification = useCallback(async (
        title = 'Now Nudge Alert 📍',
        body = 'Proximity notification test successful! You are nearby.'
    ) => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted') {
                const perm = await requestPermission();
                if (perm !== 'granted') {
                    alert('Please allow notification permissions in your browser to test alerts.');
                    return;
                }
            }
            await showPwaNotification(title, body);
        }
    }, [requestPermission]);

    // ── 1. Fetch nudges from Supabase + IndexedDB ──────────────────────────────
    const fetchNudges = useCallback(async () => {
        try {
            const { data, error: supaError } = await supabase
                .from('nudges')
                .select('id, title, body, latitude, longitude, radius_m');

            if (supaError) {
                console.warn('[useProximityNudge] Supabase error:', supaError.message);
                if (!error) setError(supaError.message);
            }

            const parsedData: Nudge[] = (data ?? []).map((n) => {
                let text = n.body;
                let locations = [];
                try {
                    const parsed = JSON.parse(n.body);
                    text = parsed.text || text;
                    locations = parsed.locations || [];
                } catch {
                    // It's a legacy nudge (unformatted string)
                }
                return { ...n, text, locations };
            });

            // Also load local offline nudges from IndexedDB
            const localData = await getLocalNudges();
            
            // Merge deduplicating by ID
            const map = new Map<string, Nudge>();
            localData.forEach((n) => map.set(n.id, n));
            parsedData.forEach((n) => map.set(n.id, n));

            setNudges(Array.from(map.values()));
        } catch (err: any) {
            console.error('[useProximityNudge] Fetch exception:', err);
        }
    }, [error]);

    useEffect(() => {
        fetchNudges();
    }, [fetchNudges]);

    // ── 2. Watch geolocation ───────────────────────────────────────────────────
    useEffect(() => {
        if (!navigator.geolocation) {
            const id = setTimeout(() =>
                setError('Geolocation is not supported by this browser.'), 0);
            return () => clearTimeout(id);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => setLivePosition(pos.coords),
            (err) => {
                console.warn('[Geolocation watch warning]', err.message);
                if (!livePosition && !simulatedPosition) {
                    setError('Could not get live GPS location. You can use Demo Mode below to simulate location.');
                }
            },
            { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
        );

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [livePosition, simulatedPosition]);

    const activePosition = simulatedPosition
        ? { latitude: simulatedPosition.latitude, longitude: simulatedPosition.longitude, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null } as GeolocationCoordinates
        : livePosition;

    const simulateLocation = useCallback((lat: number | null, lon: number | null) => {
        if (lat === null || lon === null) {
            setSimulatedPosition(null);
        } else {
            setSimulatedPosition({ latitude: lat, longitude: lon });
        }
    }, []);

    // ── 3. Compare & notify ────────────────────────────────────────────────────
    useEffect(() => {
        if (!activePosition || nudges.length === 0) return;

        nudges.forEach((nudge) => {
            const radius = nudge.radius_m ?? defaultRadius;

            // Check distance against the primary location AND all secondary locations
            const distances = [
                haversineDistance(activePosition.latitude, activePosition.longitude, nudge.latitude, nudge.longitude)
            ];

            if (nudge.locations) {
                for (const loc of nudge.locations) {
                    distances.push(haversineDistance(activePosition.latitude, activePosition.longitude, loc.latitude, loc.longitude));
                }
            }

            const minDist = Math.min(...distances);

            if (minDist < radius && !notifiedIds.current.has(nudge.id)) {
                notifiedIds.current.add(nudge.id);
                showPwaNotification(
                    `Now Nudge: ${nudge.title}`,
                    nudge.text || nudge.body || 'You are nearby!'
                );
            }

            // Reset badge when the user moves away (re-arm when re-entering)
            if (minDist >= radius) {
                notifiedIds.current.delete(nudge.id);
            }
        });
    }, [activePosition, nudges, defaultRadius]);

    return {
        position: activePosition,
        nudges,
        error,
        notificationPermission,
        requestPermission,
        triggerTestNotification,
        simulateLocation,
        simulated: !!simulatedPosition,
        refreshNudges: fetchNudges,
    };
}
