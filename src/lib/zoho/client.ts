interface ZohoTokenCache {
  accessToken: string;
  expiresAt: number; // timestamp in ms
}

let tokenCache: ZohoTokenCache | null = null;

export class ZohoClient {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private orgId: string;
  private apiDomain: string;

  constructor() {
    this.clientId = process.env.ZOHO_CLIENT_ID || "";
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || "";
    this.orgId = process.env.ZOHO_ORGANIZATION_ID || "";
    this.apiDomain = (process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com").replace(/\/$/, "");
  }

  /**
   * Refreshes and returns an active OAuth access token.
   * Cached in memory with safety buffer before expiration.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (tokenCache && tokenCache.expiresAt > now + 60000) {
      return tokenCache.accessToken;
    }

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error(
        "Zoho credentials are not fully configured (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN)"
      );
    }

    const tokenUrl = "https://accounts.zoho.com/oauth/v2/token";
    const params = new URLSearchParams({
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    });

    try {
      const res = await fetch(`${tokenUrl}?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(
          `Zoho OAuth token refresh failed: ${data.error || res.statusText} (${JSON.stringify(data)})`
        );
      }

      const expiresInSeconds = data.expires_in || 3600;
      tokenCache = {
        accessToken: data.access_token,
        expiresAt: now + expiresInSeconds * 1000,
      };

      return tokenCache.accessToken;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[ZohoClient] Error refreshing access token:", errorMsg);
      throw new Error(`Failed to authenticate with Zoho: ${errorMsg}`);
    }
  }

  /**
   * Generic request wrapper for Zoho Inventory REST API
   */
  async request<T = unknown>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      isJsonPayload?: boolean;
    } = {}
  ): Promise<{ code: number; message: string; data: T; raw: unknown }> {
    const token = await this.getAccessToken();
    const { method = "GET", params = {}, body } = options;

    const urlParams = new URLSearchParams({
      organization_id: this.orgId,
    });

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        urlParams.append(key, String(value));
      }
    }

    const fullUrl = `${this.apiDomain}/inventory/v1${endpoint.startsWith("/") ? "" : "/"}${endpoint}?${urlParams.toString()}`;

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
    };

    let fetchBody: string | undefined;

    if (body) {
      if (method === "POST" || method === "PUT") {
        // Zoho Inventory accepts JSON formatted string in JSONString parameter or standard JSON
        headers["Content-Type"] = "application/json;charset=UTF-8";
        fetchBody = JSON.stringify(body);
      }
    }

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: fetchBody,
    });

    const responseData = await response.json().catch(() => ({
      code: response.status,
      message: response.statusText,
    }));

    if (!response.ok || (responseData.code !== 0 && responseData.code !== 200 && responseData.code !== 201)) {
      const errMsg = responseData.message || response.statusText || "Zoho API request failed";
      const error = new Error(`Zoho API Error (${response.status}): ${errMsg}`);
      (error as unknown as { zohoResponse: unknown; statusCode: number }).zohoResponse = responseData;
      (error as unknown as { zohoResponse: unknown; statusCode: number }).statusCode = response.status;
      throw error;
    }

    return {
      code: responseData.code ?? 0,
      message: responseData.message ?? "success",
      data: responseData as T,
      raw: responseData,
    };
  }
}

export const zohoClient = new ZohoClient();
