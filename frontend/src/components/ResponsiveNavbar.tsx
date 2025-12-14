import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ResponsiveNavbarProps {
    userEmail?: string;
    onLogout?: () => void;
}

function ResponsiveNavbar({ userEmail, onLogout }: ResponsiveNavbarProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { path: "/home", label: "HOME" },
        { path: "/predict", label: "AI 診斷" },
        { path: "/history", label: "HISTORY" },
        { path: "/account", label: "ACCOUNT" },
    ];

    const handleLogout = async () => {
        try {
            await apiFetch("/logout", {
                method: "POST",
            });
            if (onLogout) {
                onLogout();
            }
            navigate("/login");
        } catch (err) {
            console.error("登出失敗:", err);
        }
    };

    return (
        <>
            {/* 桌面版導覽列 */}
            <nav className='hidden md:flex items-center justify-between p-4 border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60'>
                <div className='flex items-center gap-6'>
                    <img src='/LOGO_Horizontal.png' alt='Leaf Disease AI' className='h-8 w-auto object-contain' />
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                isActive(item.path)
                                    ? "bg-emerald-600 text-white"
                                    : "text-neutral-700 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
                <div className='flex items-center gap-4'>
                    {userEmail && <span className='text-sm text-neutral-600'>{userEmail}</span>}
                    <Button variant='outline' onClick={handleLogout}>
                        登出
                    </Button>
                </div>
            </nav>

            {/* 手機版導覽列 */}
            <nav className='md:hidden fixed bottom-0 left-0 right-0 border-t border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-50'>
                <div className='flex items-center justify-around p-2'>
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex-1 text-center py-2 rounded-md text-xs font-medium transition-colors ${
                                isActive(item.path)
                                    ? "bg-emerald-600 text-white"
                                    : "text-neutral-700 hover:bg-emerald-50"
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant='ghost' size='icon' className='flex-1'>
                                <Menu className='h-5 w-5' />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side='bottom' className='border-t'>
                            <div className='space-y-4 pt-4'>
                                {userEmail && (
                                    <div className='text-sm text-neutral-600 pb-2 border-b border-neutral-200'>
                                        {userEmail}
                                    </div>
                                )}
                                <Button variant='outline' onClick={handleLogout} className='w-full'>
                                    登出
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </nav>
        </>
    );
}

export default ResponsiveNavbar;
