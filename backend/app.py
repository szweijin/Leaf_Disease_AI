# local/backend/app.py

from flask import Flask, request, jsonify, session, url_for
from flask_caching import Cache
from flasgger import Swagger
import base64
import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# ---------------------------------------------
# 專案根目錄
# __file__ 是 backend/app.py，所以需要上一層到專案根目錄
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, BASE_DIR)  

# 載入環境變數
load_dotenv()

# ---------------------------------------------
# import
from config.development import DevelopmentConfig   
from src.core.db_manager import db, APILogger
from src.core.redis_manager import redis_manager
from src.core.user_manager import UserManager, DetectionQueries
from src.services.image_service import ImageService
from src.services.detection_service import DetectionService
from typing import Optional


# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask 應用
app = Flask(__name__)
app.config.from_object(DevelopmentConfig)

# 配置靜態文件服務：uploads 資料夾用於提供上傳的圖片
# static_folder 指向專案根目錄，static_url_path 讓 /uploads/ 映射到 uploads 資料夾
app.static_folder = BASE_DIR
app.static_url_path = ''

# 驗證資料庫配置
try:
    DevelopmentConfig.validate_db_config()
except ValueError as e:
    logger.error(f"❌ 配置驗證失敗: {str(e)}")
    logger.error("   請確保 .env 檔案存在並包含所有必要的資料庫設定")
    raise

# Redis 快取配置（如果 Redis 不可用則使用簡單快取）
try:
    if redis_manager.is_available():
        cache = Cache(app, config={
            'CACHE_TYPE': 'redis',
            'CACHE_REDIS_HOST': app.config.get('REDIS_HOST', 'localhost'),
            'CACHE_REDIS_PORT': app.config.get('REDIS_PORT', 6379),
            'CACHE_REDIS_DB': app.config.get('REDIS_DB', 0),
            'CACHE_DEFAULT_TIMEOUT': app.config.get('CACHE_DEFAULT_TIMEOUT', 3600),
            'CACHE_KEY_PREFIX': 'leaf_disease_ai:'
        })
        logger.info("✅ Flask-Caching 使用 Redis 後端")
    else:
        cache = Cache(app, config={
            'CACHE_TYPE': 'simple',
            'CACHE_DEFAULT_TIMEOUT': app.config.get('CACHE_DEFAULT_TIMEOUT', 3600)
        })
        logger.warning("⚠️ Redis 不可用，使用簡單記憶體快取")
except Exception as e:
    cache = Cache(app, config={
        'CACHE_TYPE': 'simple',
        'CACHE_DEFAULT_TIMEOUT': app.config.get('CACHE_DEFAULT_TIMEOUT', 3600)
    })
    logger.warning(f"⚠️ 快取初始化失敗，使用簡單快取: {str(e)}")

# Swagger 文檔配置
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api-docs"
}

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Leaf Disease AI API",
        "description": "葉片病害檢測 AI 系統 API 文檔（本地端開發版本）",
        "version": "2.0.0",
        "contact": {
            "name": "Leaf Disease AI",
        }
    },
    "host": "localhost:5000",
    "basePath": "/",
    "schemes": ["http"],
    "tags": [
        {
            "name": "認證",
            "description": "使用者註冊、登入、登出相關 API"
        },
        {
            "name": "使用者",
            "description": "使用者個人資料、統計資料相關 API"
        },
        {
            "name": "檢測",
            "description": "病害檢測、歷史記錄相關 API"
        }
    ]
}

swagger = Swagger(app, config=swagger_config, template=swagger_template)

# 本地開發設定
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# 確保 uploads 資料夾存在且可寫入
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    logger.info(f"✅ 創建上傳資料夾: {UPLOAD_FOLDER}")

# 驗證資料夾權限
if not os.access(UPLOAD_FOLDER, os.W_OK):
    logger.warning(f"⚠️ 上傳資料夾不可寫入: {UPLOAD_FOLDER}")
else:
    logger.info(f"✅ 上傳資料夾已就緒: {UPLOAD_FOLDER}")

# 載入模型（本地路徑）
MODEL_PATH = os.path.join(BASE_DIR, "model", "yolov11", "best_v1_50.pt")

try:
    detection_service = DetectionService(MODEL_PATH)
    logger.info("✅ 本地開發模式：模型載入成功")
except Exception as e:
    logger.error(f"❌ 無法載入模型: {str(e)}")
    detection_service = None


def get_user_id_from_session():
    """從 session 獲取使用者 ID"""
    if "user_id" not in session:
        return None
    try:
        result = db.execute_query(
            "SELECT id FROM users WHERE id = %s AND is_active = TRUE",
            (session["user_id"],),
            fetch_one=True
        )
        return result[0] if result else None
    except Exception as e:
        logger.error(f"❌ 獲取使用者 ID 失敗: {str(e)}")
        return None


def log_api_request(
    user_id: Optional[int] = None, # 修正點：明確指定 user_id 可能是 int 或 None
    endpoint: Optional[str] = None, 
    method: Optional[str] = None,
    status_code: Optional[int] = None, 
    execution_time_ms: Optional[int] = None, # 假設時間是以整數毫秒計算
    error_message: Optional[str] = None
    ):
    
    """記錄 API 請求日誌"""
    try:
        APILogger.log_request(
            user_id=user_id, # user_id 的型別現在是 Optional[int]
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            execution_time_ms=execution_time_ms,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string if request.user_agent else None,
            error_message=error_message
        )
    except Exception as e:
        logger.error(f"❌ 記錄 API 日誌失敗: {str(e)}")


# ==================== API 路由 ====================

@app.route("/register", methods=["POST"])
def register():
    """
    使用者註冊
    ---
    tags:
      - 認證
    summary: 註冊新使用者
    description: 使用 Email 和密碼註冊新帳號
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - password
          properties:
            email:
              type: string
              format: email
              example: user@example.com
              description: 使用者 Email
            password:
              type: string
              minLength: 6
              example: password123
              description: 使用者密碼（至少 6 個字元）
    responses:
      200:
        description: 註冊成功
        schema:
          type: object
          properties:
            status:
              type: string
              example: 註冊成功
      400:
        description: 註冊失敗（Email 已存在或參數錯誤）
        schema:
          type: object
          properties:
            error:
              type: string
              example: Email 已被註冊
      500:
        description: 系統錯誤
    """
    start_time = datetime.now()
    try:
        # 檢查請求內容類型
        if not request.is_json:
            logger.warning(f"⚠️ 註冊請求：Content-Type 不是 application/json")
            return jsonify({"error": "請求格式錯誤，請使用 JSON 格式"}), 400
        
        # 獲取 JSON 資料
        data = request.get_json(silent=True)
        if data is None:
            logger.warning(f"⚠️ 註冊請求：無法解析 JSON 資料")
            return jsonify({"error": "無法解析 JSON 資料"}), 400
        
        email = data.get("email")
        password = data.get("password")
        
        # 記錄請求資訊（不記錄密碼）
        logger.info(f"📝 註冊請求：email={email}, IP={request.remote_addr}")
        
        if not email or not password:
            error_msg = "請輸入 Email 和密碼"
            logger.warning(f"⚠️ 註冊失敗：{error_msg}")
            return jsonify({"error": error_msg}), 400
        
        success, message, user_id = UserManager.register(
            email=email, password=password, ip_address=request.remote_addr
        )
        
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/register", method="POST",
                       status_code=200 if success else 400, execution_time_ms=execution_time,
                       error_message=None if success else message)
        
        if not success:
            logger.warning(f"⚠️ 註冊失敗：{message} (email={email})")
            return jsonify({"error": message}), 400
        
        logger.info(f"✅ 註冊成功：email={email}, user_id={user_id}")
        return jsonify({"status": message})
    except Exception as e:
        error_msg = str(e)
        logger.error(f"❌ 註冊錯誤: {error_msg}", exc_info=True)
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(endpoint="/register", method="POST",
                       status_code=500, execution_time_ms=execution_time,
                       error_message=error_msg)
        # 返回更具體的錯誤訊息（不暴露敏感資訊）
        if "資料庫" in error_msg or "database" in error_msg.lower():
            return jsonify({"error": "資料庫連接錯誤，請稍後再試"}), 500
        else:
            return jsonify({"error": f"系統錯誤: {error_msg[:100]}"}), 500


@app.route("/login", methods=["POST"])
def login():
    """
    使用者登入
    ---
    tags:
      - 認證
    summary: 使用者登入
    description: 使用 Email 和密碼登入系統
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
            - password
          properties:
            email:
              type: string
              format: email
              example: user@example.com
              description: 使用者 Email
            password:
              type: string
              example: password123
              description: 使用者密碼
    responses:
      200:
        description: 登入成功
        schema:
          type: object
          properties:
            status:
              type: string
              example: logged_in
            email:
              type: string
              example: user@example.com
      401:
        description: 登入失敗（Email 或密碼錯誤）
        schema:
          type: object
          properties:
            error:
              type: string
              example: Email 或密碼錯誤
      500:
        description: 系統錯誤
    """
    start_time = datetime.now()
    try:
        data = request.json
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return jsonify({"error": "請輸入 Email 和密碼"}), 400
        
        # 檢查快取中的登入嘗試次數
        login_attempt_key = f"login_attempts:{email}"
        attempts = redis_manager.get(login_attempt_key) or 0
        if attempts >= 5:
            return jsonify({"error": "登入嘗試次數過多，請稍後再試"}), 429
        
        success, message, user_id, session_token = UserManager.login(
            email=email, password=password,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string if request.user_agent else None
        )
        
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/login", method="POST",
                       status_code=200 if success else 401, execution_time_ms=execution_time,
                       error_message=None if success else message)
        
        if not success:
            # 記錄失敗嘗試
            redis_manager.set(login_attempt_key, attempts + 1, expire=300)  # 5 分鐘過期
            return jsonify({"error": message}), 401
        
        # 清除登入嘗試記錄
        redis_manager.delete(login_attempt_key)
        
        session["user_id"] = user_id
        session["email"] = email
        return jsonify({"status": "logged_in", "email": email})
    except Exception as e:
        logger.error(f"❌ 登入錯誤: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


@app.route("/logout", methods=["GET", "POST"])
def logout():
    """
    使用者登出
    ---
    tags:
      - 認證
    summary: 使用者登出
    description: 登出當前使用者並清除 session
    security:
      - session: []
    responses:
      200:
        description: 登出成功
        schema:
          type: object
          properties:
            status:
              type: string
              example: logged_out
      500:
        description: 系統錯誤
    """
    start_time = datetime.now()
    user_id = get_user_id_from_session()
    try:
        if user_id:
            UserManager.logout(user_id=user_id)
        session.clear()
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/logout", method=request.method,
                       status_code=200, execution_time_ms=execution_time)
        return jsonify({"status": "logged_out"})
    except Exception as e:
        logger.error(f"❌ 登出錯誤: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


@app.route("/check-auth", methods=["GET"])
def check_auth():
    """
    檢查認證狀態
    ---
    tags:
      - 認證
    summary: 檢查使用者是否已登入
    description: 檢查當前 session 是否有效
    responses:
      200:
        description: 認證狀態
        schema:
          type: object
          properties:
            authenticated:
              type: boolean
              example: true
            email:
              type: string
              example: user@example.com
              description: 使用者 Email（僅在已登入時返回）
    """
    user_id = get_user_id_from_session()
    if user_id:
        try:
            user_info = UserManager.get_user_info(user_id)
            if user_info:
                return jsonify({
                    "authenticated": True,
                    "email": user_info.get("email") or session.get("email")
                })
        except Exception as e:
            logger.error(f"❌ 檢查認證失敗: {str(e)}")
    return jsonify({"authenticated": False})


@app.route("/user/profile", methods=["GET"])
def get_user_profile():
    """
    獲取使用者個人資料
    ---
    tags:
      - 使用者
    summary: 獲取當前使用者的個人資料
    description: 獲取已登入使用者的個人資料資訊
    security:
      - session: []
    responses:
      200:
        description: 個人資料
        schema:
          type: object
          properties:
            email:
              type: string
              example: user@example.com
            created_at:
              type: string
              format: date-time
              example: 2024-01-01T00:00:00
              description: 帳號創建時間
            last_login:
              type: string
              format: date-time
              example: 2024-01-01T12:00:00
              description: 最後登入時間
      401:
        description: 未登入
      404:
        description: 使用者不存在
      500:
        description: 系統錯誤
    """
    start_time = datetime.now()
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    try:
        user_info = UserManager.get_user_info(user_id)
        if not user_info:
            return jsonify({"error": "使用者不存在"}), 404
        created_at = user_info.get("created_at")
        last_login = user_info.get("last_login")
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/user/profile", method="GET",
                       status_code=200, execution_time_ms=execution_time)
        return jsonify({
            "email": user_info.get("email"),
            "created_at": created_at.isoformat() if created_at else "未記錄",
            "last_login": last_login.isoformat() if last_login else "未記錄"
        })
    except Exception as e:
        logger.error(f"❌ 獲取個人資料失敗: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


@app.route("/user/change-password", methods=["POST"])
def change_password():
    """
    修改密碼
    ---
    tags:
      - 使用者
    summary: 修改使用者密碼
    description: 使用舊密碼驗證後修改為新密碼
    security:
      - session: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - old_password
            - new_password
          properties:
            old_password:
              type: string
              example: oldpassword123
              description: 舊密碼
            new_password:
              type: string
              minLength: 6
              example: newpassword123
              description: 新密碼（至少 6 個字元）
    responses:
      200:
        description: 修改成功
        schema:
          type: object
          properties:
            status:
              type: string
              example: 密碼修改成功
      400:
        description: 修改失敗（舊密碼錯誤或新密碼不符合要求）
        schema:
          type: object
          properties:
            error:
              type: string
              example: 舊密碼錯誤
      401:
        description: 未登入
      500:
        description: 系統錯誤
    """
    start_time = datetime.now()
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    try:
        data = request.json
        old_password = data.get("old_password")
        new_password = data.get("new_password")
        if not old_password or not new_password:
            return jsonify({"error": "請輸入舊密碼和新密碼"}), 400
        success, message = UserManager.change_password(
            user_id=user_id, old_password=old_password,
            new_password=new_password, ip_address=request.remote_addr
        )
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/user/change-password", method="POST",
                       status_code=200 if success else 400, execution_time_ms=execution_time,
                       error_message=None if success else message)
        if not success:
            return jsonify({"error": message}), 400
        return jsonify({"status": message})
    except Exception as e:
        logger.error(f"❌ 修改密碼失敗: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


@app.route("/user/stats", methods=["GET"])
@cache.cached(timeout=300, key_prefix='user_stats')
def get_user_stats():
    """
    獲取使用者統計資料
    ---
    tags:
      - 使用者
    summary: 獲取使用者統計資料
    description: 獲取使用者的病害檢測統計資料（快取 5 分鐘）
    security:
      - session: []
    responses:
      200:
        description: 統計資料
        schema:
          type: object
          properties:
            total_detections:
              type: integer
              example: 25
              description: 總檢測次數
            disease_stats:
              type: object
              example: {"Leaf_Spot": 10, "Rust": 5, "Healthy": 10}
              description: 各病害統計
            severity_stats:
              type: object
              example: {"Mild": 5, "Moderate": 10, "Severe": 5}
              description: 嚴重程度統計
      401:
        description: 未登入
    """
    start_time = datetime.now()
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    try:
        # 使用快取鍵包含 user_id
        cache_key = f'user_stats:{user_id}'
        cached_result = redis_manager.get(cache_key)
        if cached_result:
            logger.debug(f"✅ 從快取獲取統計資料: user_id={user_id}")
            return jsonify(cached_result)
        
        disease_stats_list = DetectionQueries.get_disease_statistics(user_id)
        severity_stats_list = DetectionQueries.get_severity_distribution(user_id)
        disease_stats = {item['disease_name']: item['count'] for item in disease_stats_list}
        severity_stats = {item['severity']: item['count'] for item in severity_stats_list}
        total_detections = sum(disease_stats.values())
        
        result = {
            "total_detections": total_detections,
            "disease_stats": disease_stats,
            "severity_stats": severity_stats
        }
        
        # 快取結果 5 分鐘
        redis_manager.set(cache_key, result, expire=300)
        
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/user/stats", method="GET",
                       status_code=200, execution_time_ms=execution_time)
        return jsonify(result)
    except Exception as e:
        logger.error(f"❌ 獲取統計資料失敗: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


@app.route("/predict", methods=["POST"])
def predict():
    """
    病害檢測
    ---
    tags:
      - 檢測
    summary: 上傳圖片進行病害檢測
    description: 上傳葉片圖片，使用 AI 模型進行病害檢測
    security:
      - session: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - image
          properties:
            image:
              type: string
              format: base64
              description: Base64 編碼的圖片資料（可包含 data:image/jpeg;base64, 前綴）
              example: data:image/jpeg;base64,/9j/4AAQSkZJRg...
            source:
              type: string
              enum: [upload, camera, gallery]
              default: upload
              description: 圖片來源
    responses:
      200:
        description: 檢測成功
        schema:
          type: object
          properties:
            disease:
              type: string
              example: Leaf_Spot
              description: 檢測到的病害名稱
            severity:
              type: string
              example: Moderate
              description: 嚴重程度
            confidence:
              type: number
              format: float
              example: 0.95
              description: 置信度（0-1）
            image_path:
              type: string
              example: /static/uploads/xxx.jpg
              description: 圖片路徑
            disease_info:
              type: object
              description: 病害詳細資訊
            record_id:
              type: integer
              example: 123
              description: 檢測記錄 ID
            processing_time_ms:
              type: integer
              example: 500
              description: 處理時間（毫秒）
      400:
        description: 請求錯誤（無圖片資料或格式錯誤）
      401:
        description: 未登入
      500:
        description: 系統錯誤（模型未載入或其他錯誤）
    """
    start_time = datetime.now()
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    if not detection_service:
        return jsonify({"error": "模型未載入"}), 500
    try:
        img_data = request.json.get("image")
        image_source = request.json.get("source", "upload")
        if not img_data:
            return jsonify({"error": "無圖片資料"}), 400
        if "," in img_data:
            _, encoded = img_data.split(",", 1)
        else:
            encoded = img_data
        try:
            img_bytes = base64.b64decode(encoded)
        except Exception:
            return jsonify({"error": "圖片格式錯誤"}), 400
        processed_bytes, image_hash = ImageService.process_image(img_bytes, resize=True)
        
        # 檢查快取中是否有相同 hash 的結果
        cache_key = f"detection_result:{image_hash}:{user_id}"
        cached_result = redis_manager.get(cache_key)
        if cached_result:
            logger.info(f"✅ 從快取獲取檢測結果: hash={image_hash[:8]}...")
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                           status_code=200, execution_time_ms=execution_time)
            return jsonify(cached_result)
        
        import uuid
        filename = f"{uuid.uuid4()}.jpg"
        file_path = ImageService.save_image(processed_bytes, UPLOAD_FOLDER, filename)
        # 生成圖片 URL：使用 /uploads/ 路徑直接訪問
        web_image_path = f"/uploads/{filename}"
        # 保存到資料庫時使用相對路徑，而不是完整路徑
        result = detection_service.predict(
            image_path=file_path, user_id=user_id,
            image_source=image_source, image_hash=image_hash,
            web_image_path=web_image_path  # 傳遞 web 路徑用於保存到資料庫
        )
        # 如果圖片已存儲到資料庫，detection_service.predict 會返回 /image/{record_id}
        # 否則使用 web_image_path（但原檔可能已被刪除，所以優先使用資料庫圖片）
        if not result.get("image_from_db", False):
            result["image_path"] = web_image_path
        
        # 快取結果 1 小時
        redis_manager.set(cache_key, result, expire=3600)
        
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                       status_code=200, execution_time_ms=execution_time)
        return jsonify(result)
    except ValueError as e:
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                       status_code=400, execution_time_ms=execution_time, error_message=str(e))
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"❌ 預測錯誤: {str(e)}")
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                       status_code=500, execution_time_ms=execution_time, error_message=str(e))
        return jsonify({"error": "系統發生錯誤"}), 500


@app.route("/history", methods=["GET"])
def history():
    """
    獲取檢測歷史記錄
    ---
    tags:
      - 檢測
    summary: 獲取使用者的檢測歷史記錄
    description: 獲取當前使用者的所有病害檢測歷史記錄（最多 100 筆）
    security:
      - session: []
    responses:
      200:
        description: 歷史記錄列表
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
                example: 123
                description: 記錄 ID
              disease:
                type: string
                example: Leaf_Spot
                description: 病害名稱
              severity:
                type: string
                example: Moderate
                description: 嚴重程度
              confidence:
                type: number
                format: float
                example: 0.95
                description: 置信度（0-1）
              image_path:
                type: string
                example: /static/uploads/xxx.jpg
                description: 圖片路徑
              timestamp:
                type: string
                format: date-time
                example: 2024-01-01T12:00:00
                description: 檢測時間（ISO 格式）
              created_at:
                type: string
                format: date-time
                example: 2024-01-01T12:00:00
                description: 創建時間
      401:
        description: 未登入
      500:
        description: 系統錯誤
    """
    start_time = datetime.now()
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    try:
        records = DetectionQueries.get_user_detections(user_id, limit=100)
        logger.info(f"📊 查詢到 {len(records)} 筆檢測記錄 (user_id={user_id})")
        
        if not records:
            logger.info(f"ℹ️ 使用者 {user_id} 尚無檢測記錄")
            # 返回空數組，前端會顯示"尚無檢測紀錄"
            return jsonify([])
        
        formatted_records = []
        for record in records:
            created_at = record.get('created_at')
            image_path = record.get('image_path')
            
            # 處理圖片路徑：如果是完整路徑，轉換為相對路徑
            if image_path:
                if os.path.isabs(image_path) and '/uploads/' in image_path:
                    # 從完整路徑中提取 /uploads/filename 部分
                    uploads_index = image_path.find('/uploads/')
                    if uploads_index >= 0:
                        image_path = image_path[uploads_index:]
                elif not image_path.startswith('/uploads/'):
                    # 如果路徑不正確，嘗試從文件名構建
                    filename = os.path.basename(image_path)
                    image_path = f"/uploads/{filename}"
            
            # 檢查是否有壓縮存儲的圖片
            image_compressed = record.get('image_compressed', False)
            image_url = image_path  # 預設使用文件路徑
            if image_compressed:
                # 如果有壓縮存儲，使用資料庫圖片 API
                image_url = f"/image/{record.get('id')}"
            
            formatted_records.append({
                "id": record.get('id'),
                "disease": record.get('disease_name'),
                "severity": record.get('severity'),
                "confidence": float(record.get('confidence', 0)),
                "image_path": image_url,  # 使用資料庫圖片 URL 或文件路徑
                "image_compressed": image_compressed,  # 標記是否從資料庫讀取
                "timestamp": created_at.isoformat() if created_at else "剛剛",
                "created_at": created_at.isoformat() if created_at else None
            })
        execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
        log_api_request(user_id=user_id, endpoint="/history", method="GET",
                       status_code=200, execution_time_ms=execution_time)
        return jsonify(formatted_records)
    except Exception as e:
        logger.error(f"❌ 查詢歷史失敗: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


@app.route("/uploads/<filename>")
def serve_uploaded_file(filename):
    """
    提供上傳的圖片文件
    ---
    tags:
      - 檢測
    summary: 獲取上傳的圖片
    description: 提供已上傳的圖片文件訪問
    parameters:
      - in: path
        name: filename
        required: true
        type: string
        description: 圖片檔案名稱
    responses:
      200:
        description: 圖片文件
      404:
        description: 文件不存在
    """
    from flask import send_from_directory
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception as e:
        logger.error(f"❌ 提供圖片文件失敗: {str(e)}")
        return jsonify({"error": "文件不存在"}), 404


@app.route("/image/<int:record_id>")
def get_image_from_db(record_id):
    """
    從資料庫獲取圖片
    ---
    tags:
      - 檢測
    summary: 獲取資料庫中存儲的圖片
    description: 從 detection_records 表中獲取壓縮存儲的圖片
    parameters:
      - in: path
        name: record_id
        required: true
        type: integer
        description: 檢測記錄 ID
    responses:
      200:
        description: 圖片文件（JPEG 格式）
        headers:
          Content-Type:
            type: string
            example: image/jpeg
      404:
        description: 記錄不存在或圖片未存儲
      401:
        description: 未登入或無權限
    """
    from flask import Response
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    
    try:
        # 查詢記錄並驗證權限
        record = db.execute_query(
            """
            SELECT image_data, image_compressed, user_id 
            FROM detection_records 
            WHERE id = %s AND user_id = %s
            """,
            (record_id, user_id),
            fetch_one=True
        )
        
        if not record:
            return jsonify({"error": "記錄不存在或無權限"}), 404
        
        image_data = record[0]
        image_compressed = record[1]
        
        if not image_compressed or not image_data:
            # 如果資料庫中沒有圖片，嘗試從文件系統讀取
            record_path = db.execute_query(
                "SELECT image_path FROM detection_records WHERE id = %s",
                (record_id,),
                fetch_one=True
            )
            if record_path and record_path[0]:
                from flask import send_from_directory
                filename = os.path.basename(record_path[0])
                try:
                    return send_from_directory(UPLOAD_FOLDER, filename)
                except:
                    pass
            return jsonify({"error": "圖片未存儲在資料庫中"}), 404
        
        # 返回資料庫中的圖片
        return Response(
            image_data,
            mimetype='image/jpeg',
            headers={
                'Content-Disposition': f'inline; filename="image_{record_id}.jpg"',
                'Cache-Control': 'public, max-age=3600'
            }
        )
        
    except Exception as e:
        logger.error(f"❌ 獲取資料庫圖片失敗: {str(e)}", exc_info=True)
        return jsonify({"error": "獲取圖片失敗"}), 500


@app.route("/", methods=["GET"])
def index():
    """
    根路徑
    ---
    tags:
      - 檢測
    summary: API 狀態檢查
    description: 檢查 API 服務狀態
    responses:
      200:
        description: 服務正常
        schema:
          type: object
          properties:
            status:
              type: string
              example: ok
            message:
              type: string
              example: Leaf Disease AI backend (Local Development)
            version:
              type: string
              example: 2.0.0
            mode:
              type: string
              example: local
            redis:
              type: boolean
              example: true
              description: Redis 連接狀態
            swagger:
              type: string
              example: /api-docs
              description: Swagger 文檔路徑
    """
    redis_status = redis_manager.is_available()
    return jsonify({
        "status": "ok",
        "message": "Leaf Disease AI backend (Local Development)",
        "version": "2.0.0",
        "mode": "local",
        "redis": redis_status,
        "swagger": "/api-docs"
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

