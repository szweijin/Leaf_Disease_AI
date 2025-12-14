// frontend/src/App.tsx
import { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Loading from "./components/Loading.tsx";
import { apiFetch } from "./lib/api";

// 引入佈局組件（不需要 lazy，因為它總是需要的）
import AppLayout from "./components/AppLayout.tsx";

// 懶加載頁面組件，實現路由跳轉時的 loading
const LoginPage = lazy(() => import("./pages/LoginPage.tsx"));
const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const PredictPage = lazy(() => import("./pages/PredictPage.tsx"));
const HistoryPage = lazy(() => import("./pages/HistoryPage.tsx"));
const AccountPage = lazy(() => import("./pages/AccountPage.tsx"));

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userEmail, setUserEmail] = useState("");
    const [checkingAuth, setCheckingAuth] = useState(false);
    const hasCheckedAuth = useRef(false);

    // 檢查認證狀態
    useEffect(() => {
        if (hasCheckedAuth.current) return;
        hasCheckedAuth.current = true;

        const checkAuth = async () => {
            setCheckingAuth(true);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                }, 2000);

                const res = await apiFetch("/check-auth", {
                    method: "GET",
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated === true) {
                        setIsAuthenticated(true);
                        setUserEmail(data.email || "");
                    } else {
                        setIsAuthenticated(false);
                        setUserEmail("");
                    }
                } else {
                    setIsAuthenticated(false);
                    setUserEmail("");
                }
            } catch (err) {
                setIsAuthenticated(false);
                setUserEmail("");
            } finally {
                setCheckingAuth(false);
            }
        };

        const timer = setTimeout(() => {
            checkAuth();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    const handleLoggedIn = (email: string) => {
        setIsAuthenticated(true);
        setUserEmail(email);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setUserEmail("");
    };

    // 只在認證檢查中且未登入時顯示載入頁面
    if (checkingAuth && !isAuthenticated) {
        return <Loading message='檢查認證狀態...' />;
    }

    return (
        <>
            <Toaster position='top-center' />
            <Suspense fallback={<Loading message='載入頁面中...' />}>
                <Routes>
                    {/* /login 頁面：獨立佈局 */}
                    <Route
                        path='/login'
                        element={<LoginPage isAuthenticated={isAuthenticated} onLoggedIn={handleLoggedIn} />}
                    />

                    {/* 根目錄 / ：導向 /home 或 /login */}
                    <Route path='/' element={<Navigate to={isAuthenticated ? "/home" : "/login"} replace />} />

                    {/* 需要應用程式佈局的頁面 */}
                    <Route element={<AppLayout userEmail={userEmail} onLogout={handleLogout} />}>
                        <Route path='/home' element={<HomePage />} />
                        <Route path='/predict' element={<PredictPage />} />
                        <Route path='/history' element={<HistoryPage />} />
                        <Route path='/account' element={<AccountPage />} />
                    </Route>

                    {/* 404 頁面 */}
                    <Route
                        path='*'
                        element={
                            <div className='p-8 text-center text-red-500'>
                                <h1 className='text-4xl font-bold'>404</h1>
                                <p>找不到頁面</p>
                            </div>
                        }
                    />
                </Routes>
            </Suspense>
        </>
    );
}

export default App;
