"""
開發環境配置（local development）
"""
from config.base import Config

class DevelopmentConfig(Config):
    """開發環境特定配置（本地端使用）"""
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False
    
    # 本地端 Redis 配置
    REDIS_HOST = 'localhost'
    REDIS_PORT = 6379
    REDIS_DB = 0
    CACHE_DEFAULT_TIMEOUT = 1800  # 本地端快取 30 分鐘

