import React, { useState, useMemo } from 'react';
import { Check, X, Loader, AlertCircle, Server, Database, Key, Globe, Zap } from './icons';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  responseTime?: number;
  details?: any;
}

// Helper to normalize URLs (remove trailing slashes)
const normalizeUrl = (url: string): string => {
  return url.trim().replace(/\/+$/, '');
};

// Helper to make API request with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000
): Promise<{ response: Response; responseTime: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    return { response, responseTime };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    throw { error, responseTime };
  }
}

const BackendTestPanel: React.FC = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [apiBaseRaw, setApiBaseRaw] = useState(
    (import.meta as any).env?.VITE_API_BASE || 'https://web-production-a27b.up.railway.app'
  );
  const [isMinimized, setIsMinimized] = useState(false);

  // Normalize the URL (remove trailing slashes)
  const apiBase = useMemo(() => normalizeUrl(apiBaseRaw), [apiBaseRaw]);

  const runTests = async () => {
    setIsTesting(true);
    setResults([]);

    const testResults: TestResult[] = [];

    // Test 1: Check environment variables
    testResults.push({
      name: 'Environment Variables',
      status: 'pending',
      message: 'Checking configuration...',
    });
    setResults([...testResults]);

    const viteApiBase = (import.meta as any).env?.VITE_API_BASE;
    const viteGeminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    testResults[0] = {
      name: 'Environment Variables',
      status: 'success',
      message: `VITE_API_BASE: ${viteApiBase || 'Not set (using default)'}\nVITE_GEMINI_API_KEY: ${viteGeminiKey ? 'Set ✓' : 'Not set ⚠️'}`,
      details: { 
        viteApiBase: viteApiBase || apiBaseRaw, 
        viteGeminiKey: viteGeminiKey ? '***hidden***' : null,
        note: viteGeminiKey ? 'Gemini API key is configured' : 'Gemini API key missing - AI features may not work'
      },
    };
    setResults([...testResults]);

    // Test 2: Backend Health Check
    testResults.push({
      name: 'Backend Health Check',
      status: 'pending',
      message: 'Testing backend connection...',
    });
    setResults([...testResults]);

    try {
      const healthUrl = `${apiBase}/health`;
      const { response: healthResponse, responseTime } = await fetchWithTimeout(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        testResults[1] = {
          name: 'Backend Health Check',
          status: 'success',
          message: `✅ Backend is running!\nService: ${healthData.service || 'unknown'}\nVersion: ${healthData.version || 'unknown'}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: healthUrl, status: healthResponse.status, data: healthData },
        };
      } else {
        testResults[1] = {
          name: 'Backend Health Check',
          status: 'error',
          message: `❌ Backend returned error: ${healthResponse.status} ${healthResponse.statusText}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: healthUrl, status: healthResponse.status, responseTime },
        };
      }
    } catch (error: any) {
      const responseTime = error.responseTime || 0;
      const isTimeout = error.error?.name === 'AbortError' || error.error?.message?.includes('timeout') || error.error?.message?.includes('Failed to fetch');
      testResults[1] = {
        name: 'Backend Health Check',
        status: 'error',
        message: isTimeout 
          ? `❌ Backend is not reachable at this URL.\n\nPossible issues:\n1. Backend not deployed on Railway\n2. Wrong Railway URL\n3. Backend service is down\n4. Network/CORS issue\n\nURL tested: ${apiBase}/health\nResponse time: ${responseTime}ms (timeout)`
          : `❌ Failed to connect: ${error.error?.message || error.message || 'Unknown error'}\nResponse time: ${responseTime}ms`,
        responseTime,
        details: { 
          url: `${apiBase}/health`, 
          error: error.error?.message || error.message, 
          type: error.error?.name || error.name,
          responseTime,
          suggestion: 'Verify backend is deployed and running on Railway. Check Railway dashboard → Logs.'
        },
      };
    }
    setResults([...testResults]);

    // Test 3: CORS Test
    testResults.push({
      name: 'CORS Configuration',
      status: 'pending',
      message: 'Testing CORS...',
    });
    setResults([...testResults]);

    try {
      const corsTestUrl = `${apiBase}/health`;
      const { response: corsResponse, responseTime } = await fetchWithTimeout(corsTestUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
        },
      });

      const corsHeaders = {
        'access-control-allow-origin': corsResponse.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': corsResponse.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': corsResponse.headers.get('access-control-allow-headers'),
      };

      if (corsResponse.status === 204 || corsHeaders['access-control-allow-origin']) {
        testResults[2] = {
          name: 'CORS Configuration',
          status: 'success',
          message: `✅ CORS is configured correctly\nAllowed origin: ${corsHeaders['access-control-allow-origin'] || '*'}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: corsHeaders,
        };
      } else {
        testResults[2] = {
          name: 'CORS Configuration',
          status: 'error',
          message: `⚠️ CORS may not be properly configured\nStatus: ${corsResponse.status}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { status: corsResponse.status, headers: corsHeaders },
        };
      }
    } catch (error: any) {
      const responseTime = error.responseTime || 0;
      const isTimeout = error.error?.name === 'AbortError' || error.error?.message?.includes('timeout');
      testResults[2] = {
        name: 'CORS Configuration',
        status: 'error',
        message: isTimeout
          ? `⚠️ Cannot test CORS - backend is not reachable\n\nFix the backend connection first, then CORS can be tested.\nResponse time: ${responseTime}ms (timeout)`
          : `❌ CORS test failed: ${error.error?.message || error.message}\nResponse time: ${responseTime}ms`,
        responseTime,
        details: { 
          error: error.error?.message || error.message,
          responseTime,
          note: 'CORS test requires backend to be reachable first'
        },
      };
    }
    setResults([...testResults]);

    // Test 4: NFT Mint Endpoint (the one that's failing)
    testResults.push({
      name: 'NFT Mint API',
      status: 'pending',
      message: 'Testing NFT mint endpoint...',
    });
    setResults([...testResults]);

    try {
      const mintUrl = `${apiBase}/api/nft/mint`;
      const { response: mintResponse, responseTime } = await fetchWithTimeout(mintUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user-backend-panel',
          prompt: 'Test NFT from BackendTestPanel',
          theme: 'artifact',
          category: 'Environmental',
          priceCredits: 500,
        }),
      }, 30000); // 30 second timeout for minting

      if (mintResponse.ok) {
        const mintData = await mintResponse.json();
        testResults[3] = {
          name: 'NFT Mint API',
          status: 'success',
          message: `✅ NFT mint endpoint is working!\nToken ID: ${mintData.tokenId || 'N/A'}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: mintUrl, status: mintResponse.status, data: mintData },
        };
      } else {
        const errorData = await mintResponse.json().catch(() => ({ 
          error: `HTTP ${mintResponse.status}: ${mintResponse.statusText}` 
        }));
        testResults[3] = {
          name: 'NFT Mint API',
          status: 'error',
          message: `❌ NFT mint endpoint returned error\nStatus: ${mintResponse.status}\nError: ${errorData.error || errorData.message || mintResponse.statusText}\nResponse time: ${responseTime}ms\n\nThis is why minting fails in the app!`,
          responseTime,
          details: { 
            url: mintUrl, 
            status: mintResponse.status, 
            error: errorData,
            suggestion: mintResponse.status === 404 
              ? 'Route not found - check if /api/nft/mint is registered in src/index.ts'
              : mintResponse.status === 402
              ? 'Insufficient credits - this is expected for test user'
              : 'Check Railway logs for detailed error information'
          },
        };
      }
    } catch (error: any) {
      const responseTime = error.responseTime || 0;
      const isTimeout = error.error?.name === 'AbortError' || error.error?.message?.includes('timeout');
      testResults[3] = {
        name: 'NFT Mint API',
        status: 'error',
        message: isTimeout
          ? `❌ NFT mint endpoint not reachable or timed out\n\nThis is why you see "Neural link failed: Not Found"\n\nPossible issues:\n1. Backend not deployed\n2. Route /api/nft/mint not registered\n3. Backend crashed during request\n\nURL tested: ${apiBase}/api/nft/mint\nResponse time: ${responseTime}ms (timeout)`
          : `❌ Request failed: ${error.error?.message || error.message || 'Unknown error'}\nResponse time: ${responseTime}ms`,
        responseTime,
        details: { 
          url: `${apiBase}/api/nft/mint`, 
          error: error.error?.message || error.message, 
          type: error.error?.name || error.name,
          responseTime,
          impact: 'NFT minting will not work until this is fixed'
        },
      };
    }
    setResults([...testResults]);

    // Test 5: NFT Generate Image Endpoint
    testResults.push({
      name: 'NFT Generate Image API',
      status: 'pending',
      message: 'Testing NFT image generation...',
    });
    setResults([...testResults]);

    try {
      const nftUrl = `${apiBase}/api/nft/generate-image`;
      const { response: nftResponse, responseTime } = await fetchWithTimeout(nftUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Test NFT image from BackendTestPanel',
          theme: 'artifact',
        }),
      }, 30000); // 30 second timeout for image generation

      if (nftResponse.ok) {
        const nftData = await nftResponse.json();
        testResults[4] = {
          name: 'NFT Generate Image API',
          status: 'success',
          message: `✅ NFT image generation is working!\nHas image: ${nftData.imageUrl ? 'Yes' : 'No'}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: nftUrl, status: nftResponse.status, hasImage: !!nftData.imageUrl },
        };
      } else {
        const errorData = await nftResponse.json().catch(() => ({ message: `HTTP ${nftResponse.status}` }));
        testResults[4] = {
          name: 'NFT Generate Image API',
          status: 'error',
          message: `❌ API error: ${errorData.message || errorData.error || nftResponse.statusText}\nStatus: ${nftResponse.status}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: nftUrl, status: nftResponse.status, error: errorData },
        };
      }
    } catch (error: any) {
      const responseTime = error.responseTime || 0;
      const isTimeout = error.error?.name === 'AbortError' || error.error?.message?.includes('timeout');
      testResults[4] = {
        name: 'NFT Generate Image API',
        status: 'error',
        message: isTimeout
          ? `❌ Backend API not reachable or timed out\n\nThis is why NFT image generation fails.\nResponse time: ${responseTime}ms (timeout)`
          : `❌ Request failed: ${error.error?.message || error.message}\nResponse time: ${responseTime}ms`,
        responseTime,
        details: { 
          url: `${apiBase}/api/nft/generate-image`, 
          error: error.error?.message || error.message, 
          type: error.error?.name || error.name,
          responseTime,
          impact: 'NFT generation will not work until backend is deployed'
        },
      };
    }
    setResults([...testResults]);

    // Test 6: Store Purchase Item Endpoint
    testResults.push({
      name: 'Store Purchase Item API',
      status: 'pending',
      message: 'Testing store purchase endpoint...',
    });
    setResults([...testResults]);

    try {
      const storeUrl = `${apiBase}/api/store/purchase-item`;
      const { response: storeResponse, responseTime } = await fetchWithTimeout(storeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroId: 'test-user-backend-panel',
          item: {
            sku: 'test-item-001',
            name: 'Test Item',
            description: 'Test item from BackendTestPanel',
            icon: '⚡',
            price: 100,
          },
        }),
      });

      if (storeResponse.ok) {
        const storeData = await storeResponse.json();
        testResults[5] = {
          name: 'Store Purchase Item API',
          status: 'success',
          message: `✅ Store purchase endpoint is working!\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: storeUrl, status: storeResponse.status, data: storeData },
        };
      } else {
        const errorData = await storeResponse.json().catch(() => ({ 
          error: `HTTP ${storeResponse.status}: ${storeResponse.statusText}` 
        }));
        testResults[5] = {
          name: 'Store Purchase Item API',
          status: storeResponse.status === 404 ? 'error' : 'error',
          message: `❌ Store purchase endpoint error\nStatus: ${storeResponse.status}\nError: ${errorData.error || errorData.message || storeResponse.statusText}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { 
            url: storeUrl, 
            status: storeResponse.status, 
            error: errorData,
            suggestion: storeResponse.status === 404 
              ? 'Route not found - check if /api/store/purchase-item is registered in src/index.ts'
              : storeResponse.status === 402
              ? 'Insufficient funds - this is expected for test user'
              : 'Check Railway logs for detailed error information'
          },
        };
      }
    } catch (error: any) {
      const responseTime = error.responseTime || 0;
      const isTimeout = error.error?.name === 'AbortError' || error.error?.message?.includes('timeout');
      testResults[5] = {
        name: 'Store Purchase Item API',
        status: 'error',
        message: isTimeout
          ? `❌ Store purchase endpoint not reachable or timed out\n\nURL tested: ${apiBase}/api/store/purchase-item\nResponse time: ${responseTime}ms (timeout)`
          : `❌ Request failed: ${error.error?.message || error.message}\nResponse time: ${responseTime}ms`,
        responseTime,
        details: { 
          url: `${apiBase}/api/store/purchase-item`, 
          error: error.error?.message || error.message, 
          type: error.error?.name || error.name,
          responseTime
        },
      };
    }
    setResults([...testResults]);

    // Test 7: Store Purchase IAP Endpoint
    testResults.push({
      name: 'Store Purchase IAP API',
      status: 'pending',
      message: 'Testing IAP purchase endpoint...',
    });
    setResults([...testResults]);

    try {
      const iapUrl = `${apiBase}/api/store/purchase-iap`;
      const { response: iapResponse, responseTime } = await fetchWithTimeout(iapUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroId: 'test-user-backend-panel',
          pack: {
            sku: 'test-iap-pack',
            price: 9.99,
            hcAmount: 1000,
          },
        }),
      });

      if (iapResponse.ok) {
        const iapData = await iapResponse.json();
        testResults[6] = {
          name: 'Store Purchase IAP API',
          status: 'success',
          message: `✅ IAP purchase endpoint is working!\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { url: iapUrl, status: iapResponse.status, data: iapData },
        };
      } else {
        const errorData = await iapResponse.json().catch(() => ({ 
          error: `HTTP ${iapResponse.status}: ${iapResponse.statusText}` 
        }));
        testResults[6] = {
          name: 'Store Purchase IAP API',
          status: 'error',
          message: `❌ IAP purchase endpoint error\nStatus: ${iapResponse.status}\nError: ${errorData.error || errorData.message || iapResponse.statusText}\nResponse time: ${responseTime}ms`,
          responseTime,
          details: { 
            url: iapUrl, 
            status: iapResponse.status, 
            error: errorData,
            suggestion: iapResponse.status === 404 
              ? 'Route not found - check if /api/store/purchase-iap is registered in src/index.ts'
              : 'Check Railway logs for detailed error information'
          },
        };
      }
    } catch (error: any) {
      const responseTime = error.responseTime || 0;
      const isTimeout = error.error?.name === 'AbortError' || error.error?.message?.includes('timeout');
      testResults[6] = {
        name: 'Store Purchase IAP API',
        status: 'error',
        message: isTimeout
          ? `❌ IAP purchase endpoint not reachable or timed out\n\nURL tested: ${apiBase}/api/store/purchase-iap\nResponse time: ${responseTime}ms (timeout)`
          : `❌ Request failed: ${error.error?.message || error.message}\nResponse time: ${responseTime}ms`,
        responseTime,
        details: { 
          url: `${apiBase}/api/store/purchase-iap`, 
          error: error.error?.message || error.message, 
          type: error.error?.name || error.name,
          responseTime
        },
      };
    }
    setResults([...testResults]);

    setIsTesting(false);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2"
        >
          <Server className="w-5 h-5" />
          Backend Test
        </button>
      </div>
    );
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalTests = results.length;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black border border-zinc-800 rounded-lg p-6 max-w-4xl w-[90vw] max-h-[90vh] shadow-2xl flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-6 h-6" />
            Backend Connection Test
          </h3>
          {totalTests > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-400">✓ {successCount}</span>
              <span className="text-red-400">✗ {errorCount}</span>
              <span className="text-zinc-400">/ {totalTests}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="text-zinc-400 hover:text-white"
            title="Minimize"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-4 flex-shrink-0">
        <label className="block text-sm text-zinc-400 mb-2 font-medium">Backend URL:</label>
        <input
          type="text"
          value={apiBaseRaw}
          onChange={(e) => setApiBaseRaw(e.target.value)}
          onBlur={(e) => setApiBaseRaw(normalizeUrl(e.target.value))}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://your-backend.railway.app"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Current: {apiBase} {((import.meta as any).env?.VITE_API_BASE ? '(from env)' : '(default)')}
        </p>
      </div>

      <button
        onClick={runTests}
        disabled={isTesting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded flex items-center justify-center gap-2 mb-4 flex-shrink-0 transition-colors"
      >
        {isTesting ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Run All Tests
          </>
        )}
      </button>

      {results.length > 0 && (
        <div className="space-y-3 flex-1 overflow-y-auto pr-2">
          {results.map((result, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${
                result.status === 'success'
                  ? 'border-green-500 bg-green-500/10'
                  : result.status === 'error'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.status === 'pending' && (
                  <Loader className="w-5 h-5 text-zinc-400 animate-spin mt-0.5 flex-shrink-0" />
                )}
                {result.status === 'success' && (
                  <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                )}
                {result.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-white text-base">{result.name}</div>
                    {result.responseTime !== undefined && (
                      <span className="text-xs text-zinc-400">{result.responseTime}ms</span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {result.message}
                  </div>
                  {result.details && (
                    <details className="mt-3" open={result.status === 'error'}>
                      <summary className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-300 font-medium mb-2">
                        ▼ Show Details
                      </summary>
                      <pre className="text-xs text-zinc-300 mt-2 bg-zinc-950 p-3 rounded border border-zinc-800 overflow-x-auto max-w-full break-all">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackendTestPanel;
