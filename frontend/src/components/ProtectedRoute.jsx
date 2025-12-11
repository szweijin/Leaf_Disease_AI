import React from "react";
import { Navigate } from "react-router-dom";

/**
 * 路由守衛組件 - 保護需要登入的路由
 * 如果用戶未登入，重定向到登入頁面
 */
function ProtectedRoute({ children, isAuthenticated }) {
    if (!isAuthenticated) {
        return <Navigate to='/login' replace />;
    }
    return children;
}

export default ProtectedRoute;
