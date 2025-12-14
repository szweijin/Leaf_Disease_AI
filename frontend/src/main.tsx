// frontend/src/main.tsx (修改後的完整程式碼)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // <-- 1. 引入 BrowserRouter
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            {" "}
            {/* <-- 2. 包裹 App 組件 */}
            <App />
        </BrowserRouter>
    </StrictMode>
);
