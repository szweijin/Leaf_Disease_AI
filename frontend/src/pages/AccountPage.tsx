import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Lock, Mail, Calendar, LogOut } from "lucide-react";

interface UserProfile {
    email?: string;
    created_at?: string;
    last_login?: string;
}

interface AccountPageProps {
    onLogout?: () => void;
}

function AccountPage({ onLogout }: AccountPageProps) {
    const navigate = useNavigate();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);

    useEffect(() => {
        if (error) {
            toast.error(error);
            setError("");
        }
    }, [error]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await apiFetch("/user/profile");
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "載入失敗");
                return;
            }

            setUserProfile(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword !== confirmPassword) {
            setError("新密碼與確認密碼不一致");
            return;
        }

        if (newPassword.length < 6) {
            setError("新密碼至少需要 6 個字元");
            return;
        }

        setLoading(true);

        try {
            const res = await apiFetch("/user/change-password", {
                method: "POST",
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "修改失敗");
                return;
            }

            toast.success("密碼修改成功");
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoading(false);
        }
    };

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
            toast.error("登出失敗");
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString || dateString === "未記錄") return "未記錄";
        try {
            return new Date(dateString).toLocaleString("zh-TW", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateString;
        }
    };

    if (loadingProfile) {
        return (
            <div className='container mx-auto p-4 max-w-2xl'>
                <div className='text-center py-12'>
                    <Loader2 className='w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
                    <p className='text-lg text-neutral-600'>載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className='container mx-auto p-4 md:p-6 lg:p-8 max-w-2xl'>
            <div className='space-y-6'>
                <div>
                    <h1 className='text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-700 mb-2'>
                        帳號設定
                    </h1>
                    <p className='text-lg text-neutral-600'>管理您的帳號資訊</p>
                </div>

                {/* 個人資料卡片 */}
                <Card className='border-neutral-200'>
                    <CardHeader>
                        <div className='flex items-center gap-2'>
                            <User className='w-5 h-5 text-emerald-600' />
                            <CardTitle>個人資料</CardTitle>
                        </div>
                        <CardDescription>您的帳號基本資訊</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                            <Label className='flex items-center gap-2 text-neutral-700'>
                                <Mail className='w-4 h-4' />
                                Email
                            </Label>
                            <Input
                                value={userProfile?.email || ""}
                                disabled
                                className='bg-neutral-50 text-neutral-600'
                            />
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-2'>
                            <div className='space-y-2'>
                                <Label className='flex items-center gap-2 text-neutral-700'>
                                    <Calendar className='w-4 h-4' />
                                    帳號創建時間
                                </Label>
                                <div className='text-sm text-neutral-600 bg-neutral-50 px-3 py-2 rounded-md border border-neutral-200'>
                                    {formatDate(userProfile?.created_at)}
                                </div>
                            </div>
                            <div className='space-y-2'>
                                <Label className='flex items-center gap-2 text-neutral-700'>
                                    <Calendar className='w-4 h-4' />
                                    最後登入時間
                                </Label>
                                <div className='text-sm text-neutral-600 bg-neutral-50 px-3 py-2 rounded-md border border-neutral-200'>
                                    {formatDate(userProfile?.last_login)}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 修改密碼卡片 */}
                <Card className='border-neutral-200'>
                    <CardHeader>
                        <div className='flex items-center gap-2'>
                            <Lock className='w-5 h-5 text-emerald-600' />
                            <CardTitle>修改密碼</CardTitle>
                        </div>
                        <CardDescription>更新您的帳號密碼</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleChangePassword} className='space-y-4'>
                            <div className='space-y-2'>
                                <Label htmlFor='oldPassword'>舊密碼</Label>
                                <Input
                                    id='oldPassword'
                                    type='password'
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    required
                                    placeholder='請輸入目前的密碼'
                                    className='border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='newPassword'>新密碼</Label>
                                <Input
                                    id='newPassword'
                                    type='password'
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder='至少 6 個字元'
                                    className='border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                                />
                                <p className='text-xs text-neutral-500'>密碼長度至少需要 6 個字元</p>
                            </div>
                            <div className='space-y-2'>
                                <Label htmlFor='confirmPassword'>確認新密碼</Label>
                                <Input
                                    id='confirmPassword'
                                    type='password'
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    placeholder='請再次輸入新密碼'
                                    className='border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                                />
                            </div>
                            <Separator />
                            <Button type='submit' disabled={loading} className='w-full'>
                                {loading ? (
                                    <>
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        處理中...
                                    </>
                                ) : (
                                    <>
                                        <Lock className='mr-2 h-4 w-4' />
                                        修改密碼
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* 登出卡片 */}
                <Card className='border-neutral-200'>
                    <CardHeader>
                        <div className='flex items-center gap-2'>
                            <LogOut className='w-5 h-5 text-emerald-600' />
                            <CardTitle>登出</CardTitle>
                        </div>
                        <CardDescription>登出您的帳號</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant='destructive' onClick={handleLogout} className='w-full'>
                            <LogOut className='mr-2 h-4 w-4' />
                            登出
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default AccountPage;
