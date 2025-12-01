// 全域變數
let base64Image = "";
let resultModal;
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // 初始化 Modal
    const modalEl = document.getElementById('resultModal');
    if (modalEl) {
        resultModal = new bootstrap.Modal(modalEl);
    }
    
    // 檢查登入狀態
    checkAuthStatus();
});

// 切換登入/註冊表單
function toggleAuthForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
}

// 檢查登入狀態
async function checkAuthStatus() {
    try {
        const res = await fetch("/check-auth");
        const data = await res.json();
        
        if (res.ok && data.authenticated) {
            currentUser = data.email;
            showApp();
        } else {
            showAuth();
        }
    } catch (e) {
        console.error(e);
        showAuth();
    }
}

// 顯示認證頁面
function showAuth() {
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('appContainer').classList.remove('show');
}

// 顯示應用
function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').classList.add('show');
    document.getElementById('userEmail').textContent = currentUser;
    showPage('app');
    loadHistory();
}

// 註冊
async function register() {
    const email = document.getElementById("reg_email").value;
    const password = document.getElementById("reg_password").value;

    if (!email || !password) {
        alert("請輸入 Email 和密碼");
        return;
    }

    try {
        const res = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (res.ok) {
            alert("註冊成功！請登入");
            // 清空輸入框
            document.getElementById("reg_email").value = "";
            document.getElementById("reg_password").value = "";
            // 切換回登入表單
            toggleAuthForm();
        } else {
            alert("註冊失敗: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("連線錯誤");
    }
}

// 登入
async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (res.ok) {
            currentUser = email;
            showApp();
        } else {
            alert("登入失敗: " + data.error);
        }
    } catch (e) {
        console.error(e);
        alert("連線錯誤");
    }
}

// 登出
async function logout() {
    const res = await fetch("/logout");
    if (res.ok) {
        currentUser = null;
        showAuth();
        // 清空表單
        document.getElementById("email").value = "";
        document.getElementById("password").value = "";
        document.getElementById("previewImg").classList.remove('show');
        document.getElementById("imageInput").value = "";
        base64Image = "";
    }
}

// 圖片預覽
function preview(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById("previewImg");
        img.src = e.target.result;
        img.classList.add('show');
        base64Image = e.target.result;
    };
    reader.readAsDataURL(file);
}

// YOLO 預測
async function predict() {
    if (!base64Image) {
        alert("請先上傳圖片！");
        return;
    }

    try {
        const btn = document.querySelector("button[onclick='predict()']");
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ 分析中...";
        btn.disabled = true;

        const res = await fetch("/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image }),
        });

        btn.innerHTML = originalText;
        btn.disabled = false;

        const data = await res.json();

        if (res.ok) {
            // 計算百分比
            const scorePercent = (data.confidence * 100).toFixed(1);
            
            // 填入 Modal 資料
            document.getElementById("modalImg").src = data.image_path;
            document.getElementById("modalDisease").textContent = data.disease;
            document.getElementById("modalSeverity").textContent = data.severity;
            document.getElementById("modalScore").textContent = `${scorePercent}%`;
            
            // 更新進度條
            const progressBar = document.getElementById("modalProgressBar");
            progressBar.value = scorePercent;
            progressBar.max = 100;

            // 顯示病害詳細信息
            const detailContainer = document.getElementById("diseaseDetailContainer");
            if (data.disease_info) {
                detailContainer.style.display = 'block';
                document.getElementById("modalDiseaseCode").textContent = data.disease_info.causes || "-";
                document.getElementById("modalDiseaseFeature").textContent = data.disease_info.feature || "-";
                
                // 填入農藥防治建議
                const pesticideList = document.getElementById("modalPesticideList");
                pesticideList.innerHTML = "";
                if (data.disease_info.solution && data.disease_info.solution.pesticide) {
                    data.disease_info.solution.pesticide.forEach(p => {
                        const li = document.createElement("li");
                        li.style.marginBottom = "8px";
                        li.textContent = p;
                        pesticideList.appendChild(li);
                    });
                } else {
                    pesticideList.innerHTML = "<li>暫無資料</li>";
                }
                
                // 填入管理措施
                const managementList = document.getElementById("modalManagementList");
                managementList.innerHTML = "";
                if (data.disease_info.solution && data.disease_info.solution.management) {
                    data.disease_info.solution.management.forEach(m => {
                        const li = document.createElement("li");
                        li.style.marginBottom = "8px";
                        li.textContent = m;
                        managementList.appendChild(li);
                    });
                } else {
                    managementList.innerHTML = "<li>暫無資料</li>";
                }
            } else {
                detailContainer.style.display = 'none';
            }

            // 顯示 Modal
            resultModal.show();

            // 更新歷史紀錄
            loadHistory();
        } else {
            alert("預測失敗: " + (data.error || "未知錯誤"));
        }
    } catch (err) {
        console.error(err);
        alert("系統發生錯誤");
    }
}

// 載入歷史紀錄
async function loadHistory() {
    try {
        const res = await fetch("/history");

        if (!res.ok) {
            return;
        }

        const data = await res.json();
        const list = document.getElementById("historyList");
        list.innerHTML = "";

        if (data.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div>尚無檢測紀錄</div>
                </div>
            `;
            return;
        }

        for (const r of data) {
            const item = document.createElement("div");
            item.className = "history-item";
            
            const scorePercent = (r.confidence * 100).toFixed(1);
            const imgHtml = r.image_path 
                ? `<img src="${r.image_path}" alt="${r.disease}" class="history-img">` 
                : `<div class="history-img" style="background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #999;">No Img</div>`;

            item.innerHTML = `
                ${imgHtml}
                <div class="history-content">
                    <div class="history-disease">${r.disease}</div>
                    <div class="history-detail">分類結果: ${r.severity}</div>
                    <div class="history-detail">時間: ${r.timestamp ? r.timestamp : '剛剛'}</div>
                </div>
                <div>
                    <span class="confidence-badge">${scorePercent}%</span>
                </div>
            `;
            list.appendChild(item);
        }
    } catch (err) {
        console.error(err);
    }
}

// ========== 帳號中心功能 ==========

// 切換頁面
function showPage(page) {
    const appPage = document.getElementById('appPage');
    const profilePage = document.getElementById('profilePage');
    
    if (page === 'app') {
        appPage.classList.add('show');
        profilePage.classList.remove('show');
    } else if (page === 'profile') {
        appPage.classList.remove('show');
        profilePage.classList.add('show');
        loadUserProfile();
        loadUserStats();
    }
}

// 載入使用者個人資料
async function loadUserProfile() {
    try {
        const res = await fetch("/user/profile");
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('profileEmail').textContent = data.email;
            document.getElementById('profileCreated').textContent = formatDate(data.created_at);
            document.getElementById('profileLastLogin').textContent = formatDate(data.last_login);
        }
    } catch (err) {
        console.error(err);
    }
}

// 載入使用者統計資料
async function loadUserStats() {
    try {
        const res = await fetch("/user/stats");
        const data = await res.json();
        
        if (res.ok) {
            document.getElementById('totalDetections').textContent = data.total_detections;
            document.getElementById('totalDiseases').textContent = Object.keys(data.disease_stats).length;
            
            // 顯示病害分布
            const diseaseStatsDiv = document.getElementById('diseaseStats');
            diseaseStatsDiv.innerHTML = '';
            
            if (Object.keys(data.disease_stats).length === 0) {
                diseaseStatsDiv.innerHTML = '<div class="empty-state" style="padding: 20px;">暫無檢測數據</div>';
                return;
            }
            
            for (const [disease, count] of Object.entries(data.disease_stats)) {
                const percentage = Math.round((count / data.total_detections) * 100);
                diseaseStatsDiv.innerHTML += `
                    <div style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span class="fw-bold">${disease}</span>
                            <span class="badge bg-success">${count} 次</span>
                        </div>
                        <div style="background: #e0e0e0; border-radius: 5px; height: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(90deg, #198754 0%, #156645 100%); height: 100%; width: ${percentage}%;"></div>
                        </div>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// 修改密碼
async function changePassword() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!oldPassword || !newPassword || !confirmPassword) {
        alert('請填入所有欄位');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('新密碼不匹配');
        return;
    }
    
    try {
        const res = await fetch("/user/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert('密碼已成功更新');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else {
            alert('更新失敗: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('系統發生錯誤');
    }
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString || dateString === '未記錄') {
        return '未記錄';
    }
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}