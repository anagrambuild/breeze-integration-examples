// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user_pubkey = searchParams.get("user_pubkey");

  if (!user_pubkey) {
    return new Response("user_pubkey is required", { status: 400 });
  }

  const apiKey = process.env.BREEZE_API_KEY;
  const baseUrl = process.env.BREEZE_API_BASE_URL;
  const strategyId = process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID;

  if (!apiKey || !baseUrl || !strategyId) {
    console.error("Missing environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    // Use the unified breeze-balances endpoint which includes APY data
    const url = new URL(`${baseUrl}/breeze-balances/${user_pubkey}`);
    url.searchParams.append("strategy_id", strategyId);
    url.searchParams.append("sort_by", "balance");
    url.searchParams.append("sort_order", "desc");

    console.log("[yield] Fetching yield for:", user_pubkey, "strategy_id:", strategyId);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Yield API - Error response:", errorText);
      return new Response(`Failed to fetch yield data: ${response.status}`, {
        status: response.status,
      });
    }

    const data = await response.json();
    console.log("[yield] Returning data:", JSON.stringify(data, null, 2));

    return Response.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Yield API - Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
