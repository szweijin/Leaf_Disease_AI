import React, { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../api.js";

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
            <div className='section-card'>
                <div className='section-header'>
                    <h2>👤 個人資訊</h2>
                </div>
                <div className='section-body'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                        <div>
                            <label className='form-group label'>郵箱地址</label>
                            <div className='px-4 py-3 bg-primary-50 border-2 border-neutral-300 rounded-xl text-base'>
                                <span>{profile?.email || userEmail}</span>
                            </div>
                        </div>
                        <div>
                            <label className='form-group label'>帳號建立時間</label>
                            <div className='px-4 py-3 bg-primary-50 border-2 border-neutral-300 rounded-xl text-base'>
                                <span>{formatDate(profile?.created_at)}</span>
                            </div>
                        </div>
                        <div>
                            <label className='form-group label'>最後登入時間</label>
                            <div className='px-4 py-3 bg-primary-50 border-2 border-neutral-300 rounded-xl text-base'>
                                <span>{formatDate(profile?.last_login)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className='section-card'>
                <div className='section-header'>
                    <h2>🔐 修改密碼</h2>
                </div>
                <div className='section-body'>
                    <div className='max-w-lg'>
                        <form onSubmit={handleChangePassword}>
                            <div className='form-group'>
                                <label className='form-group label'>舊密碼</label>
                                <input
                                    type='password'
                                    className='form-group input'
                                    placeholder='請輸入舊密碼'
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                />
                            </div>
                            <div className='form-group'>
                                <label className='form-group label'>新密碼</label>
                                <input
                                    type='password'
                                    className='form-group input'
                                    placeholder='請輸入新密碼'
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <small className='text-neutral-500 text-sm mt-1 block'>
                                    需含大小寫英文及數字，8碼以上
                                </small>
                            </div>
                            <div className='form-group'>
                                <label className='form-group label'>確認新密碼</label>
                                <input
                                    type='password'
                                    className='form-group input'
                                    placeholder='再次輸入新密碼'
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <button type='submit' className='btn-auth btn-submit w-full' disabled={changing}>
                                {changing ? "更新中..." : "更新密碼"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div className='section-card'>
                <div className='section-header'>
                    <h2>📈 統計資訊</h2>
                </div>
                <div className='section-body'>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                        <div className='stats-card stats-card-green'>
                            <div className='stats-number'>{stats?.total_detections ?? 0}</div>
                            <div>總檢測次數</div>
                        </div>
                        <div className='stats-card stats-card-purple'>
                            <div className='stats-number'>{stats ? Object.keys(stats.disease_stats).length : 0}</div>
                            <div>檢測出病害種類</div>
                        </div>
                    </div>

                    <div className='mt-8'>
                        <h5 className='font-bold text-primary-600 mb-4'>病害分布</h5>
                        <div className='grid gap-2.5'>
                            {!stats || Object.keys(stats.disease_stats).length === 0 ? (
                                <div className='empty-state'>暫無檢測數據</div>
                            ) : (
                                Object.entries(stats.disease_stats).map(([disease, count]) => {
                                    const percentage = Math.round((count / stats.total_detections) * 100);
                                    return (
                                        <div key={disease} className='py-2.5 border-b border-neutral-300'>
                                            <div className='flex justify-between items-center mb-1'>
                                                <span className='font-bold text-neutral-800'>{disease}</span>
                                                <span className='px-3 py-1 bg-[#198754] text-white rounded-full text-sm font-semibold'>
                                                    {count} 次
                                                </span>
                                            </div>
                                            <div className='bg-neutral-300 rounded-md h-2 overflow-hidden'>
                                                <div
                                                    className='bg-gradient-primary h-full transition-all duration-300'
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default AccountPage;
