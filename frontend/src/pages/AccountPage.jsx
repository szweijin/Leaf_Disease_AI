import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function formatDate(dateString) {
    if (!dateString || dateString === "未記錄") return "未記錄";
    try {
        const date = new Date(dateString);
        return date.toLocaleString("zh-TW", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return dateString;
    }
}

/**
 * ACCOUNT 頁面 - 帳號設定相關
 */
function AccountPage({ userEmail }) {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState(null);
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changing, setChanging] = useState(false);

    const loadProfile = useCallback(async () => {
        try {
            const res = await apiFetch("/user/profile");
            const data = await res.json();
            if (res.ok) {
                setProfile(data);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const res = await apiFetch("/user/stats");
            const data = await res.json();
            if (res.ok) {
                setStats(data);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        loadProfile();
        loadStats();
    }, [loadProfile, loadStats]);

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!oldPassword || !newPassword || !confirmPassword) {
            alert("請填入所有欄位");
            return;
        }
        if (newPassword !== confirmPassword) {
            alert("新密碼不匹配");
            return;
        }
        try {
            setChanging(true);
            const res = await apiFetch("/user/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    old_password: oldPassword,
                    new_password: newPassword,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                alert("密碼已成功更新");
                setOldPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                alert("更新失敗: " + data.error);
            }
        } catch (e) {
            console.error(e);
            alert("系統發生錯誤");
        } finally {
            setChanging(false);
        }
    };

    return (
        <>
            <Card className='mb-8'>
                <CardHeader className='bg-neutral-900 text-white'>
                    <CardTitle>👤 個人資訊</CardTitle>
                </CardHeader>
                <CardContent className='pt-6'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                        <div className='space-y-2'>
                            <Label>郵箱地址</Label>
                            <div className='px-4 py-3 bg-neutral-50 border-2 border-neutral-300 rounded-xl text-base'>
                                <span>{profile?.email || userEmail}</span>
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <Label>帳號建立時間</Label>
                            <div className='px-4 py-3 bg-neutral-50 border-2 border-neutral-300 rounded-xl text-base'>
                                <span>{formatDate(profile?.created_at)}</span>
                            </div>
                        </div>
                        <div className='space-y-2'>
                            <Label>最後登入時間</Label>
                            <div className='px-4 py-3 bg-neutral-50 border-2 border-neutral-300 rounded-xl text-base'>
                                <span>{formatDate(profile?.last_login)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className='mb-8'>
                <CardHeader className='bg-neutral-900 text-white'>
                    <CardTitle>🔐 修改密碼</CardTitle>
                </CardHeader>
                <CardContent className='pt-6'>
                    <div className='max-w-lg'>
                        <form onSubmit={handleChangePassword} className='space-y-4'>
                            <div className='space-y-2'>
                                <Label>舊密碼</Label>
                                <Input
                                    type='password'
                                    placeholder='請輸入舊密碼'
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <div className='space-y-2'>
                                <Label>新密碼</Label>
                                <Input
                                    type='password'
                                    placeholder='請輸入新密碼'
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                />
                                <small className='text-neutral-500 text-sm block'>需含大小寫英文及數字，8碼以上</small>
                            </div>
                            <div className='space-y-2'>
                                <Label>確認新密碼</Label>
                                <Input
                                    type='password'
                                    placeholder='再次輸入新密碼'
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type='submit' className='w-full' disabled={changing}>
                                {changing ? "更新中..." : "更新密碼"}
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className='bg-neutral-900 text-white'>
                    <CardTitle>📈 統計資訊</CardTitle>
                </CardHeader>
                <CardContent className='pt-6'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8'>
                        <Card className='bg-neutral-900 text-white'>
                            <CardContent className='pt-6 text-center'>
                                <div className='text-4xl font-bold mb-2'>{stats?.total_detections ?? 0}</div>
                                <div>總檢測次數</div>
                            </CardContent>
                        </Card>
                        <Card className='bg-neutral-800 text-white'>
                            <CardContent className='pt-6 text-center'>
                                <div className='text-4xl font-bold mb-2'>
                                    {stats ? Object.keys(stats.disease_stats).length : 0}
                                </div>
                                <div>檢測出病害種類</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className='mt-8'>
                        <h5 className='font-bold text-neutral-900 mb-4'>病害分布</h5>
                        <div className='grid gap-2.5'>
                            {!stats || Object.keys(stats.disease_stats).length === 0 ? (
                                <div className='text-center py-10 text-neutral-500'>暫無檢測數據</div>
                            ) : (
                                Object.entries(stats.disease_stats).map(([disease, count]) => {
                                    const percentage = Math.round((count / stats.total_detections) * 100);
                                    return (
                                        <div key={disease} className='py-2.5 border-b border-neutral-300'>
                                            <div className='flex justify-between items-center mb-1'>
                                                <span className='font-bold text-neutral-800'>{disease}</span>
                                                <span className='px-3 py-1 bg-neutral-900 text-white rounded-full text-sm font-semibold'>
                                                    {count} 次
                                                </span>
                                            </div>
                                            <div className='bg-neutral-300 rounded-md h-2 overflow-hidden'>
                                                <div
                                                    className='bg-neutral-900 h-full transition-all duration-300'
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}

export default AccountPage;
