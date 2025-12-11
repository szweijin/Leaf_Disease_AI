"""
業務服務模組
提供認證、檢測、圖片處理等業務邏輯服務
"""

from .service_auth import AuthService
from .service_cloudinary import init_cloudinary_storage
from .service_cnn import CNNClassifierService
from .service_image import ImageService
from .service_image_manager import ImageManager, init_image_manager
from .service_integrated import IntegratedDetectionService
from .service_integrated_api import IntegratedDetectionAPIService
from .service_user import UserService
from .service_yolo import DetectionService
from .service_yolo_api import DetectionAPIService

__all__ = [
    'AuthService',
    'init_cloudinary_storage',
    'CNNClassifierService',
    'ImageService',
    'ImageManager',
    'init_image_manager',
    'IntegratedDetectionService',
    'IntegratedDetectionAPIService',
    'UserService',
    'DetectionService',
    'DetectionAPIService',
]
