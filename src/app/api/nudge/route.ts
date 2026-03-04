import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
    try {
        const { sharedText } = await req.json();

        if (!sharedText) {
            return Response.json({ error: "sharedText is required" }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
        }

        // Use Flash model – try with JSON response type, fall back to plain text
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
        });

        const prompt = `
You are a task-extraction AI for a location-aware reminder PWA called "Now Nudge".

From the shared content below, extract structured information and return ONLY valid JSON (no markdown, no explanation) matching this schema:
{
  "title": "short human-readable title for the nudge (string, max 60 chars)",
  "body": "one-sentence reminder message shown in the notification (string, max 120 chars)",
  "location_query": "if a generic product is mentioned ('milk', 'eggs'), output the best generic POI category (e.g., 'supermarket', 'pharmacy', 'hardware store'). If a specific place is mentioned ('Orion Mall'), output that name. If no physical location or category can be inferred, output null."
}

Shared content: "${sharedText.replace(/"/g, '\\"')}"

Respond with ONLY the JSON object. No markdown fences.`;

        const result = await model.generateContent(prompt);
        const rawText = result.response.text().trim();

        // Strip markdown fences if Gemini adds them anyway
        const clean = rawText
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/, "")
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(clean);
        } catch {
            // Return raw text so user/developer can debug
            return Response.json(
                { error: "Gemini returned non-JSON", raw: clean },
                { status: 502 }
            );
        }

        return Response.json(parsed);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[/api/nudge] Error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
}
