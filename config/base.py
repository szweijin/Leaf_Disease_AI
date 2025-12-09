"""
基礎應用配置 - 所有環境共用
"""
import os
from datetime import timedelta

class Config:
    """所有環境的基礎配置"""
    
    # 應用
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DEBUG = False
    TESTING = False
    
    # PostgreSQL - 必須從 .env 檔案設定
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = os.getenv('DB_PORT')  # 保持為字串，使用時轉換為 int
    DB_NAME = os.getenv('DB_NAME')
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    
    # 驗證必要的資料庫設定
    @classmethod
    def validate_db_config(cls):
        """驗證資料庫配置是否完整"""
        missing = []
        if not cls.DB_HOST:
            missing.append('DB_HOST')
        if not cls.DB_PORT:
            missing.append('DB_PORT')
        elif not cls.DB_PORT.isdigit():
            raise ValueError(f"DB_PORT 必須是有效的數字，當前值: {cls.DB_PORT}")
        if not cls.DB_NAME:
            missing.append('DB_NAME')
        if not cls.DB_USER:
            missing.append('DB_USER')
        if not cls.DB_PASSWORD:
            missing.append('DB_PASSWORD')
        
        if missing:
            raise ValueError(
                f"缺少必要的資料庫環境變數: {', '.join(missing)}\n"
                f"請在 .env 檔案中設定這些變數"
            )

    # Redis 配置（本地端）
    REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
    REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
    REDIS_DB = int(os.getenv('REDIS_DB', 0))
    REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)
    CACHE_DEFAULT_TIMEOUT = 3600  # 預設快取時間 1 小時
    
    # 會話
    PERMANENT_SESSION_LIFETIME = timedelta(hours=1)
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # 上傳
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB
    UPLOAD_FOLDER_RELATIVE = 'uploads'  # 相對於專案根目錄的上傳資料夾
    ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif'}
    
    # Cloudinary 配置（強制啟用）
    USE_CLOUDINARY = os.getenv('USE_CLOUDINARY', 'true').lower() == 'true'  # 預設啟用
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', 'dcqts6ryi')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '398648383382972')
    CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')
    CLOUDINARY_SECURE = os.getenv('CLOUDINARY_SECURE', 'true').lower() == 'true'
    CLOUDINARY_FOLDER = os.getenv('CLOUDINARY_FOLDER', 'leaf_disease_ai')  # Cloudinary 資料夾路徑
    
    @classmethod
    def validate_cloudinary_config(cls):
        """驗證 Cloudinary 配置是否完整（如果啟用）"""
        if not cls.USE_CLOUDINARY:
            return True  # 如果未啟用，不需要驗證
        
        missing = []
        if not cls.CLOUDINARY_CLOUD_NAME:
            missing.append('CLOUDINARY_CLOUD_NAME')
        if not cls.CLOUDINARY_API_KEY:
            missing.append('CLOUDINARY_API_KEY')
        if not cls.CLOUDINARY_API_SECRET:
            missing.append('CLOUDINARY_API_SECRET')
        
        if missing:
            raise ValueError(
                f"Cloudinary 已啟用但缺少必要的配置: {', '.join(missing)}\n"
                f"請在 .env 檔案中設定這些變數，或設定 USE_CLOUDINARY=false 以使用本地儲存"
            )
    
    # AI 模型配置
    CNN_MODEL_PATH_RELATIVE = 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth'  # CNN 模型路徑
    YOLO_MODEL_PATH_RELATIVE = 'model/yolov11/best_v1_50.pt'  # YOLO 模型路徑
    
    # 向後兼容
    MODEL_PATH_RELATIVE = 'model/yolov11/best_v1_50.pt'  # 相對於專案根目錄的模型路徑
    
    # Swagger API 文檔配置
    SWAGGER_TITLE = 'Leaf Disease AI API'
    SWAGGER_DESCRIPTION = '葉片病害檢測 AI 系統 API 文檔'
    SWAGGER_VERSION = '2.0.0'
    SWAGGER_HOST = 'localhost:5000'  # 可在子類別中覆蓋
    SWAGGER_BASE_PATH = '/'
    SWAGGER_SCHEMES = ['http']  # 生產環境可改為 ['https']
    
    # 日誌
    LOG_FILE = 'data/logs/app.log'
    LOG_MAX_SIZE = 10485760  # 10MB
    LOG_BACKUP_COUNT = 10
