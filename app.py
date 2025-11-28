from flask import Flask, request, jsonify, session, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from ultralytics import YOLO
import base64
import json
import os
import re
import uuid  # 用於產生唯一檔名

app = Flask(__name__)
app.secret_key = "local_dev_secret"

# 設定圖片上傳儲存路徑 (必須在 static 資料夾下才能被前端讀取)
UPLOAD_FOLDER = 'static/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# 載入 YOLOv11 模型
model = YOLO("yolov11/best.pt")

# JSON 資料路徑
USERS_FILE = "data/users.json"
RECORDS_FILE = "data/records.json"
DISEASE_INFO_FILE = "data/disease_info.json"

# --- 工具函式 ---
def load_json(path):
    if not os.path.exists(path):
        return [] if path != DISEASE_INFO_FILE else {}
    with open(path, "r") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

# --- Class: 使用者管理器 (封裝帳號邏輯與複雜度驗證) ---
class UserManager:
    def __init__(self, filepath):
        self.filepath = filepath
        self.users = load_json(filepath)

    def _save(self):
        save_json(self.filepath, self.users)

    def validate_password_complexity(self, password):
        """
        驗證密碼複雜度:
        1. 長度至少 8 碼
        2. 包含至少一個大寫字母
        3. 包含至少一個小寫字母
        4. 包含至少一個數字
        """
        if len(password) < 8:
            return False, "密碼長度需至少 8 碼"
        if not re.search(r"[A-Z]", password):
            return False, "密碼需包含至少一個大寫字母 (A-Z)"
        if not re.search(r"[a-z]", password):
            return False, "密碼需包含至少一個小寫字母 (a-z)"
        if not re.search(r"[0-9]", password):
            return False, "密碼需包含至少一個數字 (0-9)"
        return True, "密碼符合要求"

    def register(self, email, password):
        # 1. 檢查 Email 是否重複
        if any(u["email"] == email for u in self.users):
            return False, "該 Email 已被註冊"
        
        # 2. 檢查密碼複雜度
        is_valid, msg = self.validate_password_complexity(password)
        if not is_valid:
            return False, msg

        # 3. 加密並儲存
        hashed_pw = generate_password_hash(password)
        self.users.append({"email": email, "password": hashed_pw})
        self._save()
        return True, "註冊成功！"

    def login(self, email, password):
        user = next((u for u in self.users if u["email"] == email), None)
        if user and check_password_hash(user["password"], password):
            return True
        return False

    def get_user_info(self, email):
        """取得使用者資訊"""
        user = next((u for u in self.users if u["email"] == email), None)
        if user:
            return {
                "email": user["email"],
                "created_at": user.get("created_at", "未記錄"),
                "last_login": user.get("last_login", "未記錄")
            }
        return None

    def update_password(self, email, old_password, new_password):
        """更新密碼"""
        # 1. 驗證舊密碼
        user = next((u for u in self.users if u["email"] == email), None)
        if not user or not check_password_hash(user["password"], old_password):
            return False, "舊密碼不正確"
        
        # 2. 驗證新密碼複雜度
        is_valid, msg = self.validate_password_complexity(new_password)
        if not is_valid:
            return False, msg
        
        # 3. 確認新密碼與舊密碼不同
        if old_password == new_password:
            return False, "新密碼不能與舊密碼相同"
        
        # 4. 更新密碼
        user["password"] = generate_password_hash(new_password)
        self._save()
        return True, "密碼已成功更新"

    def record_login(self, email):
        """記錄登入時間"""
        from datetime import datetime
        user = next((u for u in self.users if u["email"] == email), None)
        if user:
            user["last_login"] = datetime.now().isoformat()
            self._save()

    def add_created_time(self, email):
        """添加建立時間（首次註冊時）"""
        from datetime import datetime
        user = next((u for u in self.users if u["email"] == email), None)
        if user and "created_at" not in user:
            user["created_at"] = datetime.now().isoformat()
            self._save()

# 初始化 User Manager
user_manager = UserManager(USERS_FILE)


### -----------------------
### API 路由
### -----------------------

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    success, message = user_manager.register(data.get("email"), data.get("password"))
    
    if not success:
        return jsonify({"error": message}), 400
    
    # 為新用戶添加建立時間
    user_manager.add_created_time(data.get("email"))
    return jsonify({"status": message})


@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if user_manager.login(email, password):
        session["email"] = email
        user_manager.record_login(email)
        return jsonify({"status": "logged_in"})

    return jsonify({"error": "帳號或密碼錯誤"}), 401


@app.route("/logout")
def logout():
    session.pop("email", None)
    return jsonify({"status": "logged_out"})


@app.route("/check-auth")
def check_auth():
    """檢查使用者登入狀態"""
    if "email" in session:
        return jsonify({"authenticated": True, "email": session["email"]})
    return jsonify({"authenticated": False})


@app.route("/user/profile")
def get_user_profile():
    """取得使用者個人資料"""
    if "email" not in session:
        return jsonify({"error": "請先登入"}), 401
    
    user_info = user_manager.get_user_info(session["email"])
    if not user_info:
        return jsonify({"error": "使用者不存在"}), 404
    
    return jsonify(user_info)


@app.route("/user/change-password", methods=["POST"])
def change_password():
    """更改密碼"""
    if "email" not in session:
        return jsonify({"error": "請先登入"}), 401
    
    data = request.json
    old_password = data.get("old_password")
    new_password = data.get("new_password")
    
    if not old_password or not new_password:
        return jsonify({"error": "請輸入舊密碼和新密碼"}), 400
    
    success, message = user_manager.update_password(session["email"], old_password, new_password)
    
    if not success:
        return jsonify({"error": message}), 400
    
    return jsonify({"status": message})


@app.route("/user/stats")
def get_user_stats():
    """取得使用者統計資料"""
    if "email" not in session:
        return jsonify({"error": "請先登入"}), 401
    
    records = load_json(RECORDS_FILE)
    user_records = [r for r in records if r["email"] == session["email"]]
    
    # 計算統計資料
    total_detections = len(user_records)
    
    # 病害分類統計
    disease_stats = {}
    for record in user_records:
        disease = record.get("disease", "Unknown")
        disease_stats[disease] = disease_stats.get(disease, 0) + 1
    
    # 嚴重程度統計
    severity_stats = {}
    for record in user_records:
        severity = record.get("severity", "Unknown")
        severity_stats[severity] = severity_stats.get(severity, 0) + 1
    
    return jsonify({
        "total_detections": total_detections,
        "disease_stats": disease_stats,
        "severity_stats": severity_stats
    })


@app.route("/predict", methods=["POST"])
def predict():
    if "email" not in session:
        return jsonify({"error": "請先登入"}), 401

    img_data = request.json.get("image")
    if not img_data:
        return jsonify({"error": "無圖片資料"}), 400

    # 處理 Base64 圖片資料
    if "," in img_data:
        _, encoded = img_data.split(",", 1)
    else:
        encoded = img_data

    try:
        img_bytes = base64.b64decode(encoded)
    except Exception:
        return jsonify({"error": "圖片格式錯誤"}), 400

    # 1. 儲存圖片 (使用 UUID 避免檔名衝突)
    filename = f"{uuid.uuid4()}.jpg"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    web_image_path = f"/{file_path}" # 前端存取用的路徑

    with open(file_path, "wb") as f:
        f.write(img_bytes)

    # 2. 進行預測
    results = model(file_path)[0]
    boxes = results.boxes

    if len(boxes) == 0:
        # 即使沒測到，也建議回傳圖片路徑讓前端顯示
        return jsonify({
            "result": "No disease detected", 
            "disease": "健康 (Healthy)",
            "severity": "無",
            "confidence": 0.0,
            "image_path": web_image_path,
            "disease_info": None
        })

    cls_id = int(boxes[0].cls)
    confidence = float(boxes[0].conf)
    disease_name = results.names[cls_id]
    
    # 簡單解析嚴重程度 (假設命名格式有底線)
    parts = disease_name.split("_")
    severity = parts[-1] if len(parts) > 1 else "Unknown"

    # 2.5. 載入病害資訊
    disease_info_db = load_json(DISEASE_INFO_FILE)
    disease_info = disease_info_db.get(disease_name, None)

    # 3. 儲存紀錄 (包含圖片路徑)
    records = load_json(RECORDS_FILE)
    records.append({
        "email": session["email"],
        "disease": disease_name,
        "severity": severity,
        "confidence": confidence,
        "image_path": web_image_path,  # 新增欄位：圖片路徑
        "timestamp": str(uuid.uuid1().time) # 可選：簡易時間戳記
    })
    save_json(RECORDS_FILE, records)

    return jsonify({
        "disease": disease_name,
        "severity": severity,
        "confidence": confidence,
        "image_path": web_image_path,
        "disease_info": disease_info
    })


@app.route("/history")
def history():
    if "email" not in session:
        return jsonify({"error": "Not logged in"}), 401

    records = load_json(RECORDS_FILE)
    # 過濾該使用者的紀錄並反轉順序 (最新的在最前)
    user_records = [r for r in records if r["email"] == session["email"]]
    user_records.reverse()

    return jsonify(user_records)


@app.route("/")
def index():
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)