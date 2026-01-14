// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const apiKey = process.env.BREEZE_API_KEY;
  const baseUrl = process.env.BREEZE_API_BASE_URL;
  const strategyId = process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID;

  if (!apiKey || !baseUrl || !strategyId) {
    console.error("Missing environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    const url = `${baseUrl}/strategy-info/${strategyId}`;

    console.log("[strategy-info] Fetching strategy info for:", strategyId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Strategy Info API - Error response:", errorText);
      return new Response(`Failed to fetch strategy info: ${response.status}`, {
        status: response.status,
      });
    }

    const data = await response.json();
    console.log("[strategy-info] API response:", JSON.stringify(data, null, 2));

    return Response.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Strategy Info API - Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
