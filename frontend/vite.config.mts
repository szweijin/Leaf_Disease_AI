import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for React SPA that talks to the existing Flask backend on :5000.
// We proxy API requests during development so不需要處理 CORS。

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
      "/uploads": "http://localhost:5000",  // 代理圖片文件請求
      "/image": "http://localhost:5000"     // 代理資料庫圖片請求
    }
  },
  build: {
    outDir: "dist"
  }
});


