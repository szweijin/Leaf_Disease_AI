import React, { useEffect, useState, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { apiFetch } from "./api.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

// 路由懶加載 - 減少初始 bundle 大小
const AppLayout = lazy(() => import("./components/AppLayout.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));

// 載入中組件
const LoadingFallback = () => (
    <div className='min-h-screen flex items-center justify-center bg-neutral-50'>
        <div className='flex items-center gap-3'>
            <div
                className='w-6 h-6 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin'
                role='status'
            />
            <span className='text-neutral-900'>載入中...</span>
        </div>
    </div>
);

// App 負責：
// 1. 管理認證狀態
// 2. 設置路由
// 3. 提供認證狀態給子組件

function App() {
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState(null);

    useEffect(() => {
        let isMounted = true; // 防止組件卸載後更新狀態

        // 備用超時機制：確保即使所有檢查都失敗，也在 3 秒後顯示頁面
        let loadingCompleted = false;
        const fallbackTimeout = setTimeout(() => {
            if (isMounted && !loadingCompleted) {
                console.warn("認證檢查超時（後端可能未啟動），顯示登入頁面");
                setUserEmail(null);
                setLoading(false);
            }
        }, 3000);

        const checkAuth = async () => {
            try {
                // 使用較短的超時時間以加快初始載入
                const res = await apiFetch("/check-auth", { timeout: 2000 });

                if (!isMounted) return; // 組件已卸載，不更新狀態

                clearTimeout(fallbackTimeout); // 清除備用超時
                loadingCompleted = true;

                if (!res.ok) {
                    // 如果響應不成功，視為未登入
                    setUserEmail(null);
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                if (data.authenticated) {
                    setUserEmail(data.email);
                } else {
                    setUserEmail(null);
                }
            } catch (e) {
                // 網絡錯誤或超時，視為未登入，但繼續顯示頁面
                console.warn("認證檢查失敗（後端可能未啟動）:", e.message || e);
                clearTimeout(fallbackTimeout); // 清除備用超時
                loadingCompleted = true;
                if (isMounted) {
                    setUserEmail(null);
                    setLoading(false); // 確保設置 loading 為 false
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };
        checkAuth();

        // 清理函數
        return () => {
            isMounted = false;
            clearTimeout(fallbackTimeout);
        };
    }, []);

    const handleLoggedIn = (email) => {
        setUserEmail(email);
    };

    const handleLoggedOut = () => {
        setUserEmail(null);
    };

    if (loading) {
        return (
            <div className='min-h-screen flex items-center justify-center bg-neutral-50'>
                <div className='flex items-center gap-3'>
                    <div
                        className='w-6 h-6 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin'
                        role='status'
                    />
                    <span className='text-neutral-900'>載入中...</span>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
                <Routes>
                    {/* 登入頁面 */}
                    <Route
                        path='/login'
                        element={<LoginPage isAuthenticated={!!userEmail} onLoggedIn={handleLoggedIn} />}
                    />

                    {/* 受保護的路由 - 匹配所有其他路徑 */}
                    <Route
                        path='/*'
                        element={
                            <ProtectedRoute isAuthenticated={!!userEmail}>
                                <AppLayout userEmail={userEmail} onLogout={handleLoggedOut} />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}

export default App;
