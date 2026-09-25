import "server-only";

export interface IntegrationStatus {
  name: string;
  state: "ok" | "not_configured" | "error";
  message: string;
  checkedAt: string;
}

const PSA_TEST_CERT = "10000000";

async function checkPsa(): Promise<Omit<IntegrationStatus, "checkedAt">> {
  const token = process.env.PSA_API_TOKEN?.trim();
  if (!token) return { name: "PSA", state: "not_configured", message: "PSA_API_TOKEN is not set." };
  try {
    const res = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${PSA_TEST_CERT}`, {
      headers: { Authorization: `bearer ${token}` },
      cache: "no-store",
    });
    const body = (await res.text()).slice(0, 200);
    if (res.ok || res.status === 404) return { name: "PSA", state: "ok", message: `Live — cert lookup answered (HTTP ${res.status}).` };
    if (res.status === 403) {
      return {
        name: "PSA",
        state: "error",
        message: `PSA refused the token: ${body}. The PSA account behind this token isn't approved for API access yet — contact collectors-apis@collectors.com or generate a new token at psacard.com/publicapi.`,
      };
    }
    if (res.status === 401) return { name: "PSA", state: "error", message: "Token is invalid or expired — generate a new one at psacard.com/publicapi." };
    if (res.status === 429) return { name: "PSA", state: "error", message: "Daily quota (100 calls) used up — resets tomorrow." };
    return { name: "PSA", state: "error", message: `Unexpected HTTP ${res.status}: ${body}` };
  } catch (err) {
    return { name: "PSA", state: "error", message: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function checkEbay(): Promise<Omit<IntegrationStatus, "checkedAt">> {
  const appId = process.env.EBAY_APP_ID?.trim();
  const certId = process.env.EBAY_CERT_ID?.trim();
  if (!appId || !certId) {
    return { name: "eBay", state: "not_configured", message: "EBAY_APP_ID and EBAY_CERT_ID are not set." };
  }
  try {
    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${appId}:${certId}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
      cache: "no-store",
    });
    const tokenData = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || typeof tokenData?.access_token !== "string") {
      return {
        name: "eBay",
        state: "error",
        message: `eBay rejected the keys (HTTP ${tokenRes.status}): ${tokenData?.error_description ?? tokenData?.error ?? "no details"}. Use the Production keyset (not Sandbox) and make sure it's active.`,
      };
    }
    const searchRes = await fetch(
      "https://api.ebay.com/buy/browse/v1/item_summary/search?q=Charizard%20PSA%2010&limit=3",
      { headers: { Authorization: `Bearer ${tokenData.access_token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }, cache: "no-store" },
    );
    if (!searchRes.ok) {
      return { name: "eBay", state: "error", message: `Token OK, but Browse search failed (HTTP ${searchRes.status}): ${(await searchRes.text()).slice(0, 200)}` };
    }
    const data = await searchRes.json();
    return { name: "eBay", state: "ok", message: `Live — test search returned ${data?.total ?? 0} listings.` };
  } catch (err) {
    return { name: "eBay", state: "error", message: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function checkTcg(): Promise<Omit<IntegrationStatus, "checkedAt">> {
  const key = process.env.TCG_API_KEY?.trim();
  if (!key) return { name: "TCG API", state: "not_configured", message: "TCG_API_KEY is not set." };
  try {
    const res = await fetch("https://api.tcgapi.dev/v1/search?q=Charizard", { headers: { "X-API-Key": key }, cache: "no-store" });
    if (!res.ok) return { name: "TCG API", state: "error", message: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const data = await res.json();
    return { name: "TCG API", state: "ok", message: `Live — test search returned ${Array.isArray(data?.data) ? data.data.length : 0} cards.` };
  } catch (err) {
    return { name: "TCG API", state: "error", message: `Network error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Live check of every external price/verification API, for the admin Integrations tab. */
export async function checkAllIntegrations(): Promise<IntegrationStatus[]> {
  const checkedAt = new Date().toISOString();
  const results = await Promise.all([checkPsa(), checkEbay(), checkTcg()]);
  return results.map((r) => ({ ...r, checkedAt }));
}
