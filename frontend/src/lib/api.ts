/**
 * API 調用封裝
 * 提供統一的 API 調用接口，處理認證、錯誤處理等
 */

const API_BASE_URL = ""; // 使用相對路徑，由 Vite proxy 處理

/**
 * 構建完整的 API URL
 */
export function apiUrl(path: string): string {
    // 移除開頭的斜線（如果有的話）
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${API_BASE_URL}/${cleanPath}`;
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

    // 如果已經有 signal，使用它；否則設置默認超時（3秒）
    if (!finalOptions.signal) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, 3000); // 默認 3 秒超時
        finalOptions.signal = controller.signal;

        try {
            const response = await fetch(url, finalOptions);
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error("請求超時");
            }
            throw error;
        }
    }

    return fetch(url, finalOptions);
}
