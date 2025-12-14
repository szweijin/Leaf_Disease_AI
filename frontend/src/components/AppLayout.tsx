// frontend/src/components/AppLayout.tsx (新增)
import { Outlet, Link } from "react-router-dom";
import Navigation from "./Navigation";
import { Separator } from "@/components/ui/separator"; // 假設您已經有 Separator

const AppLayout = () => {
    return (
        <div className='min-h-screen flex flex-col'>
            {/* 頂部導航欄/Header */}
            <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
                <div className='container flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8'>
                    <Link to='/home' className='text-xl font-bold tracking-tight'>
                        葉病 AI 診斷系統
                    </Link>
                    <Navigation />
                </div>
                <Separator />
            </header>

            {/* 頁面主要內容區域：Outlet 將渲染當前匹配的子路由組件 */}
            <main className='flex-grow p-4 md:p-8'>
                <Outlet />
            </main>

            {/* 底部 Footer (可選) */}
            <footer className='w-full border-t p-4 text-center text-sm text-muted-foreground'>
                © 2025 Leaf Disease AI. All rights reserved.
            </footer>
        </div>
    );
};

export default AppLayout;
