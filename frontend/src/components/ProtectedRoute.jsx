import React from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * 路由守衛組件 - 保護需要登入的路由
 * 如果用戶未登入，重定向到登入頁面
 */
function ProtectedRoute({ children, isAuthenticated }) {
    const location = useLocation();

    // 如果未認證，重定向到登入頁面
    if (!isAuthenticated) {
        // 避免重定向到 /login 時再次觸發 ProtectedRoute
        if (location.pathname !== "/login") {
            return <Navigate to='/login' state={{ from: location }} replace />;
        }
        return null;
    }

    return children;
}

export default ProtectedRoute;
