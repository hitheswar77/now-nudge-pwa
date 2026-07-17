import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Rule-based heuristic fallback in case API quota is hit or offline during demo
function heuristicFallback(sharedText: string) {
    const text = sharedText.trim();
    let location_query: string | null = null;
    const lower = text.toLowerCase();

    // Check common POIs or place keywords
    const poiKeywords = [
        { key: "starbucks", poi: "Starbucks" },
        { key: "coffee", poi: "coffee shop" },
        { key: "cafe", poi: "cafe" },
        { key: "supermarket", poi: "supermarket" },
        { key: "bigbasket", poi: "supermarket" },
        { key: "grocery", poi: "supermarket" },
        { key: "pharmacy", poi: "pharmacy" },
        { key: "apollo", poi: "pharmacy" },
        { key: "medicine", poi: "pharmacy" },
        { key: "mall", poi: "shopping mall" },
        { key: "orion mall", poi: "Orion Mall" },
        { key: "gym", poi: "gym" },
        { key: "airport", poi: "airport" },
    ];

    for (const item of poiKeywords) {
        if (lower.includes(item.key)) {
            location_query = item.poi;
            break;
        }
    }

    return {
        title: text.length > 35 ? text.slice(0, 35) + "..." : text,
        body: text,
        location_query,
    };
}

export async function POST(req: Request) {
    try {
        const { sharedText } = await req.json();

        if (!sharedText) {
            return Response.json({ error: "sharedText is required" }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.warn("[/api/nudge] GEMINI_API_KEY missing, using heuristic fallback.");
            return Response.json(heuristicFallback(sharedText));
        }

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

        const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
        let lastErr: unknown = null;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const rawText = result.response.text().trim();

                const clean = rawText
                    .replace(/^```(?:json)?\s*/i, "")
                    .replace(/```\s*$/, "")
                    .trim();

                const parsed = JSON.parse(clean);
                return Response.json(parsed);
            } catch (err) {
                console.warn(`[/api/nudge] Model ${modelName} failed, trying next...`, err);
                lastErr = err;
            }
        }

        console.warn("[/api/nudge] All Gemini models failed, using heuristic fallback for demo.", lastErr);
        return Response.json(heuristicFallback(sharedText));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[/api/nudge] Error:", message);
        return Response.json({ error: message }, { status: 500 });
    }
}
