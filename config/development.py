"""
開發環境配置（local development）
"""
import os
from config.base import Config, get_env_int

class DevelopmentConfig(Config):
    """開發環境特定配置（本地端使用）"""
    # DEBUG 從環境變數讀取，預設為 True（開發環境）
    # DEBUG 已在 base.py 中從環境變數讀取
    TESTING = False
    SESSION_COOKIE_SECURE = False
    
    # 本地端 Redis 配置（可從環境變數覆蓋）
    REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
    REDIS_PORT = get_env_int('REDIS_PORT', 6379)
    REDIS_DB = get_env_int('REDIS_DB', 0)
    CACHE_DEFAULT_TIMEOUT = get_env_int('CACHE_DEFAULT_TIMEOUT', 1800)  # 本地端快取 30 分鐘

