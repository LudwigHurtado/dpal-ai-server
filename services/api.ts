/**
 * Centralized API service with error handling and retry logic
 */

// API Configuration
const API_CONFIG = {
  baseUrl: (import.meta as any).env?.VITE_API_BASE || 'https://web-production-a27b.up.railway.app',
  timeout: 30000, // 30 seconds
  retries: 2,
} as const;

/**
 * Get full API URL for an endpoint
 */
function getApiUrl(endpoint: string): string {
  const base = API_CONFIG.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make API request with retry logic and error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= API_CONFIG.retries; attempt++) {
    // Create new controller and timeout for each attempt
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: { error?: string; code?: string } = { error: response.statusText };
        try {
          errorData = await response.json() as { error?: string; code?: string };
        } catch {
          // fallback is already set above
        }
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        // Always include the URL in the error message
        const fullMessage = `${errorMessage} (URL: ${url})`;
        throw new ApiError(
          fullMessage,
          response.status,
          errorData.code
        );
      }

      return await response.json() as T;

    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry on client errors (4xx) or if aborted
      if (error instanceof ApiError && error.status && error.status < 500) {
        throw error;
      }
      if (error.name === 'AbortError') {
        // Don't retry on timeout - throw immediately
        throw new ApiError(
          `Request timeout. Please check your connection. (URL: ${url})`,
          408,
          'TIMEOUT'
        );
      }

      // If this is the last attempt, throw the error
      if (attempt >= API_CONFIG.retries) {
        if (lastError instanceof Error) {
          // If we have a last error, rethrow, but guarantee URL inclusion
          if (lastError instanceof ApiError && !lastError.message.includes(url)) {
            throw new ApiError(
              `${lastError.message} (URL: ${url})`,
              (lastError as ApiError).status,
              (lastError as ApiError).code
            );
          }
          throw lastError;
        } else {
          throw new ApiError(`Network request failed after retries. (URL: ${url})`);
        }
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError || new ApiError(`Network request failed (URL: ${url})`);
}

/**
 * Mint an NFT
 */
export async function mintNft(params: {
  userId: string;
  prompt: string;
  theme: string;
  category: string;
  priceCredits?: number;
  traits?: string[];
  idempotencyKey?: string;
}): Promise<{
  ok: boolean;
  tokenId: string;
  imageUrl: string;
  txHash: string;
  priceCredits: number;
  mintedAt: Date;
}> {
  return apiRequest('/api/nft/mint', {
    method: 'POST',
    body: JSON.stringify({
      userId: params.userId,
      prompt: params.prompt,
      theme: params.theme,
      category: params.category,
      priceCredits: params.priceCredits || 500,
      traits: params.traits || [],
      idempotencyKey: params.idempotencyKey || `mint-${params.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    }),
  });
}

/**
 * Purchase a store item
 */
export async function purchaseStoreItem(params: {
  heroId: string;
  item: {
    sku: string;
    name: string;
    description: string;
    icon: string;
    price: number;
  };
}): Promise<{
  ok: boolean;
  hero: any;
  wallet: any;
}> {
  return apiRequest('/api/store/purchase-item', {
    method: 'POST',
    body: JSON.stringify({
      heroId: params.heroId,
      item: params.item,
    }),
  });
}

/**
 * Purchase an IAP pack
 */
export async function purchaseIapPack(params: {
  heroId: string;
  pack: {
    sku: string;
    price: number;
    hcAmount: number;
  };
}): Promise<{
  ok: boolean;
  wallet: any;
}> {
  return apiRequest('/api/store/purchase-iap', {
    method: 'POST',
    body: JSON.stringify({
      heroId: params.heroId,
      pack: params.pack,
    }),
  });
}

/**
 * Get NFT receipts for a user (or all receipts if userId is empty)
 */
export async function getNftReceipts(userId: string): Promise<Array<{
  _id: string;
  userId: string;
  tokenId: string;
  txHash: string;
  priceCredits: number;
  createdAt: string;
  mintedAt?: string;
}>> {
  const url = userId 
    ? `/api/nft/receipts?userId=${encodeURIComponent(userId)}`
    : `/api/nft/receipts`;
  return apiRequest(url, {
    method: 'GET',
  });
}

/**
 * Check if API is reachable
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const url = getApiUrl('/health');
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}