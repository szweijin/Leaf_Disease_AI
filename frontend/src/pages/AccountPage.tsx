import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { validatePassword, getPasswordRequirements } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
// 引入所有必要的圖標，包含新的 Eye, EyeOff
import { Loader2, User, Lock, Mail, Calendar, LogOut, Eye, EyeOff } from "lucide-react";

interface UserProfile {
    email?: string;
    username?: string;
    created_at?: string;
    last_login?: string;
}

interface AccountPageProps {
    onLogout?: () => void;
}

function AccountPage({ onLogout }: AccountPageProps) {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [username, setUsername] = useState("");
    const [error, setError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingUsername, setLoadingUsername] = useState(false);

    // 新增三個狀態來控制密碼可見性
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
            setUsername(data.username || ""); // 初始化使用者名稱
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setPasswordError("");

        // 驗證新密碼複雜度
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            setPasswordError(validation.message);
            setError(validation.message);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("新密碼與確認密碼不一致");
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
            setPasswordError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!username.trim()) {
            setError("請輸入使用者名稱");
            return;
        }

        // 如果使用者名稱沒有改變，不需要更新
        if (username.trim() === (userProfile?.username || "")) {
            toast.info("使用者名稱沒有變更");
            return;
        }

        setLoadingUsername(true);

        try {
            const res = await apiFetch("/user/update-profile", {
                method: "POST",
                body: JSON.stringify({
                    username: username.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "更新失敗");
                return;
            }

            toast.success("暱稱修改成功");
            // 重新載入個人資料以獲取最新資訊
            await loadProfile();
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoadingUsername(false);
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

    /**
     * Helper function to render the Eye/EyeOff icon button
     * @param showState boolean indicating if the password is shown
     * @param toggleFunction function to toggle the showState
     * @returns React element (Button with icon)
     */
    const PasswordToggleButton = ({
        showState,
        toggleFunction,
    }: {
        showState: boolean;
        toggleFunction: () => void;
    }) => (
        <Button
            type='button'
            onClick={toggleFunction}
            variant='ghost'
            size='sm'
            className='absolute right-0 top-0 h-full px-3 py-0 text-neutral-500 hover:bg-transparent hover:text-emerald-600'
        >
            {showState ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
        </Button>
    );

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
        <div
            className={`${
                isMobile
                    ? "w-full p-6 pt-8 bg-gradient-to-b from-white to-emerald-50 min-h-screen "
                    : "container mx-auto p-4 md:p-6 lg:p-8 max-w-2xl"
            }`}
        >
            <div className='space-y-6'>
                <div>
                    <h1
                        className={`
                            ${isMobile ? "text-3xl" : "text-2xl sm:text-3xl md:text-4xl"} 
                            font-extrabold tracking-tight text-emerald-700 
                            ${isMobile ? "mb-1" : "mb-1 sm:mb-2"}
                        `}
                    >
                        帳號設定
                    </h1>
                    <p className='text-lg text-neutral-600'>管理您的帳號資訊</p>
                </div>

                {/* 個人資料卡片 */}
                <Card className='border-neutral-200 '>
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
                                tooltip='您的 Email 地址（無法修改）'
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label className='flex items-center gap-2 text-neutral-700'>
                                <User className='w-4 h-4' />
                                暱稱
                            </Label>
                            <form onSubmit={handleUpdateUsername} className='flex gap-2'>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder='請輸入您的暱稱'
                                    maxLength={100}
                                    className='flex-1 border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                                    tooltip='您的暱稱（可修改）'
                                />
                                <Button
                                    type='submit'
                                    disabled={loadingUsername || username.trim() === (userProfile?.username || "")}
                                    className='flex-shrink-0'
                                >
                                    {loadingUsername ? (
                                        <>
                                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                            更新中...
                                        </>
                                    ) : (
                                        "更新"
                                    )}
                                </Button>
                            </form>
                        </div>

                        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4 pt-2`}>
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
                            {/* 舊密碼輸入框 */}
                            <div className='space-y-2'>
                                <Label htmlFor='oldPassword'>舊密碼</Label>
                                <div className='relative'>
                                    <Input
                                        id='oldPassword'
                                        // 根據 showOldPassword 狀態切換 type
                                        type={showOldPassword ? "text" : "password"}
                                        value={oldPassword}
                                        onChange={(e) => setOldPassword(e.target.value)}
                                        required
                                        placeholder='請輸入目前的密碼'
                                        className='pr-10 border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500'
                                    />
                                    <PasswordToggleButton
                                        showState={showOldPassword}
                                        toggleFunction={() => setShowOldPassword(!showOldPassword)}
                                    />
                                </div>
                            </div>

                            {/* 新密碼輸入框 */}
                            <div className='space-y-2'>
                                <Label htmlFor='newPassword'>新密碼</Label>
                                <div className='relative'>
                                    <Input
                                        id='newPassword'
                                        // 根據 showNewPassword 狀態切換 type
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => {
                                            setNewPassword(e.target.value);
                                            // 即時驗證密碼
                                            if (e.target.value.length > 0) {
                                                const validation = validatePassword(e.target.value);
                                                setPasswordError(validation.isValid ? "" : validation.message);
                                            } else {
                                                setPasswordError("");
                                            }
                                        }}
                                        required
                                        minLength={8}
                                        placeholder='至少 8 個字符'
                                        className={`pr-10 border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500 ${
                                            passwordError ? "border-red-500" : ""
                                        }`}
                                    />
                                    <PasswordToggleButton
                                        showState={showNewPassword}
                                        toggleFunction={() => setShowNewPassword(!showNewPassword)}
                                    />
                                </div>
                                <div className='space-y-1'>
                                    <p className='text-xs text-neutral-500'>密碼要求：</p>
                                    <ul className='text-xs text-neutral-500 list-disc list-inside space-y-0.5'>
                                        {getPasswordRequirements().map((req, index) => (
                                            <li key={index}>{req}</li>
                                        ))}
                                    </ul>
                                    {passwordError && <p className='text-xs text-red-500 mt-1'>{passwordError}</p>}
                                </div>
                            </div>

                            {/* 確認新密碼輸入框 */}
                            <div className='space-y-2'>
                                <Label htmlFor='confirmPassword'>確認新密碼</Label>
                                <div className='relative'>
                                    <Input
                                        id='confirmPassword'
                                        // 根據 showConfirmPassword 狀態切換 type
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={8}
                                        placeholder='請再次輸入新密碼'
                                        className={`pr-10 border-neutral-300 focus:border-emerald-500 focus:ring-emerald-500 ${
                                            confirmPassword && newPassword !== confirmPassword ? "border-red-500" : ""
                                        }`}
                                    />
                                    <PasswordToggleButton
                                        showState={showConfirmPassword}
                                        toggleFunction={() => setShowConfirmPassword(!showConfirmPassword)}
                                    />
                                </div>
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <p className='text-xs text-red-500'>新密碼與確認密碼不一致</p>
                                )}
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
