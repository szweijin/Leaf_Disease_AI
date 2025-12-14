import { Navigate } from "react-router-dom";
import Loading from "./Loading";

interface ProtectedRouteProps {
    isAuthenticated: boolean;
    checkingAuth: boolean;
    children: React.ReactNode;
}

function ProtectedRoute({ isAuthenticated, checkingAuth, children }: ProtectedRouteProps) {
    // 正在檢查認證狀態時顯示 Loading
    if (checkingAuth) {
        return <Loading message='檢查認證狀態...' />;
    }

    // 未登入時重定向到登入頁
    if (!isAuthenticated) {
        return <Navigate to='/login' replace />;
    }

    // 已登入，顯示子組件
    return <>{children}</>;
}

export default ProtectedRoute;
