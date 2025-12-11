import React from "react";
import { Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage.jsx";
import HistoryPage from "../pages/HistoryPage.jsx";
import AccountPage from "../pages/AccountPage.jsx";
import ResponsiveNavbar from "./ResponsiveNavbar.jsx";
import { apiFetch } from "../api.js";

/**
 * 已登入後的整體框架
 * 使用響應式導覽列：
 * - 手機版：底部固定導覽列
 * - 桌面版：頂部導覽列
 *
 * 三個主要頁面路由：
 * - /home: 檢測功能及單次檢測結果顯示
 * - /history: 檢測歷史記錄
 * - /account: 帳號設定相關
 */
function AppLayout({ userEmail, onLogout }) {
    const handleLogout = async () => {
        const res = await apiFetch("/logout");
        if (res.ok) {
            onLogout();
        }
    };

    return (
        <div className='app-container'>
            <ResponsiveNavbar userEmail={userEmail} onLogout={handleLogout} />

            <div className='app-main'>
                <Routes>
                    <Route path='/home' element={<HomePage />} />
                    <Route path='/history' element={<HistoryPage />} />
                    <Route path='/account' element={<AccountPage userEmail={userEmail} />} />
                    {/* 預設重定向到 home */}
                    <Route path='/' element={<HomePage />} />
                </Routes>
            </div>
        </div>
    );
}

export default AppLayout;
