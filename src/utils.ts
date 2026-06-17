export function buildUrl(baseURL: string, url: string, params?: Record<string, any>): string {
  let combinedUrl = url;
  
  if (baseURL && !/^https?:\/\//i.test(url)) {
    const cleanBase = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    combinedUrl = `${cleanBase}${cleanUrl}`;
  }

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((val) => {
            if (val !== undefined && val !== null) {
              searchParams.append(key, String(val));
            }
          });
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      const separator = combinedUrl.includes("?") ? "&" : "?";
      combinedUrl = `${combinedUrl}${separator}${queryString}`;
    }
  }

  return combinedUrl;
}

export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback
    }
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export function getCookie(name: string, cookieHeader?: string): string | null {
  const cookieStr = cookieHeader !== undefined 
    ? cookieHeader 
    : (typeof document !== "undefined" ? document.cookie : "");
  
  if (!cookieStr) return null;
  
  const cookies = cookieStr.split(";");
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const cookieName = trimmed.slice(0, eqIdx);
    const cookieValue = trimmed.slice(eqIdx + 1);
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

export async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  const contentLength = response.headers.get("content-length");
  
  if (contentLength === "0" || response.status === 204) {
    return null;
  }
  
  if (contentType.includes("application/json")) {
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  }
  
  if (
    contentType.includes("text/") || 
    contentType.includes("application/xml") || 
    contentType.includes("image/svg")
  ) {
    return response.text();
  }
  
  if (
    contentType.includes("multipart/form-data") || 
    contentType.includes("application/octet-stream")
  ) {
    return response.blob();
  }
  
  // Fallback
  try {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

export function parseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}
