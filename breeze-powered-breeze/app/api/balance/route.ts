import { NextRequest } from "next/server";
import { fromApiAmount } from "../../utils/decimals";

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const user_pubkey = searchParams.get("user_pubkey");

  if (!user_pubkey) {
    return new Response("user_pubkey is required", { status: 400 });
  }

  const apiKey = process.env.BREEZE_API_KEY;
  const baseUrl = process.env.BREEZE_API_BASE_URL;

  if (!apiKey || !baseUrl) {
    console.error("Missing environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  const strategyId = process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID;

  if (!strategyId) {
    console.error("Missing NEXT_PUBLIC_BREEZE_STRATEGY_ID");
    return new Response("Server configuration error", { status: 500 });
  }

  try {
    // Use the new unified breeze-balances endpoint
    const url = new URL(`${baseUrl}/breeze-balances/${user_pubkey}`);

    // Add required and optional query parameters
    url.searchParams.append("strategy_id", strategyId);
    url.searchParams.append("sort_by", "balance");
    url.searchParams.append("sort_order", "desc");

    console.log("[balance] Fetching balance for:", user_pubkey, "strategy_id:", strategyId);

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
      console.error("Balance API - Error response:", errorText);
      return new Response(`Failed to fetch balance: ${response.status}`, {
        status: response.status,
      });
    }

    const data = await response.json();
    console.log("[balance] Raw API response:", JSON.stringify(data, null, 2));

    // Convert API amounts to user-facing amounts for the unified response format
    if (data.data && Array.isArray(data.data)) {
      const convertedData = {
        ...data,
        data: data.data.map(
          (item: {
            total_position_value: number;
            total_deposited_value: number;
            yield_earned: number;
            decimals: number;
            [key: string]: unknown;
          }) => {
            // Use the token's specific decimals from the API response
            const decimals = item.decimals || 6; // Default to 6 if not provided
            return {
              ...item,
              total_position_value: fromApiAmount(item.total_position_value, decimals),
              total_deposited_value: fromApiAmount(item.total_deposited_value, decimals),
              yield_earned: fromApiAmount(item.yield_earned, decimals),
            };
          }
        ),
      };

      console.log("[balance] Returning converted data:", JSON.stringify(convertedData, null, 2));

      return Response.json(convertedData, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Balance API - Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
