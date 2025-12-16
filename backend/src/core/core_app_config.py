"""
應用程式配置和初始化
負責創建 Flask 應用程式並載入所有配置
"""

import os
import sys
import logging
from flask import Flask
from flask_caching import Cache
from flask_cors import CORS
from flasgger import Swagger
from dotenv import load_dotenv

# 先設置路徑，然後再導入 config
def _setup_import_paths():
    """在模組級別設置 Python 路徑，以便導入 config 模組"""
    current_file = os.path.abspath(__file__)
    # 從 backend/src/core/core_app_config.py 到專案根目錄
    base_dir = os.path.abspath(os.path.join(os.path.dirname(current_file), '..', '..', '..'))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
    return base_dir

# 設置路徑
base_dir = _setup_import_paths()

# 在導入 config 之前先載入 .env 檔案（重要！）
# 這樣 Config 類的屬性才能正確讀取環境變數
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(base_dir, '.env'))

# 現在可以導入 config 了
from config.development import DevelopmentConfig
from src.core.core_redis_manager import redis_manager
from src.services.service_yolo import DetectionService
from src.services.service_integrated import IntegratedDetectionService
from src.services.service_cloudinary import init_cloudinary_storage

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_base_dir():
    """
    獲取專案根目錄
    
    Returns:
        專案根目錄的絕對路徑
    """
    # __file__ 是 backend/src/core/core_app_config.py
    # 需要上三層：core -> src -> backend -> 專案根目錄
    current_file = os.path.abspath(__file__)
    # 從 backend/src/core/core_app_config.py 到專案根目錄
    return os.path.abspath(os.path.join(os.path.dirname(current_file), '..', '..', '..'))


def setup_paths():
    """
    設定 Python 路徑
    將專案根目錄添加到 Python 路徑中，以便導入模組
    """
    BASE_DIR = get_base_dir()
    sys.path.insert(0, BASE_DIR)
    return BASE_DIR


def create_app():
    """創建並配置 Flask 應用程式"""
    # 注意：環境變數已在模組級別載入，這裡不需要再次載入
    # 但為了確保，可以再次載入（不會有副作用）
    load_dotenv()
    
    # 設定路徑
    BASE_DIR = setup_paths()
    
    # Flask 應用
    app = Flask(__name__)
    app.config.from_object(DevelopmentConfig)
    
    # 確保 JSON 響應正確處理 Unicode 字符（中文）
    app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
    app.config['JSON_AS_ASCII'] = False  # 確保中文不被轉義為 \uXXXX 格式
    
    # 配置 CORS（跨域資源共享）
    # 允許前端（localhost:5173）訪問後端 API（localhost:5000）
    CORS(app, 
         origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # 允許的前端地址
         supports_credentials=True,  # 允許發送 cookies 和認證信息
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 允許的 HTTP 方法
         allow_headers=["Content-Type", "Authorization"])  # 允許的請求頭
    
    # 配置靜態文件服務：uploads 資料夾用於提供上傳的圖片
    app.static_folder = BASE_DIR
    app.static_url_path = ''
    
    # 驗證應用程式配置
    try:
        DevelopmentConfig.validate_app_config()
    except ValueError as e:
        logger.error(f"❌ 應用程式配置驗證失敗: {str(e)}")
        logger.error("   請確保 .env 檔案存在並包含所有必要的設定")
        raise
    
    # 驗證資料庫配置
    try:
        DevelopmentConfig.validate_db_config()
    except ValueError as e:
        logger.error(f"❌ 資料庫配置驗證失敗: {str(e)}")
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
    """
    配置快取
    設置 Flask-Caching，優先使用 Redis，否則使用簡單記憶體快取
    """
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
    """
    配置 Swagger 文檔
    從 config 讀取配置並設置 Swagger API 文檔
    """
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
    """
    設定上傳資料夾
    從 config 讀取路徑並創建上傳資料夾
    """
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
    """
    載入 YOLO 模型
    從 config 讀取路徑並載入 YOLO 模型（向後兼容）
    """
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
    """
    載入整合模型
    載入 CNN 和 YOLO 模型並創建整合檢測服務
    """
    # 從 config 讀取模型相對路徑
    cnn_model_path_relative = getattr(config, 'CNN_MODEL_PATH_RELATIVE', 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth')
    yolo_model_path_relative = getattr(config, 'YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')
    
    cnn_model_path = os.path.join(base_dir, cnn_model_path_relative)
    yolo_model_path = os.path.join(base_dir, yolo_model_path_relative)
    
    # 檢查模型文件是否存在
    if not os.path.exists(cnn_model_path):
        logger.error(f"❌ CNN 模型文件不存在: {cnn_model_path}")
        logger.error(f"   請檢查 CNN_MODEL_PATH_RELATIVE 配置或確保模型文件存在")
        return None
    
    if not os.path.exists(yolo_model_path):
        logger.error(f"❌ YOLO 模型文件不存在: {yolo_model_path}")
        logger.error(f"   請檢查 YOLO_MODEL_PATH_RELATIVE 配置或確保模型文件存在")
        return None
    
    logger.info(f"📦 開始載入整合檢測服務...")
    logger.info(f"   CNN 模型路徑: {cnn_model_path}")
    logger.info(f"   YOLO 模型路徑: {yolo_model_path}")
    
    try:
        integrated_service = IntegratedDetectionService(cnn_model_path, yolo_model_path)
        logger.info(f"✅ 整合檢測服務載入成功")
        logger.info(f"   CNN: {cnn_model_path}")
        logger.info(f"   YOLO: {yolo_model_path}")
        return integrated_service
    except FileNotFoundError as e:
        logger.error(f"❌ 模型文件未找到: {str(e)}")
        logger.error(f"   請確認模型文件路徑正確")
        import traceback
        logger.error(f"   錯誤堆疊:\n{traceback.format_exc()}")
        return None
    except Exception as e:
        logger.error(f"❌ 無法載入整合檢測服務: {str(e)}")
        import traceback
        logger.error(f"   錯誤堆疊:\n{traceback.format_exc()}")
        return None


def setup_cloudinary(config):
    """
    設定 Cloudinary 儲存服務
    從 config 讀取 Cloudinary 配置並初始化儲存服務
    """
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

