/**
 * API utility function for making requests to the backend
 * Handles base URL, credentials, and common headers
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface FetchOptions extends RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    signal?: AbortSignal;
}

/**
 * Makes a fetch request to the API with proper configuration
 * @param url - API endpoint path (e.g., "/history", "/user/profile")
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Promise<Response>
 */
export async function apiFetch(url: string, options: FetchOptions = {}): Promise<Response> {
    // Ensure URL starts with /
    const path = url.startsWith("/") ? url : `/${url}`;
    const fullUrl = `${API_BASE_URL}${path}`;

    // Merge default headers with provided headers
    const headers = new Headers(options.headers);

    // Set default Content-Type for JSON if body is provided and not already set
    if (options.body && !headers.has("Content-Type")) {
        // Check if body is already a string (JSON.stringify was called)
        if (typeof options.body === "string") {
            headers.set("Content-Type", "application/json");
        }
    }

    // Make the fetch request with credentials to include cookies
    const response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: "include", // Include cookies for authentication
    });

    return response;
}
