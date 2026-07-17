interface LocationIQResult {
    lat: string;
    lon: string;
    display_name: string;
}

export async function POST(req: Request) {
    const { location_query, lat, lon } = await req.json();

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
    url.searchParams.set("limit", "10");

    if (lat && lon) {
        // Create a ~50km bounding box around the user (1 degree of lat/lon is roughly 111km)
        const offset = 0.5; // ~55km
        const left = parseFloat(lon) - offset;
        const bottom = parseFloat(lat) - offset;
        const right = parseFloat(lon) + offset;
        const top = parseFloat(lat) + offset;

        url.searchParams.set("viewbox", `${left},${bottom},${right},${top}`);
        url.searchParams.set("bounded", "1"); // Restrict results strictly to this box if possible

        // Also pass lat/lon for sorting/weighting within that box
        url.searchParams.set("lat", lat.toString());
        url.searchParams.set("lon", lon.toString());
    }

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

    const locations = data.map(item => ({
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        display_name: item.display_name,
    }));

    return Response.json(locations);
}
