"""
部署環境配置 (production deployment)
"""
from config.base import Config

class ProductionConfig(Config):
    """生產環境特定配置"""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
