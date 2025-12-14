// frontend/src/components/Navigation.tsx (新增)
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button"; // 假設您已經有 Button 組件

const navItems = [
    { path: "/home", name: "首頁" },
    { path: "/predict", name: "AI 診斷" },
    { path: "/history", name: "歷史紀錄" },
    { path: "/account", name: "我的帳號" },
];

const Navigation = () => {
    return (
        <nav className='flex items-center space-x-4'>
            {navItems.map((item) => (
                <Button
                    key={item.path}
                    asChild // 使用 Radix UI 的 asChild 讓 Button 渲染為 Link
                    variant='ghost'
                >
                    <Link to={item.path}>{item.name}</Link>
                </Button>
            ))}
            <Button variant='outline' asChild>
                <Link to='/login'>登出</Link>
            </Button>
        </nav>
    );
};

export default Navigation;
