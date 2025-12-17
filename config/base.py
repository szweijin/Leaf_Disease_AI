"""
基礎應用配置 - 所有環境共用
"""
import os
from datetime import timedelta

def get_env_int(key: str, default: int) -> int:
    """
    安全地從環境變數獲取整數值
    如果環境變數不存在或為空字串，返回預設值
    
    Args:
        key: 環境變數名稱
        default: 預設值
        
    Returns:
        環境變數的整數值或預設值
    """
    value = os.getenv(key)
    if not value or value.strip() == '':
        return default
    try:
        return int(value)
    except ValueError:
        return default

class Config:
    """所有環境的基礎配置"""
    
    # 應用（必須從 .env 檔案設定）
    SECRET_KEY = os.getenv('SECRET_KEY', '')
    DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
    TESTING = False
    
    @classmethod
    def validate_secret_key(cls):
        """驗證 SECRET_KEY 是否設定"""
        if not cls.SECRET_KEY or cls.SECRET_KEY == 'your-secret-key-here' or cls.SECRET_KEY == 'dev-secret-key':
            raise ValueError(
                "SECRET_KEY 未設定或使用預設值，這在生產環境中是不安全的\n"
                "請在 .env 檔案中設定一個強隨機字串作為 SECRET_KEY"
            )
    
    # PostgreSQL - 必須從 .env 檔案設定
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = os.getenv('DB_PORT')  # 保持為字串，使用時轉換為 int
    DB_NAME = os.getenv('DB_NAME')
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    
    # 驗證必要的應用設定
    @classmethod
    def validate_app_config(cls):
        """驗證應用程式基本配置"""
        cls.validate_secret_key()
    
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
    REDIS_PORT = get_env_int('REDIS_PORT', 6379)
    REDIS_DB = get_env_int('REDIS_DB', 0)
    REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)
    CACHE_DEFAULT_TIMEOUT = get_env_int('CACHE_DEFAULT_TIMEOUT', 3600)  # 預設快取時間 1 小時
    
    # 會話（可從 .env 檔案設定）
    PERMANENT_SESSION_LIFETIME = timedelta(hours=get_env_int('PERMANENT_SESSION_LIFETIME_HOURS', 24))
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = os.getenv('SESSION_COOKIE_HTTPONLY', 'true').lower() == 'true'
    SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
    
    # 上傳（可從 .env 檔案設定）
    MAX_CONTENT_LENGTH = get_env_int('MAX_CONTENT_LENGTH', 5 * 1024 * 1024)  # 5MB
    UPLOAD_FOLDER_RELATIVE = os.getenv('UPLOAD_FOLDER_RELATIVE', 'uploads')  # 相對於專案根目錄的上傳資料夾
    ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif'}
    
    # Cloudinary 配置（必須從 .env 檔案設定）
    USE_CLOUDINARY = os.getenv('USE_CLOUDINARY', 'true').lower() == 'true'  # 預設啟用
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
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
    
    # AI 模型配置（可從 .env 檔案設定）
    CNN_MODEL_PATH_RELATIVE = os.getenv('CNN_MODEL_PATH_RELATIVE', 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth')  # CNN 模型路徑
    YOLO_MODEL_PATH_RELATIVE = os.getenv('YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')  # YOLO 模型路徑
    
    # 超解析度模型配置（可選，可從 .env 檔案設定）
    ENABLE_SR = os.getenv('ENABLE_SR', 'true').lower() == 'true'  # 是否啟用超解析度預處理
    SR_MODEL_PATH_RELATIVE = os.getenv('SR_MODEL_PATH_RELATIVE', None)  # 超解析度模型路徑（可選，如果為 None 則使用預設架構）
    SR_MODEL_TYPE = os.getenv('SR_MODEL_TYPE', 'edsr')  # 超解析度模型類型 ('edsr', 'rcan' 等)
    SR_SCALE = get_env_int('SR_SCALE', 2)  # 超解析度放大倍數 (2, 4, 8)
    
    # 向後兼容
    MODEL_PATH_RELATIVE = os.getenv('MODEL_PATH_RELATIVE', os.getenv('YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt'))  # 相對於專案根目錄的模型路徑
    
    # Swagger API 文檔配置（可從 .env 檔案設定）
    SWAGGER_TITLE = os.getenv('SWAGGER_TITLE', 'Leaf Disease AI API')
    SWAGGER_DESCRIPTION = os.getenv('SWAGGER_DESCRIPTION', '葉片病害檢測 AI 系統 API 文檔')
    SWAGGER_VERSION = os.getenv('SWAGGER_VERSION', '2.0.0')
    SWAGGER_HOST = os.getenv('SWAGGER_HOST', 'localhost:5000')  # 可在子類別中覆蓋
    SWAGGER_BASE_PATH = os.getenv('SWAGGER_BASE_PATH', '/')
    SWAGGER_SCHEMES = os.getenv('SWAGGER_SCHEMES', 'http').split(',')  # 生產環境可改為 'https'
    
    # 日誌（可從 .env 檔案設定）
    LOG_FILE = os.getenv('LOG_FILE', 'data/logs/app.log')
    LOG_MAX_SIZE = get_env_int('LOG_MAX_SIZE', 10485760)  # 10MB
    LOG_BACKUP_COUNT = get_env_int('LOG_BACKUP_COUNT', 10)
