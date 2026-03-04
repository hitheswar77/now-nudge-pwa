import { supabase } from '@/lib/supabase';

export interface NudgeInsert {
    title: string;
    body: string;
    latitude: number;
    longitude: number;
    locations?: { latitude: number; longitude: number; display_name?: string }[];
    radius_m?: number;
}

/**
 * Saves a new nudge row to Supabase.
 * Returns the inserted record or throws if the insert fails.
 */
export async function saveNudge(nudge: NudgeInsert) {
    const { data, error } = await supabase
        .from('nudges')
        .insert([nudge])
        .select()
        .single();

    if (error) {
        throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return data;
}

/**
 * Saves a nudge to IndexedDB as a local fallback when Supabase
 * is unavailable (e.g. offline).
 */
export async function saveNudgeLocally(nudge: NudgeInsert): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('nudge-db', 1);

        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('nudges')) {
                db.createObjectStore('nudges', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            const tx = db.transaction('nudges', 'readwrite');

            const payload = {
                ...nudge,
                body: JSON.stringify({ text: nudge.body, locations: nudge.locations ?? [] }),
                created_at: new Date().toISOString()
            };
            delete payload.locations; // don't store raw array

            tx.objectStore('nudges').add(payload);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        };

        request.onerror = () => reject(request.error);
    });
}
