import React, { useState } from "react";
import { apiFetch } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

function AuthView({ onLoggedIn }) {
    const [mode, setMode] = useState("login"); // 'login' | 'register'
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const toggleMode = () => {
        setMode((m) => (m === "login" ? "register" : "login"));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!regEmail || !regPassword) {
            alert("請輸入 Email 和密碼");
            return;
        }
        try {
            setSubmitting(true);
            const res = await apiFetch("/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: regEmail, password: regPassword }),
            });

            // 嘗試解析 JSON 回應
            let data;
            try {
                const text = await res.text();
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error("解析回應失敗:", parseError);
                data = { error: "伺服器回應格式錯誤" };
            }

            if (res.ok) {
                alert("註冊成功！請登入");
                setMode("login");
                setRegEmail("");
                setRegPassword("");
            } else {
                // 顯示具體的錯誤訊息
                const errorMsg = data.error || data.message || `註冊失敗 (狀態碼: ${res.status})`;
                alert("註冊失敗: " + errorMsg);
                console.error("註冊失敗:", { status: res.status, data });
            }
        } catch (e) {
            console.error("註冊請求錯誤:", e);
            alert("連線錯誤: " + (e.message || "無法連接到伺服器"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const res = await apiFetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            });

            // 嘗試解析 JSON 回應
            let data;
            try {
                const text = await res.text();
                data = text ? JSON.parse(text) : {};
            } catch (parseError) {
                console.error("解析回應失敗:", parseError);
                data = { error: "伺服器回應格式錯誤" };
            }

            if (res.ok) {
                onLoggedIn(loginEmail);
            } else {
                // 顯示具體的錯誤訊息
                const errorMsg = data.error || data.message || `登入失敗 (狀態碼: ${res.status})`;
                alert("登入失敗: " + errorMsg);
                console.error("登入失敗:", { status: res.status, data });
            }
        } catch (e) {
            console.error("登入請求錯誤:", e);
            alert("連線錯誤: " + (e.message || "無法連接到伺服器"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-neutral-50 p-5'>
            <Card className='w-full max-w-md'>
                {mode === "login" ? (
                    <>
                        <CardHeader className='text-center bg-neutral-900 text-white'>
                            <CardTitle className='text-3xl'>🌿 Leaf Disease AI</CardTitle>
                            <CardDescription className='text-neutral-200'>登入您的帳戶</CardDescription>
                        </CardHeader>
                        <CardContent className='pt-6'>
                            <form onSubmit={handleLogin} className='space-y-4'>
                                <div className='space-y-2'>
                                    <Label htmlFor='email'>Email</Label>
                                    <Input
                                        id='email'
                                        type='email'
                                        placeholder='請輸入您的 Email'
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='password'>密碼</Label>
                                    <Input
                                        id='password'
                                        type='password'
                                        placeholder='請輸入密碼'
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type='submit' className='w-full' disabled={submitting}>
                                    {submitting ? "登入中..." : "登入"}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className='flex justify-center'>
                            <p className='text-sm text-muted-foreground'>
                                還沒有帳戶?{" "}
                                <button
                                    type='button'
                                    onClick={toggleMode}
                                    className='text-primary underline-offset-4 hover:underline font-medium'
                                >
                                    立即註冊
                                </button>
                            </p>
                        </CardFooter>
                    </>
                ) : (
                    <>
                        <CardHeader className='text-center bg-neutral-900 text-white'>
                            <CardTitle className='text-3xl'>🌿 Leaf Disease AI</CardTitle>
                            <CardDescription className='text-neutral-200'>建立新帳戶</CardDescription>
                        </CardHeader>
                        <CardContent className='pt-6'>
                            <form onSubmit={handleRegister} className='space-y-4'>
                                <div className='space-y-2'>
                                    <Label htmlFor='reg_email'>Email</Label>
                                    <Input
                                        id='reg_email'
                                        type='email'
                                        placeholder='請輸入您的 Email'
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='reg_password'>密碼</Label>
                                    <Input
                                        id='reg_password'
                                        type='password'
                                        placeholder='密碼需含大小寫英文及數字，8碼以上'
                                        value={regPassword}
                                        onChange={(e) => setRegPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type='submit' className='w-full' disabled={submitting}>
                                    {submitting ? "註冊中..." : "註冊"}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className='flex justify-center'>
                            <p className='text-sm text-muted-foreground'>
                                已有帳戶?{" "}
                                <button
                                    type='button'
                                    onClick={toggleMode}
                                    className='text-primary underline-offset-4 hover:underline font-medium'
                                >
                                    立即登入
                                </button>
                            </p>
                        </CardFooter>
                    </>
                )}
            </Card>
        </div>
    );
}

export default AuthView;
