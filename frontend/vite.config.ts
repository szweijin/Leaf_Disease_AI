import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
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
