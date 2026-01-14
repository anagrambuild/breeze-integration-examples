import { NextRequest } from "next/server";
import { toApiAmount } from "../../utils/decimals";
import { AVAILABLE_ASSETS } from "../../config/tokens";

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const amount = searchParams.get("amount");
  const user_pubkey = searchParams.get("user_pubkey");
  const base_asset = searchParams.get("base_asset");
  const all = searchParams.get("all") === "true";

  if (!user_pubkey || !base_asset) {
    return new Response("Missing required parameters", { status: 400 });
  }

  // Find the token config to get the correct decimals
  const tokenConfig = AVAILABLE_ASSETS.find((asset) => asset.mint === base_asset);
  const decimals = tokenConfig?.decimals || 6; // Default to 6 if token not found

  const userAmount = Number(amount || 0);
  const apiAmount = toApiAmount(userAmount, decimals);

  const apiKey = process.env.BREEZE_API_KEY;
  // Easter egg: allow strategy_id override via query param
  const strategyId =
    searchParams.get("strategy_id") ||
    process.env.NEXT_PUBLIC_BREEZE_STRATEGY_ID;
  const baseUrl = process.env.BREEZE_API_BASE_URL;

  console.log("[deposittx] Input:", {
    amount,
    userAmount,
    apiAmount,
    decimals,
    user_pubkey,
    base_asset,
    all,
    strategyId,
  });

  if (!apiKey || !strategyId || !baseUrl) {
    console.error("Missing environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  const requestBody = {
    params: {
      strategy_id: strategyId,
      base_asset: base_asset,
      amount: apiAmount,
      all: all,
      user_key: user_pubkey,
      payer_key: user_pubkey,
    },
  };

  console.log(
    "[deposittx] Request body:",
    JSON.stringify(requestBody, null, 2)
  );

  const response = await fetch(`${baseUrl}/deposit/tx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();
  console.log("[deposittx] API response status:", response.status);
  console.log("[deposittx] API response:", text.substring(0, 500));

  // The API returns a JSON string containing the serialized transaction
  try {
    const data = JSON.parse(text);
    return Response.json({ data: data });
  } catch {
    return Response.json({ data: text });
  }
}
