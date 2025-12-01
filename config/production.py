"""
生產環境配置
"""
from config.base import Config

class ProductionConfig(Config):
    """生產環境特定配置"""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
