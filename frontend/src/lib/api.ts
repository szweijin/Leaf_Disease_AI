/**
 * API 調用封裝
 * 提供統一的 API 調用接口，處理認證、錯誤處理等
 */

const API_BASE_URL = ""; // 使用相對路徑，由 Vite proxy 處理

// 認證相關的路徑，不需要在 401 時重定向（避免循環）
// 這些路徑允許未登入用戶訪問，所以即使返回 401 也不應該重定向
const AUTH_PATHS = ["/login", "/register", "/check-auth"];

/**
 * 構建完整的 API URL
 */
export function apiUrl(path: string): string {
    // 移除開頭的斜線（如果有的話）
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${API_BASE_URL}/${cleanPath}`;
}

/**
 * 處理 401 未授權錯誤，重定向到登入頁
 */
function handleUnauthorized(path: string) {
    // 如果是認證相關的路徑，不重定向（避免循環）
    // 這些路徑允許未登入用戶訪問，所以即使返回 401 也不應該重定向
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (AUTH_PATHS.some((authPath) => normalizedPath === authPath || normalizedPath.startsWith(authPath + "/"))) {
        return;
    }

    // 如果當前已經在登入頁面，不重定向（避免循環）
    // 這確保了 /login 端點可以正常訪問，即使 API 返回 401
    if (typeof window !== "undefined" && window.location.pathname === "/login") {
        return;
    }

    // 重定向到登入頁（延遲 1.5 秒，讓用戶有時間看到錯誤訊息）
    if (typeof window !== "undefined") {
        setTimeout(() => {
            window.location.href = "/login";
        }, 1500);
    }
}

/**
 * 根據 API 路徑獲取適當的超時時間（毫秒）
 * @param path - API 路徑
 * @returns 超時時間（毫秒）
 */
function getTimeoutForPath(path: string): number {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // 預測相關的 API 需要更長的處理時間（圖像檢測可能需要 10-30 秒）
    if (normalizedPath.startsWith("/api/predict")) {
        return 120000; // 120 秒（2 分鐘）
    }

    // 其他 API 使用較短的超時時間
    return 10000; // 10 秒（從 3 秒增加到 10 秒，提供更好的容錯性）
}

/**
 * 統一的 API 調用函數
 * @param path - API 路徑
 * @param options - fetch 選項
 * @returns Promise<Response>
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = apiUrl(path);
    const defaultOptions: RequestInit = {
        credentials: "include", // 包含 cookies（用於 session）
        headers: {
            "Content-Type": "application/json",
        },
    };

    // 合併選項
    const finalOptions: RequestInit = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {}),
        },
    };

    // 如果已經有 signal，使用它；否則根據路徑設置適當的超時時間
    if (!finalOptions.signal) {
        const controller = new AbortController();
        const timeout = getTimeoutForPath(path);
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);
        finalOptions.signal = controller.signal;

        try {
            const response = await fetch(url, finalOptions);
            clearTimeout(timeoutId);

            // 處理 401 未授權錯誤
            if (response.status === 401) {
                handleUnauthorized(path);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error("請求超時");
            }
            throw error;
        }
    }

    const response = await fetch(url, finalOptions);

    // 處理 401 未授權錯誤
    if (response.status === 401) {
        handleUnauthorized(path);
    }

    return response;
}
