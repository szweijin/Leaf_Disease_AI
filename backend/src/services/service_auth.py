"""
使用者認證服務
提供使用者註冊、登入、登出、認證檢查等功能
"""

from flask import request, jsonify, session
from datetime import datetime
from src.core.core_user_manager import UserManager
from src.core.core_redis_manager import redis_manager
from src.core.core_helpers import get_user_id_from_session, log_api_request
import logging

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AuthService:
    """認證服務類"""
    
    @staticmethod
    def register():
        """處理使用者註冊"""
        start_time = datetime.now()
        try:
            # 檢查請求內容類型
            if not request.is_json:
                logger.warning(f"⚠️ 註冊請求：Content-Type 不是 application/json")
                return jsonify({"error": "請求格式錯誤，請使用 JSON 格式"}), 400
            
            # 獲取 JSON 資料
            data = request.get_json(silent=True)
            if data is None:
                logger.warning(f"⚠️ 註冊請求：無法解析 JSON 資料")
                return jsonify({"error": "無法解析 JSON 資料"}), 400
            
            email = data.get("email")
            password = data.get("password")
            username = data.get("username")  # 獲取使用者名稱（暱稱）
            
            # 記錄請求資訊（不記錄密碼）
            logger.info(f"📝 註冊請求：email={email}, username={username}, IP={request.remote_addr}")
            
            if not email or not password:
                error_msg = "請輸入 Email 和密碼"
                logger.warning(f"⚠️ 註冊失敗：{error_msg}")
                return jsonify({"error": error_msg}), 400
            
            success, message, user_id = UserManager.register(
                email=email, password=password, username=username, ip_address=request.remote_addr
            )
            
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                            user_id=user_id, 
                            endpoint="/register", 
                            method="POST",
                            status_code=200 if success else 400, 
                            execution_time_ms=execution_time,
                            error_message=None if success else message
                            )
            
            if not success:
                logger.warning(f"⚠️ 註冊失敗：{message} (email={email})")
                return jsonify({"error": message}), 400
            
            logger.info(f"✅ 註冊成功：email={email}, user_id={user_id}")
            return jsonify({"status": message})
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 註冊錯誤: {error_msg}", exc_info=True)
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                            endpoint="/register", 
                            method="POST",
                            user_id=None,
                            status_code=500, 
                            execution_time_ms=execution_time,
                            error_message=error_msg
                            )
            # 返回更具體的錯誤訊息（不暴露敏感資訊）
            if "資料庫" in error_msg or "database" in error_msg.lower():
                return jsonify({"error": "資料庫連接錯誤，請稍後再試"}), 500
            else:
                return jsonify({"error": f"系統錯誤: {error_msg[:100]}"}), 500
    
    @staticmethod
    def login():
        """處理使用者登入"""
        start_time = datetime.now()
        try:
            # 檢查請求內容類型
            if not request.is_json:
                logger.warning(f"⚠️ 登入請求：Content-Type 不是 application/json")
                return jsonify({"error": "請求格式錯誤，請使用 JSON 格式"}), 400
            
            # 獲取 JSON 資料
            data = request.get_json(silent=True)
            if data is None:
                logger.warning(f"⚠️ 登入請求：無法解析 JSON 資料")
                return jsonify({"error": "無法解析 JSON 資料"}), 400
            
            email = data.get("email")
            password = data.get("password")
            
            # 記錄請求資訊（不記錄密碼）
            logger.info(f"📝 登入請求：email={email}, IP={request.remote_addr}")
            
            if not email or not password:
                error_msg = "請輸入 Email 和密碼"
                logger.warning(f"⚠️ 登入失敗：{error_msg}")
                return jsonify({"error": error_msg}), 400
            
            # 檢查快取中的登入嘗試次數
            login_attempt_key = f"login_attempts:{email}"
            attempts = redis_manager.get(login_attempt_key) or 0
            if attempts >= 5:
                return jsonify({"error": "登入嘗試次數過多，請稍後再試"}), 429
            
            success, message, user_id, session_token = UserManager.login(
                email=email, 
                password=password,
                ip_address=request.remote_addr,
                user_agent=request.user_agent.string if request.user_agent else None
            )
            
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/login", 
                method="POST",
                status_code=200 if success else 401, 
                execution_time_ms=execution_time,
                error_message=None if success else message
                )
            
            if not success:
                # 記錄失敗嘗試
                redis_manager.set(login_attempt_key, attempts + 1, expire=300)  # 5 分鐘過期
                return jsonify({"error": message}), 401
            
            # 清除登入嘗試記錄
            redis_manager.delete(login_attempt_key)
            
            session["user_id"] = user_id
            session["email"] = email
            return jsonify({"status": "logged_in", "email": email})
        except Exception as e:
            logger.error(f"❌ 登入錯誤: {str(e)}")
            return jsonify({"error": "系統錯誤"}), 500
    
    @staticmethod
    def logout():
        """處理使用者登出"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        try:
            if user_id:
                UserManager.logout(user_id=user_id)
            session.clear()
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/logout", 
                method=request.method,
                status_code=200, 
                execution_time_ms=execution_time,
                error_message=None
            )
            return jsonify({"status": "logged_out"})
        except Exception as e:
            logger.error(f"❌ 登出錯誤: {str(e)}")
            return jsonify({"error": "系統錯誤"}), 500
    
    @staticmethod
    def check_auth():
        """檢查認證狀態"""
        user_id = get_user_id_from_session()
        if user_id:
            try:
                user_info = UserManager.get_user_info(user_id)
                if user_info:
                    return jsonify({
                        "authenticated": True,
                        "email": user_info.get("email") or session.get("email")
                    })
            except Exception as e:
                logger.error(f"❌ 檢查認證失敗: {str(e)}")
        return jsonify({"authenticated": False})

