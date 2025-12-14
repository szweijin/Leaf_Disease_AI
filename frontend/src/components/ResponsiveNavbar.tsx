import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Camera, History, User } from "lucide-react";
import AccountSidebar from "./AccountSidebar";

interface ResponsiveNavbarProps {
    userEmail?: string;
    onLogout?: () => void;
}

function ResponsiveNavbar({ userEmail, onLogout }: ResponsiveNavbarProps) {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const isActive = (path: string) => location.pathname === path;

    // 導覽項目（桌面版和手機版共用，只是外觀排版不同）
    const navItems = [
        { path: "/predict", label: "PREDICT", icon: Camera },
        { path: "/history", label: "HISTORY", icon: History },
        { path: "/account", label: "ACCOUNT", icon: User },
    ];

    const handleAccountClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
    };

    return (
        <SidebarProvider
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            className='contents'
            style={{ "--sidebar-width": "20rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}
        >
            {/* 桌面版導覽列 */}
            <nav className='hidden md:flex items-center justify-between w-full h-14 px-4 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60'>
                <div className='flex items-center gap-6'>
                    <img src='/LOGO_Horizontal.png' alt='Leaf Disease AI' className='h-6 w-auto object-contain' />
                    {navItems
                        .filter((item) => item.path !== "/account")
                        .map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                    isActive(item.path)
                                        ? "text-emerald-600 font-bold"
                                        : "text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                </div>
                <div className='flex items-center gap-4'>
                    <button
                        onClick={handleAccountClick}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            isActive("/account")
                                ? "text-emerald-600 font-bold"
                                : "text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                    >
                        ACCOUNT
                    </button>
                </div>
            </nav>

            {/* 桌面版 Sidebar */}
            <AccountSidebar userEmail={userEmail} onLogout={onLogout} onClose={() => setSidebarOpen(false)} />

            {/* 手機版導覽列 */}
            <nav className='md:hidden fixed bottom-0 left-0 right-0 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-50'>
                <div className='flex items-center justify-around p-2'>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md text-xs font-medium transition-colors gap-1 ${
                                    active ? "text-emerald-600 font-bold" : "text-neutral-700 hover:bg-emerald-50"
                                }`}
                            >
                                <Icon className='h-5 w-5' />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                    {/* {userEmail && <div className='flex-1 text-center py-2 text-xs text-neutral-600'>{userEmail}</div>} */}
                </div>
            </nav>
        </SidebarProvider>
    );
}

export default ResponsiveNavbar;
