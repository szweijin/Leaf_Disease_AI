import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import Loading from "./Loading";

interface ProtectedRouteProps {
    isAuthenticated: boolean;
    checkingAuth: boolean;
    children?: React.ReactNode;
}

function ProtectedRoute({ isAuthenticated, checkingAuth, children }: ProtectedRouteProps) {
    const [shouldRedirect, setShouldRedirect] = useState(false);

    // 未登入時，延遲後重定向到登入頁
    useEffect(() => {
        if (!isAuthenticated && !checkingAuth) {
            // 顯示 Loading 訊息 1.5 秒後再重定向
            const timer = setTimeout(() => {
                setShouldRedirect(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, checkingAuth]);

    // 正在檢查認證狀態時顯示 Loading
    if (checkingAuth) {
        return <Loading message='檢查認證狀態...' />;
    }

    if (!isAuthenticated) {
        if (shouldRedirect) {
            return <Navigate to='/login' replace />;
        }
        return <Loading message='未登入，即將跳轉到登入頁...' />;
    }

    // 已登入，如果有 children 則渲染 children，否則使用 Outlet 渲染嵌套路由
    return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;
