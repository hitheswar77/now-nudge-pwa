import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side inserts if available, fall back to anon
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, body: rawBody, latitude, longitude, locations = [], radius_m = 500 } = body;

        if (!title || !rawBody) {
            return Response.json({ error: 'title and body are required' }, { status: 400 });
        }

        // --- Hack to bypass Supabase schema migration ---
        // We pack the body + locations array into a single JSON string in the `body` text column
        const nudgeBody = JSON.stringify({
            text: rawBody,
            locations: locations
        });

        const { data, error } = await supabase
            .from('nudges')
            .insert([{ title, body: nudgeBody, latitude, longitude, radius_m }])
            .select()
            .single();

        if (error) {
            console.error('[/api/save-nudge] Supabase error:', error.message, error.code);
            return Response.json(
                { error: error.message, hint: 'Run the schema SQL in your Supabase SQL editor first.' },
                { status: 500 }
            );
        }

        return Response.json(data, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[/api/save-nudge] Unexpected error:', message);
        return Response.json({ error: message }, { status: 500 });
    }
}
