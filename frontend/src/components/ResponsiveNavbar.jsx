import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * 響應式導覽列組件
 *
 * 功能：
 * - 手機版（< 768px）：底部固定導覽列，分頁式導航
 * - 平板/桌面版（≥ 768px）：頂部導覽列，支援漢堡選單折疊
 *
 * Props:
 * @param {string} userEmail - 用戶郵箱
 * @param {function} onLogout - 登出回調
 */
function ResponsiveNavbar({ userEmail, onLogout }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // 導覽項目
    const navItems = [
        { id: "home", label: "HOME", icon: "🏠", path: "/home" },
        { id: "history", label: "HISTORY", icon: "📊", path: "/history" },
        { id: "account", label: "ACCOUNT", icon: "👤", path: "/account" },
    ];

    // 根據當前路徑判斷當前頁面
    const currentPage = navItems.find((item) => location.pathname === item.path)?.id || "home";

    return (
        <>
            {/* 桌面版頂部導覽列 (≥ 768px) */}
            <nav className='hidden md:flex fixed top-0 left-0 right-0 z-50 bg-neutral-900 text-white shadow-lg'>
                <div className='container mx-auto px-4 lg:px-6'>
                    <div className='flex items-center justify-between h-16'>
                        {/* Logo / Brand */}
                        <div className='flex items-center gap-2 text-xl font-bold'>
                            <span>🌿</span>
                            <span className='hidden lg:inline'>Leaf Disease AI</span>
                            <span className='lg:hidden'>Leaf AI</span>
                        </div>

                        {/* 桌面導覽項目 */}
                        <div className='flex items-center gap-4'>
                            {navItems.map((item) => (
                                <Link
                                    key={item.id}
                                    to={item.path}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                                        currentPage === item.id
                                            ? "bg-neutral-700 text-white"
                                            : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                                    }`}
                                >
                                    <span className='hidden lg:inline'>{item.icon} </span>
                                    {item.label}
                                </Link>
                            ))}
                        </div>

                        {/* 用戶資訊與登出 */}
                        <div className='flex items-center gap-3'>
                            <span className='hidden lg:inline text-sm text-neutral-300'>{userEmail}</span>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => {
                                    onLogout();
                                    navigate("/login");
                                }}
                                className='bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700'
                            >
                                登出
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* 手機版頂部導覽列 (< 768px) */}
            <nav className='md:hidden fixed top-0 left-0 right-0 z-50 bg-neutral-900 text-white shadow-lg'>
                <div className='flex items-center justify-between h-14 px-4'>
                    <div className='flex items-center gap-2 text-lg font-bold'>
                        <span>🌿</span>
                        <span>Leaf Disease AI</span>
                    </div>
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button variant='ghost' size='icon' className='text-white hover:bg-neutral-800'>
                                <span className='text-xl'>{mobileMenuOpen ? "✕" : "☰"}</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side='top' className='bg-neutral-900 text-white border-neutral-800'>
                            <div className='flex flex-col space-y-4 mt-8'>
                                {navItems.map((item) => (
                                    <Link
                                        key={item.id}
                                        to={item.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${
                                            currentPage === item.id
                                                ? "bg-neutral-700 text-white"
                                                : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                                        }`}
                                    >
                                        {item.icon} {item.label}
                                    </Link>
                                ))}
                                <div className='pt-4 border-t border-neutral-700'>
                                    <div className='px-4 py-2 text-sm text-neutral-300 mb-2'>{userEmail}</div>
                                    <Button
                                        variant='outline'
                                        className='w-full justify-start bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700'
                                        onClick={() => {
                                            onLogout();
                                            navigate("/login");
                                            setMobileMenuOpen(false);
                                        }}
                                    >
                                        登出
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </nav>

            {/* 手機版底部固定導覽列 (< 768px) */}
            <div className='md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 shadow-lg'>
                <div className='flex items-center justify-around h-16'>
                    {navItems.map((item) => (
                        <Link
                            key={item.id}
                            to={item.path}
                            className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all ${
                                currentPage === item.id ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                            }`}
                        >
                            <span className='text-2xl'>{item.icon}</span>
                            <span className='text-xs font-medium'>{item.label}</span>
                            {currentPage === item.id && (
                                <div className='absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-neutral-900 rounded-t-full' />
                            )}
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}

export default ResponsiveNavbar;
