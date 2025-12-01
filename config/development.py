"""
開發環境配置
"""
from config.base import Config

class DevelopmentConfig(Config):
    """開發環境特定配置"""
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False
