// frontend/src/App.tsx
import { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Loading from "./components/Loading.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import { apiFetch } from "./lib/api";
import { useIsMobile } from "@/hooks/use-mobile";

// 引入佈局組件（不需要 lazy，因為它總是需要的）
import AppLayout from "./components/AppLayout.tsx";

// 懶加載頁面組件，實現路由跳轉時的 loading
const LoginPage = lazy(() => import("./pages/LoginPage.tsx"));
const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const PredictPage = lazy(() => import("./pages/PredictPage.tsx"));
const HistoryPage = lazy(() => import("./pages/HistoryPage.tsx"));
const AccountPage = lazy(() => import("./pages/AccountPage.tsx"));

// 根目錄重定向組件：桌面版跳轉到 /home，手機版跳轉到 /login
function RootRedirect() {
    const isMobile = useIsMobile();

    // 桌面版跳轉到 /home，手機版跳轉到 /login
    return <Navigate to={isMobile ? "/login" : "/home"} replace />;
}

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
                console.error("Error checking authentication:", err);
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

    return (
        <>
            <Toaster position='top-center' />
            <Suspense fallback={<Loading message='載入頁面中...' />}>
                <Routes>
                    {/* /login 頁面：獨立佈局 */}
                    <Route
                        path='/login'
                        element={
                            <Suspense fallback={<Loading message='載入登入頁面中...' />}>
                                <LoginPage isAuthenticated={isAuthenticated} onLoggedIn={handleLoggedIn} />
                            </Suspense>
                        }
                    />

                    {/* 根目錄 / ：桌面版跳轉到 /home，手機版跳轉到 /login */}
                    <Route path='/' element={checkingAuth ? <Loading message='檢查認證狀態...' /> : <RootRedirect />} />

                    {/* /home 頁面：公開頁面（歡迎頁面，只在桌面版顯示） */}
                    <Route
                        path='/home'
                        element={
                            <Suspense fallback={<Loading message='載入首頁中...' />}>
                                <HomePage isAuthenticated={isAuthenticated} />
                            </Suspense>
                        }
                    />

                    {/* 需要應用程式佈局的頁面 - 使用 ProtectedRoute 保護 */}
                    <Route
                        element={
                            <ProtectedRoute isAuthenticated={isAuthenticated} checkingAuth={checkingAuth}>
                                <AppLayout userEmail={userEmail} onLogout={handleLogout} />
                            </ProtectedRoute>
                        }
                    >
                        <Route
                            path='/predict'
                            element={
                                <Suspense fallback={<Loading message='載入診斷頁面中...' />}>
                                    <PredictPage />
                                </Suspense>
                            }
                        />
                        <Route
                            path='/history'
                            element={
                                <Suspense fallback={<Loading message='載入歷史記錄中...' />}>
                                    <HistoryPage />
                                </Suspense>
                            }
                        />
                        <Route
                            path='/account'
                            element={
                                <Suspense fallback={<Loading message='載入帳號設定中...' />}>
                                    <AccountPage onLogout={handleLogout} />
                                </Suspense>
                            }
                        />
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
