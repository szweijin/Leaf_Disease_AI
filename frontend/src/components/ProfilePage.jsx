import React, { useEffect, useState } from "react";
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
      second: "2-digit"
    });
  } catch {
    return dateString;
  }
}

function ProfilePage({ userEmail }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await apiFetch("/user/profile");
      const data = await res.json();
      if (res.ok) {
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadStats = async () => {
    try {
      const res = await apiFetch("/user/stats");
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

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
          new_password: newPassword
        })
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
      <div className="section-card">
        <div className="section-header">
          <h2>👤 個人資訊</h2>
        </div>
        <div className="section-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20
            }}
          >
            <div>
              <label className="form-label fw-bold text-success">
                郵箱地址
              </label>
              <div
                className="form-control"
                style={{ background: "#f0f8f5" }}
                disabled=""
              >
                <span>{profile?.email || userEmail}</span>
              </div>
            </div>
            <div>
              <label className="form-label fw-bold text-success">
                帳號建立時間
              </label>
              <div
                className="form-control"
                style={{ background: "#f0f8f5" }}
                disabled=""
              >
                <span>{formatDate(profile?.created_at)}</span>
              </div>
            </div>
            <div>
              <label className="form-label fw-bold text-success">
                最後登入時間
              </label>
              <div
                className="form-control"
                style={{ background: "#f0f8f5" }}
                disabled=""
              >
                <span>{formatDate(profile?.last_login)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <h2>🔐 修改密碼</h2>
        </div>
        <div className="section-body">
          <div style={{ maxWidth: 500 }}>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label fw-bold text-success">
                  舊密碼
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="請輸入舊密碼"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label fw-bold text-success">
                  新密碼
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="請輸入新密碼"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <small className="text-muted">
                  需含大小寫英文及數字，8碼以上
                </small>
              </div>
              <div className="form-group">
                <label className="form-label fw-bold text-success">
                  確認新密碼
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="再次輸入新密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-success w-100 fw-bold py-2"
                disabled={changing}
              >
                {changing ? "更新中..." : "更新密碼"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <h2>📈 統計資訊</h2>
        </div>
        <div className="section-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 20
            }}
          >
            <div className="stats-card stats-card-green">
              <div className="stats-number">
                {stats?.total_detections ?? 0}
              </div>
              <div>總檢測次數</div>
            </div>
            <div className="stats-card stats-card-purple">
              <div className="stats-number">
                {stats ? Object.keys(stats.disease_stats).length : 0}
              </div>
              <div>檢測出病害種類</div>
            </div>
          </div>

          <div style={{ marginTop: 30 }}>
            <h5 className="fw-bold text-success mb-3">病害分布</h5>
            <div id="diseaseStats" style={{ display: "grid", gap: 10 }}>
              {!stats || Object.keys(stats.disease_stats).length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}>
                  暫無檢測數據
                </div>
              ) : (
                Object.entries(stats.disease_stats).map(
                  ([disease, count]) => {
                    const percentage = Math.round(
                      (count / stats.total_detections) * 100
                    );
                    return (
                      <div
                        key={disease}
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid #e0e0e0"
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 5
                          }}
                        >
                          <span className="fw-bold">{disease}</span>
                          <span className="badge bg-success">
                            {count} 次
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#e0e0e0",
                            borderRadius: 5,
                            height: 8,
                            overflow: "hidden"
                          }}
                        >
                          <div
                            style={{
                              background:
                                "linear-gradient(90deg, #198754 0%, #156645 100%)",
                              height: "100%",
                              width: `${percentage}%`
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfilePage;


