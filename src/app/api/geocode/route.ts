interface LocationIQResult {
    lat: string;
    lon: string;
    display_name: string;
}

export async function POST(req: Request) {
    const { location_query } = await req.json();

    if (!location_query) {
        return Response.json(
            { error: "location_query is required" },
            { status: 400 }
        );
    }

    const apiKey = process.env.LOCATIONIQ_API_KEY;
    if (!apiKey) {
        return Response.json(
            { error: "LOCATIONIQ_API_KEY is not configured" },
            { status: 500 }
        );
    }

    const url = new URL("https://us1.locationiq.com/v1/search");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", location_query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString());

    if (!res.ok) {
        const body = await res.text();
        return Response.json(
            { error: `LocationIQ error: ${res.status}`, detail: body },
            { status: 502 }
        );
    }

    const data: LocationIQResult[] = await res.json();

    if (!data || data.length === 0) {
        return Response.json(
            { error: `No results found for "${location_query}"` },
            { status: 404 }
        );
    }

    const { lat, lon, display_name } = data[0];

    return Response.json({
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        display_name,
    });
}
