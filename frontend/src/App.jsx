import React, { useEffect, useState } from "react";
import AuthView from "./components/AuthView.jsx";
import AppLayout from "./components/AppLayout.jsx";
import { apiFetch } from "./api.js";

// App 負責：
// 1. 啟動時檢查登入狀態（/check-auth）
// 2. 在登入/登出之間切換 AuthView 與 AppLayout

function App() {
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await apiFetch("/check-auth");
                const data = await res.json();
                if (res.ok && data.authenticated) {
                    setUserEmail(data.email);
                } else {
                    setUserEmail(null);
                }
            } catch (e) {
                console.error(e);
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
                <div className='spinner-border text-light me-2' role='status' />
                <span>載入中...</span>
            </div>
        );
    }

    if (!userEmail) {
        return <AuthView onLoggedIn={handleLoggedIn} />;
    }

    return <AppLayout userEmail={userEmail} onLogout={handleLoggedOut} />;
}

export default App;
