import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import "./styles.css";

// 優化：直接渲染，減少不必要的檢查
const rootElement = document.getElementById("root");

if (rootElement) {
    ReactDOM.createRoot(rootElement).render(<App />);
} else {
    // 如果 root 元素不存在，創建它
    const newRoot = document.createElement("div");
    newRoot.id = "root";
    document.body.appendChild(newRoot);
    ReactDOM.createRoot(newRoot).render(<App />);
}
