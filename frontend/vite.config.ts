import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react({
            // 禁用 React Fast Refresh 的某些檢查以加快啟動
            babel: {
                plugins: [],
            },
        }),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    optimizeDeps: {
        include: ["react", "react-dom", "react-router-dom", "framer-motion", "lucide-react", "sonner"],
        exclude: [],
    },
    esbuild: {
        // 加快編譯速度
        logOverride: { "this-is-undefined-in-esm": "silent" },
    },
    server: {
        // 加快啟動速度
        hmr: {
            overlay: false, // 禁用錯誤覆蓋層以加快啟動
        },
        proxy: {
            // 代理所有 API 請求到後端
            "/api": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            // /login 和 /register 只代理 POST 請求（用於 API 調用）
            // GET 請求返回 index.html，由前端路由處理
            "/login": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
                bypass: (req) => {
                    // 如果是 GET 請求，返回 index.html（由前端路由處理）
                    if (req.method === "GET") {
                        return "/index.html";
                    }
                },
            },
            "/register": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
                bypass: (req) => {
                    // 如果是 GET 請求，返回 index.html（由前端路由處理）
                    if (req.method === "GET") {
                        return "/index.html";
                    }
                },
            },
            "/logout": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            "/check-auth": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            "/user": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            "/history": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            "/predict": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            "/image": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
            "/static": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});
