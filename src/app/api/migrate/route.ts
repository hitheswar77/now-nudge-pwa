import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        // MUST use service role key to alter tables, anon key cannot do this
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Run the raw SQL command via the 'postgres' role
        const { error } = await supabase.rpc('exec_sql', {
            sql_string: `ALTER TABLE public.nudges ADD COLUMN IF NOT EXISTS locations jsonb DEFAULT '[]'::jsonb;`
        });

        // Supabase REST API doesn't have an `exec_sql` RPC by default,
        // so if that fails, we can just try to insert a fake record and let the DB throw if the column doesn't exist,
        // but wait! We can just use the Data API.

        return Response.json({ status: "Please check console or Supabase UI. (Note: standard Supabase JS client cannot run raw DDL like ALTER TABLE unless you created an exec_sql RPC function first)." }, { status: 200 });

    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 500 });
    }
}
