import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginPageProps {
    isAuthenticated?: boolean;
    onLoggedIn?: (email: string) => void;
}

const LoginPage = ({ isAuthenticated, onLoggedIn }: LoginPageProps) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const errorShownRef = useRef(false);

    useEffect(() => {
        if (error && !errorShownRef.current) {
            toast.error(error);
            errorShownRef.current = true;
            setTimeout(() => {
                setError("");
                errorShownRef.current = false;
            }, 0);
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const endpoint = isLogin ? "/login" : "/register";
            const res = await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "操作失敗");
                setLoading(false);
                return;
            }

            // 成功
            if (onLoggedIn) {
                onLoggedIn(email);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
            setLoading(false);
        }
    };

    // 如果已登入，重定向到首頁
    if (isAuthenticated) {
        return <Navigate to='/home' replace />;
    }

    return (
        <div className='min-h-screen flex items-center justify-center p-0 md:p-4 relative bg-gradient-to-b from-white to-emerald-500 md:bg-none'>
            {/* 桌面版：背景圖片 */}
            <div
                className='hidden md:block absolute inset-0'
                style={{
                    backgroundImage: "url('/background.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundAttachment: "fixed",
                }}
            />
            {/* 桌面版背景遮罩層 */}
            <div className='hidden md:block absolute inset-0 bg-black/40' />

            <Card className='w-full h-full md:h-auto md:max-w-md md:shadow-lg relative z-10 bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-lg shadow-none md:shadow-lg min-h-screen md:min-h-0 flex flex-col justify-center md:justify-start'>
                <CardHeader className='text-center'>
                    {/* Logo 區域 */}
                    <div className='flex justify-center mb-4'>
                        <img src='/LOGO_Horizontal.png' alt='Leaf Disease AI' className='h-16 w-auto object-contain' />
                    </div>
                    <CardTitle className='text-2xl font-semibold text-emerald-700'>
                        {isLogin ? "登入" : "註冊"}
                    </CardTitle>
                    <CardDescription className='mt-2'>{isLogin ? "請輸入您的帳號密碼" : "創建新帳號"}</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='email'>Email</Label>
                            <Input
                                id='email'
                                type='email'
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder='user@example.com'
                                className='border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='password'>密碼</Label>
                            <Input
                                id='password'
                                type='password'
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder='至少 6 個字元'
                                minLength={6}
                                className='border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                            />
                        </div>
                        <Button type='submit' className='w-full bg-emerald-600 hover:bg-emerald-700' disabled={loading}>
                            {loading ? "處理中..." : isLogin ? "登入" : "註冊"}
                        </Button>
                    </form>
                    <div className='mt-4 text-center text-sm'>
                        <button
                            type='button'
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError("");
                            }}
                            className='text-emerald-600 hover:text-emerald-700 hover:underline'
                        >
                            {isLogin ? "還沒有帳號？點擊註冊" : "已有帳號？點擊登入"}
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginPage;
