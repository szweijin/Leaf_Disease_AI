import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite config for React SPA that talks to the existing Flask backend on :5000.
// Optimized for fast startup, development experience, and production builds.

export default defineConfig({
    plugins: [
        react({
            // React Fast Refresh 已默認啟用，無需額外配置
            // 生產環境優化（移除 console）
            // 注意：esbuild 會自動處理 console 移除，這裡保留作為備選
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        // 優化啟動速度：減少不必要的檢查
        strictPort: true, // 嚴格使用指定端口，避免端口衝突
        host: true, // 允許外部訪問
        // 優化 HMR（熱模組替換）
        hmr: {
            overlay: true, // 顯示錯誤覆蓋層
            protocol: "ws", // WebSocket 協議
            host: "localhost", // HMR 主機
            clientPort: 5173, // HMR 客戶端端口
            // 優化連接穩定性
            timeout: 30000, // 連接超時時間（30秒）
            // 注意：Vite 的 HMR 會自動處理重連，無需手動配置 reconnect
        },
        // 防止請求過期錯誤
        watch: {
            usePolling: false, // 在 macOS/Linux 上通常不需要輪詢
            interval: 100, // 輪詢間隔（如果啟用）
            // 優化文件監聽
            ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
        },
        // 優化請求處理
        middlewareMode: false,
        // 防止請求過期
        headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
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
        include: [
            "react",
            "react-dom",
            "react/jsx-runtime",
            "react-router-dom",
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-label",
        ],
        // 排除不需要預構建的依賴
        exclude: [],
        // 強制預構建（提升首次載入速度）
        force: false,
    },
    // 優化構建配置
    build: {
        outDir: "dist",
        // 啟用源映射（開發時有用，但會稍微減慢構建）
        sourcemap: false, // 生產環境關閉以加快構建
        // 優化 chunk 大小
        chunkSizeWarningLimit: 1000,
        // 代碼分割優化
        rollupOptions: {
            output: {
                // 手動分割代碼塊
                manualChunks: {
                    // React 核心庫
                    "react-vendor": ["react", "react-dom", "react/jsx-runtime"],
                    // React Router
                    "router-vendor": ["react-router-dom"],
                    // Radix UI 組件（shadcn/ui 依賴）
                    "radix-vendor": [
                        "@radix-ui/react-dialog",
                        "@radix-ui/react-select",
                        "@radix-ui/react-label",
                        "@radix-ui/react-separator",
                        "@radix-ui/react-slot",
                    ],
                    // 工具庫
                    "utils-vendor": ["clsx", "tailwind-merge", "class-variance-authority"],
                    // 圖標庫
                    "icons-vendor": ["lucide-react"],
                    // 圖片處理
                    "image-vendor": ["react-image-crop"],
                },
                // 優化文件命名
                chunkFileNames: "assets/js/[name]-[hash].js",
                entryFileNames: "assets/js/[name]-[hash].js",
                assetFileNames: (assetInfo: { name?: string }) => {
                    if (!assetInfo.name) {
                        return `assets/[name]-[hash][extname]`;
                    }
                    const info = assetInfo.name.split(".");
                    const ext = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
                        return `assets/images/[name]-[hash][extname]`;
                    }
                    if (/woff2?|eot|ttf|otf/i.test(ext)) {
                        return `assets/fonts/[name]-[hash][extname]`;
                    }
                    return `assets/[ext]/[name]-[hash][extname]`;
                },
            },
        },
        // 壓縮配置（使用 esbuild，更快）
        minify: "esbuild", // esbuild 比 terser 更快
        // 如果需要更激進的壓縮，可以使用 terser，但會更慢
        // minify: "terser",
        // terserOptions: {
        //     compress: {
        //         drop_console: true,
        //         drop_debugger: true,
        //     },
        // },
        // 啟用 CSS 代碼分割
        cssCodeSplit: true,
        // 優化構建性能
        target: "es2015",
        // 減少內聯資源大小限制（提升載入速度）
        assetsInlineLimit: 4096, // 4KB 以下的資源內聯
    },
    // SPA 路由支援：所有路由都返回 index.html
    // 這確保刷新頁面時不會出現 404
    // Vite 開發服務器已自動處理，生產環境需要配置服務器
    // 優化 CSS 處理
    css: {
        devSourcemap: false, // 開發時關閉 CSS 源映射以加快速度
        // PostCSS 配置：Vite 會自動讀取 postcss.config.js
        // 不需要在這裡明確設置，讓 Vite 自動使用配置文件
    },
    // 優化預加載
    experimental: {
        renderBuiltUrl(filename: string, { hostType }: { hostType: string }) {
            if (hostType === "js") {
                return { js: `/${filename}` };
            } else {
                return { relative: true };
            }
        },
    },
});
