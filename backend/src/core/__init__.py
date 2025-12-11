"""
核心模組
提供應用程式配置、資料庫管理、Redis 快取、使用者管理等核心功能
"""

from .core_app_config import create_app
from .core_db_manager import db, ActivityLogger, ErrorLogger, AuditLogger, APILogger, PerformanceLogger
from .core_helpers import get_user_id_from_session, log_api_request
from .core_redis_manager import redis_manager
from .core_user_manager import UserManager, DetectionQueries, LogQueries

__all__ = [
    'create_app',
    'db',
    'ActivityLogger',
    'ErrorLogger',
    'AuditLogger',
    'APILogger',
    'PerformanceLogger',
    'get_user_id_from_session',
    'log_api_request',
    'redis_manager',
    'UserManager',
    'DetectionQueries',
    'LogQueries',
]
