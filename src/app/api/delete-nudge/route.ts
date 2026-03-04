import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations to bypass RLS
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { id } = await req.json();

        if (!id) {
            return Response.json({ error: 'Nudge ID is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('nudges')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[/api/delete-nudge] Supabase error:', error.message);
            return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[/api/delete-nudge] Unexpected error:', message);
        return Response.json({ error: message }, { status: 500 });
    }
}
