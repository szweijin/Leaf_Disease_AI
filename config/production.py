"""
部署環境配置 (production deployment)
"""
import os
from config.base import Config

class ProductionConfig(Config):
    """生產環境特定配置"""
    # DEBUG 從環境變數讀取，生產環境必須為 False
    # DEBUG 已在 base.py 中從環境變數讀取
    TESTING = False
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
    
    # Swagger 配置（生產環境，可從環境變數覆蓋）
    SWAGGER_HOST = os.getenv('SWAGGER_HOST', None)  # 自動偵測
    SWAGGER_SCHEMES = os.getenv('SWAGGER_SCHEMES', 'https').split(',')  # 生產環境使用 HTTPS