# helpers.py
# 核心輔助函數集合

from flask import request, session
from src.core.db_manager import db, APILogger
from typing import Optional
import logging

logger = logging.getLogger(__name__)


# ==================== 認證相關輔助函數 ====================

def get_user_id_from_session():
    """從 session 獲取使用者 ID"""
    if "user_id" not in session:
        return None
    try:
        result = db.execute_query(
            "SELECT id FROM users WHERE id = %s AND is_active = TRUE",
            (session["user_id"],),
            fetch_one=True
        )
        return result[0] if result else None
    except Exception as e:
        logger.error(f"❌ 獲取使用者 ID 失敗: {str(e)}")
        return None


# ==================== API 日誌記錄輔助函數 ====================

def log_api_request(
    user_id: Optional[int] = None,
    endpoint: Optional[str] = None,
    method: Optional[str] = None,
    status_code: Optional[int] = None,
    execution_time_ms: Optional[int] = None,
    error_message: Optional[str] = None
):
    """記錄 API 請求日誌"""
    try:
        APILogger.log_request(
            user_id=user_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            execution_time_ms=execution_time_ms,
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string if request.user_agent else None,
            error_message=error_message
        )
    except Exception as e:
        logger.error(f"❌ 記錄 API 日誌失敗: {str(e)}")

