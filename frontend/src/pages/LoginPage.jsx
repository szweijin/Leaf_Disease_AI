import React from "react";
import { Navigate } from "react-router-dom";
import AuthView from "../components/AuthView.jsx";

/**
 * 登入頁面
 * 如果已登入，重定向到首頁
 */
function LoginPage({ isAuthenticated, onLoggedIn }) {
    if (isAuthenticated) {
        return <Navigate to='/home' replace />;
    }
    return <AuthView onLoggedIn={onLoggedIn} />;
}

export default LoginPage;
