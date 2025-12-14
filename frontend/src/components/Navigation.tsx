// frontend/src/components/Navigation.tsx (新增)
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const navItems = [
    { path: "/home", name: "首頁" },
    { path: "/predict", name: "AI 診斷" },
    { path: "/history", name: "歷史紀錄" },
    { path: "/account", name: "我的帳號" },
];

const Navigation = () => {
    const location = useLocation();

    return (
        <nav className='flex items-center gap-2 flex-wrap'>
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                    <Button
                        key={item.path}
                        asChild
                        variant={isActive ? "default" : "ghost"}
                        className={isActive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                    >
                        <Link to={item.path}>{item.name}</Link>
                    </Button>
                );
            })}
            <Button variant='outline' asChild className='ml-auto'>
                <Link to='/login'>登出</Link>
            </Button>
        </nav>
    );
};

export default Navigation;
