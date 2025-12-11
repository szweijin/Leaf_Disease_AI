import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { apiFetch } from "./api.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AppLayout from "./components/AppLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";

// App 負責：
// 1. 管理認證狀態
// 2. 設置路由
// 3. 提供認證狀態給子組件

function App() {
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            const timeoutId = setTimeout(() => {
                setUserEmail(null);
                setLoading(false);
            }, 3000);

            try {
                const res = await apiFetch("/check-auth");
                clearTimeout(timeoutId);

                if (!res.ok) {
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
                clearTimeout(timeoutId);
                setUserEmail(null);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const handleLoggedIn = (email) => {
        setUserEmail(email);
    };

    const handleLoggedOut = () => {
        setUserEmail(null);
    };

    if (loading) {
        return (
            <div className='full-screen-center text-white'>
                <div className='flex items-center gap-3'>
                    <div
                        className='w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin'
                        role='status'
                    />
                    <span>載入中...</span>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* 登入頁面 */}
                <Route
                    path='/login'
                    element={<LoginPage isAuthenticated={!!userEmail} onLoggedIn={handleLoggedIn} />}
                />

                {/* 受保護的路由 */}
                <Route
                    path='/*'
                    element={
                        <ProtectedRoute isAuthenticated={!!userEmail}>
                            <AppLayout userEmail={userEmail} onLogout={handleLoggedOut} />
                        </ProtectedRoute>
                    }
                />

                {/* 預設重定向 */}
                <Route path='/' element={<Navigate to={userEmail ? "/home" : "/login"} replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
