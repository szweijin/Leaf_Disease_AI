// 統一處理後端 API 呼叫
// 本地開發：Vite proxy，VITE_API_BASE_URL 可以留空
// 雲端部署：在 Render 的 build 環境或 .env.production 設定 VITE_API_BASE_URL

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export function apiUrl(path) {
    // 如果是完整的 URL（http:// 或 https://），直接返回（例如 Cloudinary URL）
    if (path && (path.startsWith("http://") || path.startsWith("https://"))) {
        return path;
    }
    // 處理相對路徑
    if (!path.startsWith("/")) {
        path = `/${path}`;
    }
    return `${API_BASE}${path}`;
}

export async function apiFetch(path, options = {}) {
    // 添加超時機制，防止請求一直掛起
    const timeout = options.timeout || 5000; // 默認 5 秒超時
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(apiUrl(path), {
            // 後端使用 Flask Session，建議攜帶 cookie
            credentials: "include",
            signal: controller.signal,
            ...options,
        });
        clearTimeout(timeoutId);
        return res;
    } catch (error) {
        clearTimeout(timeoutId);
        // 如果是超時錯誤，拋出更友好的錯誤訊息
        if (error.name === "AbortError") {
            throw new Error(`請求超時（${timeout}ms）`);
        }
        throw error;
    }
}
