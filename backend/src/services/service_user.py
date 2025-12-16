"""
使用者個人資料服務
提供使用者個人資料相關功能（get_profile, change_password, get_stats）
"""

from flask import request, jsonify
from datetime import datetime
from src.core.core_user_manager import UserManager, DetectionQueries
from src.core.core_helpers import get_user_id_from_session, log_api_request
from src.core.core_db_manager import db
from src.core.core_redis_manager import redis_manager
import logging

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UserService:
    """使用者服務類"""
    
    @staticmethod
    def get_profile():
        """獲取使用者個人資料"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        try:
            user_info = UserManager.get_user_info(user_id)
            if not user_info:
                return jsonify({"error": "使用者不存在"}), 404
            created_at = user_info.get("created_at")
            last_login = user_info.get("last_login")
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/user/profile", 
                method="GET",
                status_code=200, 
                execution_time_ms=execution_time,
                error_message=None
            )
            return jsonify({
                "email": user_info.get("email"),
                "username": user_info.get("username"),
                "created_at": created_at.isoformat() if created_at else "未記錄",
                "last_login": last_login.isoformat() if last_login else "未記錄"
            })
        except Exception as e:
            logger.error(f"❌ 獲取個人資料失敗: {str(e)}")
            return jsonify({"error": "系統錯誤"}), 500
    
    @staticmethod
    def change_password():
        """修改密碼"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        try:
            data = request.json
            old_password = data.get("old_password")
            new_password = data.get("new_password")
            if not old_password or not new_password:
                return jsonify({"error": "請輸入舊密碼和新密碼"}), 400
            success, message = UserManager.change_password(
                user_id=user_id, 
                old_password=old_password,
                new_password=new_password, 
                ip_address=request.remote_addr
            )
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/user/change-password", 
                method="POST",
                status_code=200 if success else 400, 
                execution_time_ms=execution_time,
                error_message=None if success else message
            )
            if not success:
                return jsonify({"error": message}), 400
            return jsonify({"status": message})
        except Exception as e:
            logger.error(f"❌ 修改密碼失敗: {str(e)}")
            return jsonify({"error": "系統錯誤"}), 500
    
    @staticmethod
    def update_profile():
        """更新使用者個人資料"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        try:
            # 檢查請求內容類型
            if not request.is_json:
                logger.warning(f"⚠️ 更新個人資料請求：Content-Type 不是 application/json")
                return jsonify({"error": "請求格式錯誤，請使用 JSON 格式"}), 400
            
            # 獲取 JSON 資料
            data = request.get_json(silent=True)
            if data is None:
                logger.warning(f"⚠️ 更新個人資料請求：無法解析 JSON 資料")
                return jsonify({"error": "無法解析 JSON 資料"}), 400
            
            username = data.get("username")
            
            if not username:
                return jsonify({"error": "請輸入使用者名稱"}), 400
            
            # 檢查使用者名稱是否已被其他使用者使用
            try:
                existing_user = db.execute_query(
                    "SELECT id FROM users WHERE username = %s AND id != %s",
                    (username, user_id),
                    fetch_one=True
                )
                if existing_user:
                    return jsonify({"error": "該使用者名稱已被使用"}), 400
            except Exception as e:
                logger.error(f"❌ 檢查使用者名稱失敗: {str(e)}")
                return jsonify({"error": "系統錯誤"}), 500
            
            success, message = UserManager.update_user_info(
                user_id=user_id,
                username=username
            )
            
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id,
                endpoint="/user/update-profile",
                method="POST",
                status_code=200 if success else 400,
                execution_time_ms=execution_time,
                error_message=None if success else message
            )
            
            if not success:
                return jsonify({"error": message}), 400
            return jsonify({"status": message})
        except Exception as e:
            logger.error(f"❌ 更新個人資料失敗: {str(e)}")
            return jsonify({"error": "系統錯誤"}), 500
    
    @staticmethod
    def get_stats():
        """獲取使用者統計資料"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        try:
            # 使用快取鍵包含 user_id
            cache_key = f'user_stats:{user_id}'
            cached_result = redis_manager.get(cache_key)
            if cached_result:
                logger.debug(f"✅ 從快取獲取統計資料: user_id={user_id}")
                return jsonify(cached_result)
            
            disease_stats_list = DetectionQueries.get_disease_statistics(user_id)
            severity_stats_list = DetectionQueries.get_severity_distribution(user_id)
            disease_stats = {item['disease_name']: item['count'] for item in disease_stats_list}
            severity_stats = {item['severity']: item['count'] for item in severity_stats_list}
            total_detections = sum(disease_stats.values())
            
            result = {
                "total_detections": total_detections,
                "disease_stats": disease_stats,
                "severity_stats": severity_stats
            }
            
            # 快取結果 5 分鐘
            redis_manager.set(cache_key, result, expire=300)
            
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/user/stats", 
                method="GET",
                status_code=200, 
                execution_time_ms=execution_time,
                error_message=None
            )
            return jsonify(result)
        except Exception as e:
            logger.error(f"❌ 獲取統計資料失敗: {str(e)}")
            return jsonify({"error": "系統錯誤"}), 500

