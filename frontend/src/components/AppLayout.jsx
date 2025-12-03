import React, { useState } from "react";
import DetectionPage from "./DetectionPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import { apiFetch } from "../api.js";

// 已登入後的整體框架：上方 navbar + 兩個主分頁

function AppLayout({ userEmail, onLogout }) {
  const [page, setPage] = useState("detect"); // 'detect' | 'profile'

  const handleLogout = async () => {
    const res = await apiFetch("/logout");
    if (res.ok) {
      onLogout();
    }
  };

  return (
    <div className="app-container show">
      <div className="app-navbar">
        <div className="navbar-content container">
          <div className="brand">
            <span>🌿</span>
            <span>Leaf Disease AI (React)</span>
          </div>
          <div className="user-info">
            <span>{userEmail}</span>
            <button
              className="btn-logout"
              type="button"
              onClick={() => setPage("detect")}
            >
              檢測
            </button>
            <button
              className="btn-logout"
              type="button"
              onClick={() => setPage("profile")}
            >
              帳號設定
            </button>
            <button className="btn-logout" type="button" onClick={handleLogout}>
              登出
            </button>
          </div>
        </div>
      </div>

      <div className="app-main">
        {page === "detect" ? (
          <DetectionPage />
        ) : (
          <ProfilePage userEmail={userEmail} />
        )}
      </div>
    </div>
  );
}

export default AppLayout;


