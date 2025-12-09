# app_config.py
# 應用程式配置和初始化

import os
import sys
import logging
from flask import Flask
from flask_caching import Cache
from flasgger import Swagger
from dotenv import load_dotenv
from config.development import DevelopmentConfig
from src.core.redis_manager import redis_manager
from src.services.detection_service import DetectionService
from src.services.integrated_detection_service import IntegratedDetectionService
from src.services.cloudinary_storage import init_cloudinary_storage

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_base_dir():
    """獲取專案根目錄"""
    # __file__ 是 backend/src/core/app_config.py
    # 需要上三層：core -> src -> backend -> 專案根目錄
    current_file = os.path.abspath(__file__)
    # 從 backend/src/core/app_config.py 到專案根目錄
    return os.path.abspath(os.path.join(os.path.dirname(current_file), '..', '..', '..'))


def setup_paths():
    """設定 Python 路徑"""
    BASE_DIR = get_base_dir()
    sys.path.insert(0, BASE_DIR)
    return BASE_DIR


def create_app():
    """創建並配置 Flask 應用程式"""
    # 載入環境變數
    load_dotenv()
    
    # 設定路徑
    BASE_DIR = setup_paths()
    
    # Flask 應用
    app = Flask(__name__)
    app.config.from_object(DevelopmentConfig)
    
    # 配置靜態文件服務：uploads 資料夾用於提供上傳的圖片
    app.static_folder = BASE_DIR
    app.static_url_path = ''
    
    # 驗證資料庫配置
    try:
        DevelopmentConfig.validate_db_config()
    except ValueError as e:
        logger.error(f"❌ 配置驗證失敗: {str(e)}")
        logger.error("   請確保 .env 檔案存在並包含所有必要的資料庫設定")
        raise
    
    # 驗證 Cloudinary 配置（如果啟用）
    try:
        DevelopmentConfig.validate_cloudinary_config()
    except ValueError as e:
        logger.warning(f"⚠️  Cloudinary 配置驗證失敗: {str(e)}")
        logger.warning("   將使用本地文件儲存")
    
    # 配置快取
    cache = setup_cache(app)
    
    # 配置 Swagger（從 config 讀取配置）
    setup_swagger(app, DevelopmentConfig)
    
    # 設定上傳資料夾（從 config 讀取路徑）
    upload_folder = setup_upload_folder(BASE_DIR, DevelopmentConfig)
    
    # 載入模型（從 config 讀取路徑）
    detection_service = load_model(BASE_DIR, DevelopmentConfig)
    integrated_service = load_integrated_models(BASE_DIR, DevelopmentConfig)
    
    # 初始化 Cloudinary（如果啟用）
    cloudinary_storage = setup_cloudinary(DevelopmentConfig)
    
    return app, cache, upload_folder, detection_service, integrated_service, cloudinary_storage


def setup_cache(app: Flask) -> Cache:
    """配置快取"""
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
    
    return cache


def setup_swagger(app: Flask, config) -> Swagger:
    """配置 Swagger 文檔（從 config 讀取配置）"""
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
    
    # 從 config 讀取 Swagger 配置
    swagger_host = getattr(config, 'SWAGGER_HOST', 'localhost:5000')
    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": getattr(config, 'SWAGGER_TITLE', 'Leaf Disease AI API'),
            "description": getattr(config, 'SWAGGER_DESCRIPTION', '葉片病害檢測 AI 系統 API 文檔'),
            "version": getattr(config, 'SWAGGER_VERSION', '2.0.0'),
            "contact": {
                "name": "Leaf Disease AI",
            }
        },
        "basePath": getattr(config, 'SWAGGER_BASE_PATH', '/'),
        "schemes": getattr(config, 'SWAGGER_SCHEMES', ['http']),
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
    
    # 只有在 host 不為 None 時才添加 host 欄位（生產環境可能不需要）
    if swagger_host is not None:
        swagger_template["host"] = swagger_host
    
    return Swagger(app, config=swagger_config, template=swagger_template)


def setup_upload_folder(base_dir: str, config) -> str:
    """設定上傳資料夾（從 config 讀取路徑）"""
    # 從 config 讀取上傳資料夾相對路徑
    upload_folder_relative = getattr(config, 'UPLOAD_FOLDER_RELATIVE', 'uploads')
    upload_folder = os.path.join(base_dir, upload_folder_relative)
    os.makedirs(upload_folder, exist_ok=True)
    
    # 確保 uploads 資料夾存在且可寫入
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder, exist_ok=True)
        logger.info(f"✅ 創建上傳資料夾: {upload_folder}")
    
    # 驗證資料夾權限
    if not os.access(upload_folder, os.W_OK):
        logger.warning(f"⚠️ 上傳資料夾不可寫入: {upload_folder}")
    else:
        logger.info(f"✅ 上傳資料夾已就緒: {upload_folder}")
    
    return upload_folder


def load_model(base_dir: str, config) -> DetectionService:
    """載入 YOLO 模型（從 config 讀取路徑）- 向後兼容"""
    # 從 config 讀取模型相對路徑
    model_path_relative = getattr(config, 'MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')
    model_path = os.path.join(base_dir, model_path_relative)
    
    try:
        detection_service = DetectionService(model_path)
        logger.info(f"✅ YOLO 模型載入成功: {model_path}")
        return detection_service
    except Exception as e:
        logger.error(f"❌ 無法載入 YOLO 模型: {str(e)}")
        return None


def load_integrated_models(base_dir: str, config) -> IntegratedDetectionService:
    """載入整合模型（CNN + YOLO）"""
    # 從 config 讀取模型相對路徑
    cnn_model_path_relative = getattr(config, 'CNN_MODEL_PATH_RELATIVE', 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth')
    yolo_model_path_relative = getattr(config, 'YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')
    
    cnn_model_path = os.path.join(base_dir, cnn_model_path_relative)
    yolo_model_path = os.path.join(base_dir, yolo_model_path_relative)
    
    try:
        integrated_service = IntegratedDetectionService(cnn_model_path, yolo_model_path)
        logger.info(f"✅ 整合檢測服務載入成功")
        logger.info(f"   CNN: {cnn_model_path}")
        logger.info(f"   YOLO: {yolo_model_path}")
        return integrated_service
    except Exception as e:
        logger.error(f"❌ 無法載入整合檢測服務: {str(e)}")
        return None


def setup_cloudinary(config):
    """設定 Cloudinary 儲存服務"""
    use_cloudinary = getattr(config, 'USE_CLOUDINARY', False)
    
    if not use_cloudinary:
        logger.info("ℹ️  Cloudinary 未啟用，使用本地文件儲存")
        return None
    
    try:
        cloud_name = getattr(config, 'CLOUDINARY_CLOUD_NAME', '')
        api_key = getattr(config, 'CLOUDINARY_API_KEY', '')
        api_secret = getattr(config, 'CLOUDINARY_API_SECRET', '')
        secure = getattr(config, 'CLOUDINARY_SECURE', True)
        
        if not cloud_name or not api_key or not api_secret:
            logger.warning("⚠️  Cloudinary 配置不完整，將使用本地文件儲存")
            logger.warning("   需要設定: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET")
            return None
        
        cloudinary_storage = init_cloudinary_storage(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=secure
        )
        logger.info("✅ Cloudinary 儲存服務初始化成功")
        return cloudinary_storage
        
    except Exception as e:
        logger.error(f"❌ Cloudinary 初始化失敗: {str(e)}")
        logger.error("   將使用本地文件儲存")
        return None

