import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthView from "../components/AuthView.jsx";

/**
 * 登入頁面
 * 如果已登入，重定向到首頁
 */
function LoginPage({ isAuthenticated, onLoggedIn }) {
    const navigate = useNavigate();

    // 如果已登入，重定向到首頁（只執行一次）
    useEffect(() => {
        if (isAuthenticated) {
            // 使用 setTimeout 確保狀態已更新
            const timer = setTimeout(() => {
                navigate("/home", { replace: true });
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, navigate]);

    // 如果已登入，顯示重定向訊息（避免空白頁）
    if (isAuthenticated) {
        return (
            <div className='min-h-screen flex items-center justify-center bg-neutral-50'>
                <div className='flex items-center gap-3'>
                    <div
                        className='w-6 h-6 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin'
                        role='status'
                    />
                    <span className='text-neutral-900'>正在跳轉...</span>
                </div>
            </div>
        );
    }

    return <AuthView onLoggedIn={onLoggedIn} />;
}

export default LoginPage;
