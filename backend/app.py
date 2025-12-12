"""
Flask 應用程式主文件
定義所有 API 路由和端點
"""

from flask import Flask, jsonify, send_from_directory
from flask_caching import Cache
import logging
import os

# 導入配置和服務
from src.core.core_app_config import create_app
from src.core.core_redis_manager import redis_manager
from src.services.service_auth import AuthService
from src.services.service_user import UserService
from src.services.service_yolo_api import DetectionAPIService
from src.services.service_integrated_api import IntegratedDetectionAPIService
from src.services.service_image_manager import init_image_manager

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 創建應用程式和服務
app, cache, upload_folder, detection_service, integrated_service, cloudinary_storage = create_app()

# 初始化圖片管理器（支援 Cloudinary）
from config.development import DevelopmentConfig
use_cloudinary = getattr(DevelopmentConfig, 'USE_CLOUDINARY', False)
cloudinary_folder = getattr(DevelopmentConfig, 'CLOUDINARY_FOLDER', 'leaf_disease_ai')
image_manager = init_image_manager(
    upload_folder,
    temp_file_ttl_hours=24,
    cloudinary_storage=cloudinary_storage,
    use_cloudinary=use_cloudinary and cloudinary_storage is not None,
    cloudinary_folder=cloudinary_folder
)

# 應用啟動時清理過期暫存文件
try:
    cleaned_count = image_manager.cleanup_old_temp_files()
    if cleaned_count > 0:
        logger.info(f"🧹 應用啟動時清理了 {cleaned_count} 個過期暫存文件")
except Exception as e:
    logger.warning(f"⚠️  清理過期暫存文件時出錯: {str(e)}")

# 初始化服務實例
auth_service = AuthService()
user_service = UserService()
yolo_api_service = DetectionAPIService(detection_service, upload_folder)
integrated_api_service = IntegratedDetectionAPIService(integrated_service, image_manager) if integrated_service else None


# ==================== 認證相關路由 ====================

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
    return auth_service.register()


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
      405:
        description: 方法不允許（應使用 POST 方法）
      500:
        description: 系統錯誤
    """
    return auth_service.login()


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
    return auth_service.logout()


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
    return auth_service.check_auth()


# ==================== 使用者相關路由 ====================

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
    return user_service.get_profile()


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
    return user_service.change_password()


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
    return user_service.get_stats()


# ==================== 檢測相關路由 ====================

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
    # 使用整合檢測服務（如果可用），否則使用舊的檢測服務
    if integrated_api_service:
        return integrated_api_service.predict()
    else:
        return yolo_api_service.predict()


@app.route("/api/predict", methods=["POST"])
def api_predict():
    """
    整合檢測 API（CNN + YOLO）
    ---
    tags:
      - 檢測
    summary: 上傳圖片進行整合檢測（CNN 分類 + YOLO 檢測）
    description: 使用 CNN 分類圖片類型，然後根據結果決定是否執行 YOLO 檢測
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
              description: Base64 編碼的圖片資料
            source:
              type: string
              enum: [upload, camera, gallery]
              default: upload
    responses:
      200:
        description: 檢測成功
      401:
        description: 未登入
      500:
        description: 系統錯誤
    """
    if not integrated_api_service:
        return jsonify({"error": "整合檢測服務未載入"}), 500
    return integrated_api_service.predict()


@app.route("/api/predict-crop", methods=["POST"])
def api_predict_crop():
    """
    裁切後重新檢測
    ---
    tags:
      - 檢測
    summary: 使用裁切後的圖片重新執行檢測
    description: 當 CNN 分類為 whole_plant 時，使用者裁切圖片後重新檢測
    security:
      - session: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - prediction_id
            - crop_coordinates
            - cropped_image
          properties:
            prediction_id:
              type: string
              format: uuid
            crop_coordinates:
              type: object
            cropped_image:
              type: string
              format: base64
    responses:
      200:
        description: 檢測成功
      401:
        description: 未登入
      500:
        description: 系統錯誤
    """
    if not integrated_api_service:
        return jsonify({"error": "整合檢測服務未載入"}), 500
    return integrated_api_service.predict_with_crop()


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
    return yolo_api_service.get_history()


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
    return yolo_api_service.serve_uploaded_file(filename)


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
    return yolo_api_service.get_image_from_db(record_id)


@app.route("/image/prediction/<prediction_id>")
def get_prediction_image(prediction_id):
    """
    從資料庫獲取預測記錄圖片
    ---
    tags:
      - 檢測
    summary: 獲取 prediction_log 中存儲的圖片
    description: 從 prediction_log 表中獲取壓縮存儲的圖片
    parameters:
      - in: path
        name: prediction_id
        required: true
        type: string
        format: uuid
        description: 預測記錄 ID (UUID)
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
    from flask import Response, redirect
    from src.core.core_helpers import get_user_id_from_session
    from src.core.core_db_manager import db
    
    user_id = get_user_id_from_session()
    if not user_id:
        return jsonify({"error": "請先登入"}), 401
    
    try:
        # 查詢記錄並驗證權限（只查詢圖片路徑）
        record = db.execute_query(
            """
            SELECT image_path, user_id 
            FROM prediction_log 
            WHERE id = %s AND user_id = %s
            """,
            (prediction_id, user_id),
            fetch_one=True
        )
        
        if not record:
            return jsonify({"error": "記錄不存在或無權限"}), 404
        
        image_path = record[0]
        
        # 如果 image_path 是 Cloudinary URL，重定向到該 URL
        if image_path and (image_path.startswith('http://') or image_path.startswith('https://')):
            logger.debug(f"✅ 重定向到 Cloudinary URL: {image_path}")
            return redirect(image_path, code=302)
        
        # 如果是資料庫 URL（/image/prediction/xxx），返回錯誤（圖片應在 Cloudinary）
        if image_path and image_path.startswith('/image/'):
            logger.warning(f"⚠️  圖片路徑指向資料庫 URL，但圖片應在 Cloudinary: prediction_id={prediction_id}")
            return jsonify({"error": "圖片未找到，請檢查 Cloudinary 配置"}), 404
        
        # 嘗試從本地文件系統讀取（向後兼容）
        if image_path:
            filename = os.path.basename(image_path)
            try:
                logger.debug(f"📁 嘗試從文件系統讀取圖片: {filename}")
                return send_from_directory(upload_folder, filename)
            except Exception as file_error:
                logger.warning(f"⚠️  從文件系統讀取失敗: {str(file_error)}")
        
        return jsonify({"error": "圖片未找到"}), 404
        
    except Exception as e:
        logger.error(f"❌ 獲取預測圖片失敗: {str(e)}")
        return jsonify({"error": "系統錯誤"}), 500


# ==================== 系統路由 ====================

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
