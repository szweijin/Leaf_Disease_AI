// frontend/src/pages/LoginPage.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LoginPage = () => {
    return (
        <div className='flex justify-center items-center min-h-screen bg-gray-50'>
            <div className='w-full max-w-md p-8 space-y-6 bg-white shadow-xl rounded-xl'>
                <h1 className='text-3xl font-bold text-center'>用戶登入</h1>
                <form className='space-y-4'>
                    <div className='space-y-2'>
                        <Label htmlFor='email'>信箱</Label>
                        <Input id='email' type='email' placeholder='name@example.com' required />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='password'>密碼</Label>
                        <Input id='password' type='password' required />
                    </div>
                    {/* 登入成功後，使用 <Link to="/home"> 導航 */}
                    <Button type='submit' className='w-full' asChild>
                        <Link to='/home'>登入</Link>
                    </Button>
                </form>
                <p className='text-center text-sm text-gray-500'>
                    還沒有帳號？{" "}
                    <Link to='#' className='text-blue-600 hover:underline'>
                        註冊
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
