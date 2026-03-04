import { Client } from 'pg';

async function run() {
    // Supabase Postgres URI
    const uri = "postgres://postgres.papfagdonicfadtkwjxr:hithesw%40r77@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

    console.log("Connecting to Supabase Database...");

    const client = new Client({
        connectionString: uri,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();

        console.log("Running ALTER TABLE...");
        const res = await client.query('ALTER TABLE public.nudges ADD COLUMN IF NOT EXISTS locations jsonb DEFAULT \'[]\'::jsonb;');
        console.log("Query Response:", res.command);
        console.log("✅ Successfully added 'locations' column!");
    } catch (err) {
        console.error("❌ Error running migration:", err);
    } finally {
        await client.end();
    }
}

run();
