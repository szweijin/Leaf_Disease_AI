import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for React SPA that talks to the existing Flask backend on :5000.
// Optimized for fast startup and development experience.

export default defineConfig({
    plugins: [
        react(), // React Fast Refresh 已默認啟用
    ],
    server: {
        port: 5173,
        // 優化啟動速度：減少不必要的檢查
        strictPort: false, // 如果端口被佔用，自動使用下一個可用端口
        // 優化 HMR（熱模組替換）
        hmr: {
            overlay: true, // 顯示錯誤覆蓋層
        },
        proxy: {
            // 直接把所有後端路由代理到 Flask
            "/login": "http://localhost:5000",
            "/logout": "http://localhost:5000",
            "/register": "http://localhost:5000",
            "/check-auth": "http://localhost:5000",
            "/predict": "http://localhost:5000",
            "/api": "http://localhost:5000",
            "/history": "http://localhost:5000",
            "/user": "http://localhost:5000",
            "/uploads": "http://localhost:5000", // 代理圖片文件請求
            "/image": "http://localhost:5000", // 代理資料庫圖片請求
        },
    },
    // 優化依賴預構建
    optimizeDeps: {
        // 預構建常用依賴，加快啟動速度
        include: ["react", "react-dom", "react/jsx-runtime"],
        // 排除不需要預構建的依賴
        exclude: [],
    },
    // 優化構建配置
    build: {
        outDir: "dist",
        // 啟用源映射（開發時有用，但會稍微減慢構建）
        sourcemap: false, // 生產環境關閉以加快構建
        // 優化 chunk 大小
        chunkSizeWarningLimit: 1000,
    },
    // SPA 路由支援：所有路由都返回 index.html
    // 這確保刷新頁面時不會出現 404
    // Vite 開發服務器已自動處理，生產環境需要配置服務器
    // 優化 CSS 處理
    css: {
        devSourcemap: false, // 開發時關閉 CSS 源映射以加快速度
    },
});
