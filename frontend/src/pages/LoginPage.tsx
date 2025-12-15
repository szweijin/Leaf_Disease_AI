import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { validatePassword, getPasswordRequirements } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

interface LoginPageProps {
    isAuthenticated?: boolean;
    onLoggedIn?: (email: string) => void;
}

const LoginPage = ({ isAuthenticated, onLoggedIn }: LoginPageProps) => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [loading, setLoading] = useState(false);
    // 新增狀態：追蹤密碼是否可見
    const [showPassword, setShowPassword] = useState(false);
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
        setPasswordError("");

        // 如果是註冊模式，先驗證密碼
        if (!isLogin) {
            const validation = validatePassword(password);
            if (!validation.isValid) {
                setPasswordError(validation.message);
                toast.error(validation.message);
                return;
            }
        }

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

            // 如果是註冊成功，切換回登入模式並保留帳號密碼
            if (!isLogin) {
                // 註冊成功
                toast.success("註冊成功！請登入");
                setIsLogin(true); // 切換回登入模式
                setPasswordError(""); // 清除密碼錯誤
                // email 和 password 已經在 state 中，會自動保留
                setLoading(false);
                return;
            }

            // 登入成功 - 後端返回 {"status": "logged_in", "email": email}
            if (onLoggedIn) {
                // 使用返回的 email 或表單中的 email
                const returnedEmail = data.email || email;
                onLoggedIn(returnedEmail);
                // 登入成功後立即導航到首頁
                navigate("/home", { replace: true });
            }
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
            setLoading(false);
        }
    };

    // 如果已登入，重定向到首頁
    if (isAuthenticated) {
        return <Navigate to='/home' replace />;
    }

    // 切換密碼可見性的函數
    const togglePasswordVisibility = () => {
        setShowPassword((prevShowPassword) => !prevShowPassword);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className='min-h-screen flex items-center justify-center p-0 md:p-4 relative bg-gradient-to-b from-white to-emerald-500 md:bg-none'
        >
            {/* 桌面版：背景圖片 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
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

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <Card className='w-full h-full min-h-screen min-w-screen md:h-auto md:max-w-md md:min-h-[300px] md:min-w-[400px] md:shadow-lg relative z-10 bg-white md:bg-white/95 md:backdrop-blur-sm rounded-none md:rounded-lg shadow-none md:shadow-lg flex flex-col justify-center md:justify-start'>
                    <CardHeader className='text-center'>
                        {/* Logo 區域 */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                            className='flex justify-center mb-4'
                        >
                            <motion.img
                                src='/LOGO_Horizontal.png'
                                alt='Leaf Disease AI'
                                className='h-16 w-auto object-contain'
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 0.2 }}
                            />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.3 }}
                        >
                            <CardTitle className='text-2xl font-semibold text-emerald-700'>
                                {isLogin ? "登入" : "註冊"}
                            </CardTitle>
                            <CardDescription className='mt-2'>
                                {isLogin ? "請輸入您的帳號密碼" : "創建新帳號"}
                            </CardDescription>
                        </motion.div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className='space-y-4'>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.4 }}
                                className='space-y-2'
                            >
                                <Label htmlFor='email'>Email</Label>
                                <Input
                                    id='email'
                                    type='email'
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder='user@example.com'
                                    className='border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                                    tooltip='請輸入您的 Email 地址'
                                />
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.5 }}
                                className='space-y-2'
                            >
                                <Label htmlFor='password'>密碼</Label>
                                {/* 調整結構：使用相對定位包裹 Input 和按鈕 */}
                                <div className='relative'>
                                    <Input
                                        id='password'
                                        // 根據 showPassword 狀態切換 type
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            // 如果是註冊模式，即時驗證密碼
                                            if (!isLogin) {
                                                if (e.target.value.length > 0) {
                                                    const validation = validatePassword(e.target.value);
                                                    setPasswordError(validation.isValid ? "" : validation.message);
                                                } else {
                                                    setPasswordError("");
                                                }
                                            }
                                        }}
                                        required
                                        placeholder={isLogin ? "請輸入密碼" : "至少 8 個字符，包含大小寫字母和數字"}
                                        minLength={isLogin ? 1 : 8}
                                        className={`pr-10 border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500 ${
                                            // 增加右邊內邊距
                                            passwordError ? "border-red-500" : ""
                                        }`}
                                        tooltip={
                                            isLogin ? "請輸入您的密碼" : "密碼需至少 8 個字符，包含大小寫字母和數字"
                                        }
                                    />
                                    {/* 切換密碼可見性的按鈕 */}
                                    <Button
                                        type='button' // 設置 type="button" 防止觸發表單提交
                                        onClick={togglePasswordVisibility}
                                        variant='ghost' // 使用 ghost 變體，使其看起來像個圖標
                                        size='sm' // 小尺寸按鈕
                                        className='absolute right-0 top-0 h-full px-3 py-0 text-neutral-500 hover:bg-transparent hover:text-emerald-600'
                                        tooltip={showPassword ? "隱藏密碼" : "顯示密碼"}
                                    >
                                        {/* 根據 showPassword 狀態顯示不同圖標 */}
                                        {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                    </Button>
                                </div>
                                {!isLogin && (
                                    <div className='space-y-1'>
                                        <p className='text-xs text-neutral-500'>密碼要求：</p>
                                        <ul className='text-xs text-neutral-500 list-disc list-inside space-y-0.5'>
                                            {getPasswordRequirements().map((req, index) => (
                                                <li key={index}>{req}</li>
                                            ))}
                                        </ul>
                                        {passwordError && <p className='text-xs text-red-500 mt-1'>{passwordError}</p>}
                                    </div>
                                )}
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.6 }}
                            >
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button
                                        type='submit'
                                        className='w-full'
                                        disabled={loading}
                                        tooltip={isLogin ? "點擊登入您的帳號" : "點擊註冊新帳號"}
                                    >
                                        {loading ? "處理中..." : isLogin ? "登入" : "註冊"}
                                    </Button>
                                </motion.div>
                            </motion.div>
                        </form>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.7 }}
                            className='mt-4 text-center text-sm'
                        >
                            <motion.button
                                type='button'
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError("");
                                    setPasswordError("");
                                }}
                                className='text-emerald-600 hover:text-emerald-700 hover:underline'
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {isLogin ? "還沒有帳號？點擊註冊" : "已有帳號？點擊登入"}
                            </motion.button>
                        </motion.div>
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
};

export default LoginPage;
