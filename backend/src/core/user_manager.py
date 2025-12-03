# user_manager.py
# 使用者管理模組 - psycopg2 實現

from src.core.db_manager import db, ActivityLogger, ErrorLogger, AuditLogger
from werkzeug.security import generate_password_hash, check_password_hash
import logging
import re
from datetime import datetime, timedelta
import secrets
from typing import Tuple, Optional, Dict, List, Any

logger = logging.getLogger(__name__)


class UserManager:
    """使用者管理類"""
    
    # ==================== 驗證方法 ====================
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """驗證郵箱格式"""
        pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
        return re.match(pattern, email) is not None
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, str]:
        """
        驗證密碼複雜度
        
        要求：
        - 至少 8 個字符
        - 至少 1 個大寫字母
        - 至少 1 個小寫字母
        - 至少 1 個數字
        """
        if len(password) < 8:
            return False, "密碼長度需至少 8 碼"
        if not re.search(r"[A-Z]", password):
            return False, "密碼需包含至少一個大寫字母 (A-Z)"
        if not re.search(r"[a-z]", password):
            return False, "密碼需包含至少一個小寫字母 (a-z)"
        if not re.search(r"[0-9]", password):
            return False, "密碼需包含至少一個數字 (0-9)"
        return True, "密碼符合要求"
    
    # ==================== 註冊與登入 ====================
    
    @staticmethod
    def register(email: str, password: str, full_name: str = None, 
                ip_address: str = None) -> Tuple[bool, str, Optional[int]]:
        """
        註冊新使用者
        
        Args:
            email: 使用者郵箱
            password: 密碼
            full_name: 全名
            ip_address: IP 地址（用於日誌）
        
        Returns:
            (success, message, user_id)
        
        示例：
            success, msg, user_id = UserManager.register(
                "user@example.com",
                "SecurePass123",
                "John Doe"
            )
        """
        # 1. 驗證郵箱
        if not UserManager.validate_email(email):
            return False, "郵箱格式不正確", None
        
        # 2. 檢查郵箱是否已存在
        try:
            result = db.execute_query(
                "SELECT id FROM users WHERE email = %s",
                (email,),
                fetch_one=True
            )
            if result:
                logger.warning(f"⚠️ 註冊失敗: 郵箱已存在 ({email})")
                return False, "該郵箱已被註冊", None
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢郵箱失敗: {error_msg}", exc_info=True)
            # 返回更具體的錯誤訊息
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                return False, "資料庫表不存在，請執行資料庫初始化", None
            elif "connection" in error_msg.lower() or "could not connect" in error_msg.lower():
                return False, "無法連接到資料庫，請稍後再試", None
            else:
                return False, f"資料庫查詢錯誤: {error_msg[:100]}", None
        
        # 3. 驗證密碼
        is_valid, msg = UserManager.validate_password(password)
        if not is_valid:
            return False, msg, None
        
        # 4. 加密密碼並插入資料庫
        try:
            password_hash = generate_password_hash(password)
            full_name_value = full_name or email
            
            logger.debug(f"準備插入使用者: email={email}, full_name={full_name_value}")
            
            sql = """
                INSERT INTO users (email, password_hash, full_name, role_id, created_at)
                VALUES (%s, %s, %s, 1, NOW())
                RETURNING id;
            """
            
            result = db.execute_returning(sql, (email, password_hash, full_name_value))
            if not result or len(result) == 0:
                logger.error("❌ INSERT 操作未返回 user_id")
                return False, "註冊失敗：無法獲取使用者 ID", None
            
            user_id = result[0]
            logger.debug(f"使用者插入成功，user_id={user_id}")
            
            # 5. 記錄活動日誌（失敗不影響註冊流程）
            try:
                ActivityLogger.log_action(
                    user_id=user_id,
                    action_type='user_created',
                    resource_type='user',
                    resource_id=user_id,
                    action_details={'method': 'self_registration', 'email': email},
                    ip_address=ip_address
                )
            except Exception as log_error:
                logger.warning(f"⚠️ 記錄活動日誌失敗（不影響註冊）: {str(log_error)}")
            
            logger.info(f"✅ 使用者 {email} 註冊成功 (ID: {user_id})")
            return True, "註冊成功！", user_id
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 註冊失敗: {error_msg}", exc_info=True)
            
            # 嘗試記錄錯誤日誌（失敗不影響錯誤返回）
            try:
                ErrorLogger.log_error(
                    error_type='DatabaseError',
                    error_message=f'使用者註冊失敗: {error_msg}',
                    severity='error'
                )
            except Exception as log_error:
                logger.warning(f"⚠️ 記錄錯誤日誌失敗: {str(log_error)}")
            
            # 返回更具體的錯誤訊息
            error_msg_lower = error_msg.lower()
            if "duplicate key" in error_msg_lower or "unique constraint" in error_msg_lower or "already exists" in error_msg_lower:
                return False, "該郵箱已被註冊", None
            elif "connection" in error_msg_lower or "could not connect" in error_msg_lower or "timeout" in error_msg_lower:
                return False, "無法連接到資料庫，請稍後再試", None
            elif "null value" in error_msg_lower or "not null" in error_msg_lower:
                return False, "註冊資料不完整，請檢查輸入", None
            elif "foreign key" in error_msg_lower:
                return False, "資料庫設定錯誤，請聯繫管理員", None
            else:
                # 返回具體錯誤，但限制長度並過濾敏感資訊
                safe_error = error_msg[:150].replace('\n', ' ').replace('\r', ' ')
                return False, f"註冊失敗: {safe_error}", None
    
    @staticmethod
    def login(email: str, password: str, ip_address: str = None, 
             user_agent: str = None) -> Tuple[bool, str, Optional[int], Optional[str]]:
        """
        使用者登入
        
        Args:
            email: 使用者郵箱
            password: 密碼
            ip_address: IP 地址
            user_agent: User Agent 字串
        
        Returns:
            (success, message, user_id, session_token)
        
        示例：
            success, msg, user_id, token = UserManager.login(
                "user@example.com",
                "SecurePass123",
                "192.168.1.1"
            )
        """
        try:
            # 1. 查詢使用者
            result = db.execute_query(
                "SELECT id, password_hash, is_active, role_id FROM users WHERE email = %s",
                (email,),
                fetch_one=True,
                dict_cursor=True
            )
            
            if not result:
                logger.warning(f"❌ 登入失敗: 使用者不存在 ({email})")
                ErrorLogger.log_error(
                    error_type='AuthenticationError',
                    error_message='使用者不存在',
                    context={'email': email},
                    severity='warning'
                )
                return False, "帳號或密碼錯誤", None, None
            
            user_id = result['id']
            password_hash = result['password_hash']
            is_active = result['is_active']
            
            # 2. 檢查帳戶是否停用
            if not is_active:
                logger.warning(f"❌ 登入失敗: 帳戶已停用 ({email})")
                ErrorLogger.log_error(
                    user_id=user_id,
                    error_type='AuthenticationError',
                    error_message='帳戶已被停用',
                    severity='warning'
                )
                return False, "帳戶已被停用", None, None
            
            # 3. 驗證密碼
            if not check_password_hash(password_hash, password):
                logger.warning(f"❌ 登入失敗: 密碼錯誤 ({email})")
                ErrorLogger.log_error(
                    user_id=user_id,
                    error_type='AuthenticationError',
                    error_message='登入密碼錯誤',
                    severity='warning',
                    context={'email': email}
                )
                return False, "帳號或密碼錯誤", None, None
            
            # 4. 更新登入時間和計數
            db.execute_update(
                "UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = %s",
                (user_id,)
            )
            
            # 5. 建立會話
            session_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)
            
            db.execute_update(
                """
                INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at, is_active)
                VALUES (%s, %s, %s, %s, %s, TRUE)
                """,
                (user_id, session_token, ip_address, user_agent, expires_at)
            )
            
            # 6. 記錄活動日誌
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='login',
                action_details={'email': email},
                ip_address=ip_address,
                user_agent=user_agent
            )
            
            logger.info(f"✅ 使用者 {email} 登入成功 (ID: {user_id})")
            return True, "登入成功", user_id, session_token
            
        except Exception as e:
            logger.error(f"❌ 登入錯誤: {str(e)}")
            ErrorLogger.log_error(
                error_type='DatabaseError',
                error_message=f'登入失敗: {str(e)}',
                severity='error'
            )
            return False, "系統錯誤", None, None
    
    @staticmethod
    def logout(user_id: int, session_token: str = None) -> bool:
        """
        使用者登出
        
        Args:
            user_id: 使用者 ID
            session_token: 會話令牌
        
        Returns:
            是否成功
        """
        try:
            if session_token:
                db.execute_update(
                    "UPDATE sessions SET is_active = FALSE WHERE user_id = %s AND session_token = %s",
                    (user_id, session_token)
                )
            else:
                db.execute_update(
                    "UPDATE sessions SET is_active = FALSE WHERE user_id = %s",
                    (user_id,)
                )
            
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='logout'
            )
            
            logger.info(f"✅ 使用者 ID {user_id} 已登出")
            return True
        except Exception as e:
            logger.error(f"❌ 登出失敗: {str(e)}")
            return False
    
    # ==================== 密碼管理 ====================
    
    @staticmethod
    def change_password(user_id: int, old_password: str, new_password: str,
                       ip_address: str = None) -> Tuple[bool, str]:
        """
        修改密碼
        
        Args:
            user_id: 使用者 ID
            old_password: 舊密碼
            new_password: 新密碼
            ip_address: IP 地址（用於審計）
        
        Returns:
            (success, message)
        """
        try:
            # 1. 查詢使用者
            result = db.execute_query(
                "SELECT password_hash FROM users WHERE id = %s",
                (user_id,),
                fetch_one=True
            )
            
            if not result:
                return False, "使用者不存在"
            
            password_hash = result[0]
            
            # 2. 驗證舊密碼
            if not check_password_hash(password_hash, old_password):
                ErrorLogger.log_error(
                    user_id=user_id,
                    error_type='AuthenticationError',
                    error_message='修改密碼: 舊密碼不正確',
                    severity='warning'
                )
                return False, "舊密碼不正確"
            
            # 3. 驗證新密碼複雜度
            is_valid, msg = UserManager.validate_password(new_password)
            if not is_valid:
                return False, msg
            
            # 4. 確認新密碼與舊密碼不同
            if old_password == new_password:
                return False, "新密碼不能與舊密碼相同"
            
            # 5. 更新密碼
            new_hash = generate_password_hash(new_password)
            db.execute_update(
                "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s",
                (new_hash, user_id)
            )
            
            # 6. 記錄活動日誌
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='password_change',
                ip_address=ip_address
            )
            
            logger.info(f"✅ 使用者 ID {user_id} 已修改密碼")
            return True, "密碼已成功更新"
            
        except Exception as e:
            logger.error(f"❌ 修改密碼失敗: {str(e)}")
            ErrorLogger.log_error(
                user_id=user_id,
                error_type='DatabaseError',
                error_message=f'修改密碼失敗: {str(e)}',
                severity='error'
            )
            return False, "系統錯誤"
    
    # ==================== 權限檢查 ====================
    
    @staticmethod
    def has_permission(user_id: int, permission_name: str) -> bool:
        """
        檢查使用者是否有特定權限
        
        Args:
            user_id: 使用者 ID
            permission_name: 權限名稱
        
        Returns:
            是否有權限
        
        示例：
            if UserManager.has_permission(user_id, 'view_logs'):
                # 顯示日誌
                pass
        """
        try:
            # 使用 PostgreSQL 函數
            result = db.call_function('has_permission', (user_id, permission_name))
            return result[0] if result else False
        except Exception as e:
            logger.error(f"❌ 權限檢查失敗: {str(e)}")
            return False
    
    # ==================== 使用者資訊 ====================
    
    @staticmethod
    def get_user_info(user_id: int) -> Optional[Dict[str, Any]]:
        """
        獲取使用者資訊
        
        Args:
            user_id: 使用者 ID
        
        Returns:
            使用者資訊字典或 None
        """
        try:
            sql = """
                SELECT u.id, u.email, u.full_name, u.username, r.role_name,
                       u.created_at, u.last_login, u.login_count, u.is_active
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE u.id = %s
            """
            result = db.execute_query(sql, (user_id,), fetch_one=True, dict_cursor=True)
            if not result:
                logger.debug(f"使用者 ID {user_id} 不存在")
            return result
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 獲取使用者資訊失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: users 或 roles 表不存在，請執行: python scripts/init_database.py")
            return None
    
    @staticmethod
    def update_user_info(user_id: int, **kwargs) -> Tuple[bool, str]:
        """
        更新使用者資訊
        
        Args:
            user_id: 使用者 ID
            **kwargs: 要更新的欄位
        
        Returns:
            (success, message)
        
        示例：
            success, msg = UserManager.update_user_info(
                user_id=1,
                full_name="New Name",
                username="newuser"
            )
        """
        try:
            allowed_fields = {'full_name', 'username', 'profile_data'}
            update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields}
            
            if not update_fields:
                return False, "沒有有效的更新欄位"
            
            # 建立 UPDATE 語句
            set_clause = ", ".join([f"{k} = %s" for k in update_fields.keys()])
            sql = f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s"
            
            values = tuple(update_fields.values()) + (user_id,)
            db.execute_update(sql, values)
            
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='profile_update',
                resource_type='user',
                resource_id=user_id,
                action_details=update_fields
            )
            
            logger.info(f"✅ 使用者 ID {user_id} 的資訊已更新")
            return True, "個人資訊已更新"
            
        except Exception as e:
            logger.error(f"❌ 更新使用者資訊失敗: {str(e)}")
            return False, "系統錯誤"
    
    # ==================== 管理員操作 ====================
    
    @staticmethod
    def assign_role(admin_id: int, user_id: int, role_id: int, 
                   ip_address: str = None) -> Tuple[bool, str]:
        """
        分配角色（管理員操作）
        
        Args:
            admin_id: 管理員 ID
            user_id: 目標使用者 ID
            role_id: 角色 ID
            ip_address: IP 地址
        
        Returns:
            (success, message)
        """
        try:
            # 檢查管理員權限
            if not UserManager.has_permission(admin_id, 'manage_users'):
                return False, "您沒有權限執行此操作"
            
            # 獲取舊角色
            old_role = db.execute_query(
                "SELECT role_id FROM users WHERE id = %s",
                (user_id,),
                fetch_one=True
            )
            
            # 更新角色
            db.execute_update(
                "UPDATE users SET role_id = %s, updated_at = NOW() WHERE id = %s",
                (role_id, user_id)
            )
            
            # 記錄審計日誌
            AuditLogger.log_operation(
                admin_id=admin_id,
                operation_type='role_assigned',
                target_table='users',
                target_id=user_id,
                old_values={'role_id': old_role[0] if old_role else None},
                new_values={'role_id': role_id},
                change_summary=f'角色已從 {old_role[0]} 更改為 {role_id}',
                ip_address=ip_address
            )
            
            logger.info(f"✅ 使用者 ID {user_id} 的角色已更改為 {role_id}")
            return True, "角色已分配"
            
        except Exception as e:
            logger.error(f"❌ 分配角色失敗: {str(e)}")
            ErrorLogger.log_error(
                user_id=admin_id,
                error_type='DatabaseError',
                error_message=f'分配角色失敗: {str(e)}',
                severity='error'
            )
            return False, "系統錯誤"
    
    @staticmethod
    def deactivate_user(admin_id: int, user_id: int, reason: str = None,
                       ip_address: str = None) -> Tuple[bool, str]:
        """
        停用使用者帳戶（管理員操作）
        
        Args:
            admin_id: 管理員 ID
            user_id: 目標使用者 ID
            reason: 停用原因
            ip_address: IP 地址
        
        Returns:
            (success, message)
        """
        try:
            # 檢查管理員權限
            if not UserManager.has_permission(admin_id, 'manage_users'):
                return False, "您沒有權限執行此操作"
            
            db.execute_update(
                "UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = %s",
                (user_id,)
            )
            
            # 記錄審計日誌
            AuditLogger.log_operation(
                admin_id=admin_id,
                operation_type='user_deactivated',
                target_table='users',
                target_id=user_id,
                old_values={'is_active': True},
                new_values={'is_active': False},
                change_summary=f'帳戶已停用。原因: {reason or "未指定"}',
                ip_address=ip_address
            )
            
            logger.info(f"✅ 使用者 ID {user_id} 的帳戶已停用")
            return True, "帳戶已停用"
            
        except Exception as e:
            logger.error(f"❌ 停用帳戶失敗: {str(e)}")
            return False, "系統錯誤"


# ============================================================
# 查詢示例
# ============================================================

class DetectionQueries:
    """檢測相關查詢"""
    
    @staticmethod
    def get_user_detections(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """獲取使用者檢測歷史"""
        sql = """
            SELECT id, disease_name, severity, confidence, image_path,
                   created_at, status, processing_time_ms, image_compressed
            FROM detection_records
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """
        try:
            result = db.execute_query(sql, (user_id, limit), dict_cursor=True)
            logger.info(f"📊 查詢檢測歷史: user_id={user_id}, 返回 {len(result) if result else 0} 筆記錄")
            if result:
                logger.debug(f"   第一筆記錄範例: {list(result[0].keys()) if result else '無'}")
                logger.debug(f"   第一筆記錄內容: {result[0] if result else '無'}")
            else:
                logger.info(f"   ℹ️ 使用者 {user_id} 尚無檢測記錄")
            return result if result else []
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢檢測歷史失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: detection_records 表不存在，請執行: python scripts/init_database.py")
            return []
    
    @staticmethod
    def get_disease_statistics(user_id: int) -> List[Dict[str, Any]]:
        """獲取使用者病害統計"""
        sql = """
            SELECT 
                disease_name,
                COUNT(*) as count,
                AVG(confidence)::numeric(5,4) as avg_confidence,
                MAX(confidence)::numeric(5,4) as max_confidence
            FROM detection_records
            WHERE user_id = %s AND status = 'completed'
            GROUP BY disease_name
            ORDER BY count DESC
        """
        try:
            result = db.execute_query(sql, (user_id,), dict_cursor=True)
            return result if result else []
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢病害統計失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: detection_records 表不存在，請執行: python scripts/init_database.py")
            return []
    
    @staticmethod
    def get_severity_distribution(user_id: int) -> List[Dict[str, Any]]:
        """獲取嚴重程度分佈"""
        sql = """
            SELECT severity, COUNT(*) as count
            FROM detection_records
            WHERE user_id = %s AND status = 'completed'
            GROUP BY severity
        """
        try:
            result = db.execute_query(sql, (user_id,), dict_cursor=True)
            return result if result else []
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢嚴重程度分佈失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: detection_records 表不存在，請執行: python scripts/init_database.py")
            return []


class LogQueries:
    """日誌查詢"""
    
    @staticmethod
    def get_activity_logs(days: int = 7, limit: int = 100) -> List[Dict[str, Any]]:
        """獲取最近活動日誌"""
        sql = """
            SELECT al.id, u.email, al.action_type, al.resource_type,
                   al.action_details, al.ip_address, al.created_at
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.created_at >= NOW() - INTERVAL '%s days'
            ORDER BY al.created_at DESC
            LIMIT %s
        """
        try:
            # 注意：天數需要直接插入，不能參數化（使用 psycopg2.extensions.quote_ident 更安全）
            with db.get_cursor(dict_cursor=True, commit=False) as cursor:
                # 使用參數化查詢更安全
                safe_sql = sql.replace('%s days', f'{days} days').replace('LIMIT %s', f'LIMIT {limit}')
                cursor.execute(safe_sql)
                result = cursor.fetchall()
                return result if result else []
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢活動日誌失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: activity_logs 表不存在，請執行: python scripts/init_database.py")
            return []
    
    @staticmethod
    def get_error_logs_unresolved(limit: int = 100) -> List[Dict[str, Any]]:
        """獲取未解決的錯誤"""
        sql = """
            SELECT id, error_type, error_message, severity, endpoint,
                   created_at, error_traceback
            FROM error_logs
            WHERE is_resolved = FALSE
            ORDER BY created_at DESC
            LIMIT %s
        """
        try:
            result = db.execute_query(sql, (limit,), dict_cursor=True)
            return result if result else []
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢未解決的錯誤失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: error_logs 表不存在，請執行: python scripts/init_database.py")
            return []
    
    @staticmethod
    def get_api_performance(hours: int = 24) -> List[Dict[str, Any]]:
        """獲取 API 性能統計"""
        sql = """
            SELECT 
                endpoint,
                method,
                COUNT(*) as call_count,
                ROUND(AVG(execution_time_ms)::numeric) as avg_time_ms,
                MAX(execution_time_ms) as max_time_ms,
                MIN(execution_time_ms) as min_time_ms,
                COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
            FROM api_logs
            WHERE created_at >= NOW() - INTERVAL '%s hours'
            GROUP BY endpoint, method
            ORDER BY avg_time_ms DESC
        """
        try:
            # 使用安全的字串格式化（hours 是整數，相對安全）
            safe_sql = sql.replace('%s hours', f'{hours} hours')
            with db.get_cursor(dict_cursor=True, commit=False) as cursor:
                cursor.execute(safe_sql)
                result = cursor.fetchall()
                return result if result else []
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 查詢 API 性能失敗: {error_msg}", exc_info=True)
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: api_logs 表不存在，請執行: python scripts/init_database.py")
            return []
