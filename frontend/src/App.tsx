// frontend/src/App.tsx (修改後的完整程式碼)
import { Routes, Route, Navigate } from "react-router-dom"; // 引入必要的組件

// 引入佈局和頁面組件
import AppLayout from "./components/AppLayout.tsx"; // 佈局組件
import LoginPage from "./pages/LoginPage.tsx";
import HomePage from "./pages/HomePage.tsx";
import PredictPage from "./pages/PredictPage.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";

function App() {
    return (
        <Routes>
            {/* 1. /login 頁面：獨立佈局 (通常是全螢幕，沒有主導航) */}
            <Route path='/login' element={<LoginPage />} />

            {/* 2. 根目錄 / ：導向 /home (通常是已登入後) */}
            {/* 根路徑 / 我們將其重定向到 /home */}
            <Route path='/' element={<Navigate to='/home' replace />} />

            {/* 3. 需要應用程式佈局 (有導航列) 的頁面，使用巢狀路由 */}
            {/* AppLayout 負責顯示公共元素，子路由會在 AppLayout 內的 <Outlet /> 中呈現 */}
            <Route element={<AppLayout />}>
                {/* /home (已由上面的 / 重定向處理，但明確定義更好) */}
                <Route path='/home' element={<HomePage />} />
                {/* /predict */}
                <Route path='/predict' element={<PredictPage />} />
                {/* /history */}
                <Route path='/history' element={<HistoryPage />} />
                {/* /account */}
                <Route path='/account' element={<AccountPage />} />
            </Route>

            {/* 4. 404 頁面 (任何不匹配的路徑) */}
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
    );
}

export default App;
