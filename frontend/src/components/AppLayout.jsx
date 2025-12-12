import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ResponsiveNavbar from "./ResponsiveNavbar.jsx";
import { apiFetch } from "../api.js";

// 頁面懶加載 - 減少初始 bundle 大小
const HomePage = lazy(() => import("../pages/HomePage.jsx"));
const HistoryPage = lazy(() => import("../pages/HistoryPage.jsx"));
const AccountPage = lazy(() => import("../pages/AccountPage.jsx"));

// 載入中組件
const PageLoadingFallback = () => (
    <div className='flex items-center justify-center min-h-[400px]'>
        <div className='flex items-center gap-3'>
            <div
                className='w-5 h-5 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin'
                role='status'
            />
            <span className='text-neutral-600'>載入中...</span>
        </div>
    </div>
);

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
                <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                        {/* 根路徑自動重定向到 /home */}
                        <Route index element={<Navigate to='home' replace />} />
                        {/* 其他頁面路由 */}
                        <Route path='home' element={<HomePage />} />
                        <Route path='history' element={<HistoryPage />} />
                        <Route path='account' element={<AccountPage userEmail={userEmail} />} />
                        {/* 匹配所有其他未定義的路由，重定向到 home */}
                        <Route path='*' element={<Navigate to='home' replace />} />
                    </Routes>
                </Suspense>
            </div>
        </div>
    );
}

export default AppLayout;
