# db_manager.py
# PostgreSQL 資料庫連接管理器 - psycopg2

import psycopg2
import psycopg2.extras
from psycopg2 import pool
from contextlib import contextmanager
import logging
import os
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any, Tuple

load_dotenv()

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    PostgreSQL 資料庫管理類
    使用連接池，支援事務管理和錯誤處理
    """
    
    def __init__(self):
        """初始化資料庫連接池"""
        try:
            self.pool = psycopg2.pool.SimpleConnectionPool(
                minconn=2,
                maxconn=10,
                host=os.getenv('DB_HOST', 'localhost'),
                port=int(os.getenv('DB_PORT', 5432)),
                database=os.getenv('DB_NAME', 'leaf_disease_ai'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD', 'password')
            )
            logger.info("✅ 資料庫連接池建立成功")
        except Exception as e:
            logger.error(f"❌ 資料庫連接失敗: {str(e)}")
            raise
    
    @contextmanager
    def get_connection(self):
        """
        上下文管理器 - 自動處理連接獲取和釋放
        
        使用方式：
            with db.get_connection() as conn:
                cursor = conn.cursor()
                ...
        """
        conn = self.pool.getconn()
        try:
            yield conn
        except Exception as e:
            logger.error(f"❌ 連接錯誤: {str(e)}")
            raise
        finally:
            self.pool.putconn(conn)
    
    @contextmanager
    def get_cursor(self, dict_cursor: bool = False, commit: bool = True):
        """
        獲取遊標 - 自動處理事務
        
        Args:
            dict_cursor: 是否使用字典遊標（返回 dict 而非 tuple）
            commit: 是否自動提交事務
        
        使用方式：
            with db.get_cursor() as cursor:
                cursor.execute(sql, params)
        """
        with self.get_connection() as conn:
            if dict_cursor:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            else:
                cursor = conn.cursor()
            
            try:
                yield cursor
                if commit:
                    conn.commit()
                    logger.debug("✅ 事務已提交")
            except psycopg2.Error as e:
                conn.rollback()
                logger.error(f"❌ 事務回滾: {str(e)}")
                raise
            finally:
                cursor.close()
    
    def execute_query(self, sql: str, params: Tuple = None, fetch_one: bool = False, 
                     dict_cursor: bool = False) -> Any:
        """
        執行 SELECT 查詢
        
        Args:
            sql: SQL 查詢語句
            params: 參數元組
            fetch_one: 只返回第一條記錄
            dict_cursor: 使用字典遊標
        
        Returns:
            查詢結果
        
        示例：
            result = db.execute_query(
                "SELECT * FROM users WHERE email = %s",
                ("user@example.com",),
                fetch_one=True,
                dict_cursor=True
            )
        """
        try:
            with self.get_cursor(dict_cursor=dict_cursor, commit=False) as cursor:
                cursor.execute(sql, params or ())
                
                if fetch_one:
                    result = cursor.fetchone()
                    logger.debug(f"✅ 查詢完成 (1 條記錄)")
                    return result
                else:
                    result = cursor.fetchall()
                    logger.debug(f"✅ 查詢完成 ({len(result) if result else 0} 條記錄)")
                    return result
        except psycopg2.Error as e:
            logger.error(f"❌ 查詢錯誤: {str(e)}")
            raise
    
    def execute_update(self, sql: str, params: Tuple = None) -> int:
        """
        執行 INSERT/UPDATE/DELETE 操作
        
        Args:
            sql: SQL 語句
            params: 參數元組
        
        Returns:
            受影響的行數
        
        示例：
            rows = db.execute_update(
                "UPDATE users SET is_active = %s WHERE id = %s",
                (True, 1)
            )
        """
        try:
            with self.get_cursor() as cursor:
                cursor.execute(sql, params or ())
                rows_affected = cursor.rowcount
                logger.info(f"✅ 操作完成 ({rows_affected} 行受影響)")
                return rows_affected
        except psycopg2.Error as e:
            logger.error(f"❌ 更新錯誤: {str(e)}")
            raise
    
    def execute_returning(self, sql: str, params: Tuple = None, fetch_one: bool = True) -> Any:
        """
        執行 INSERT/UPDATE/DELETE RETURNING 操作
        
        Args:
            sql: SQL 語句（包含 RETURNING）
            params: 參數元組
            fetch_one: 只返回第一條記錄
        
        Returns:
            返回的資料
        
        示例：
            user_id = db.execute_returning(
                "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id",
                ("user@example.com", "hash"),
                fetch_one=True
            )[0]
        """
        try:
            with self.get_cursor() as cursor:
                cursor.execute(sql, params or ())
                
                if fetch_one:
                    result = cursor.fetchone()
                    logger.info(f"✅ 操作完成，返回記錄")
                    return result
                else:
                    result = cursor.fetchall()
                    logger.info(f"✅ 操作完成，返回 {len(result)} 條記錄")
                    return result
        except psycopg2.Error as e:
            logger.error(f"❌ RETURNING 操作失敗: {str(e)}")
            raise
    
    def execute_batch(self, sql: str, data_list: List[Tuple]) -> int:
        """
        批量插入操作（executemany）
        
        Args:
            sql: SQL 語句
            data_list: 資料列表
        
        Returns:
            插入的行數
        
        示例：
            data = [
                ("user1@example.com", "hash1"),
                ("user2@example.com", "hash2"),
                ("user3@example.com", "hash3"),
            ]
            db.execute_batch(
                "INSERT INTO users (email, password_hash) VALUES (%s, %s)",
                data
            )
        """
        try:
            with self.get_cursor() as cursor:
                cursor.executemany(sql, data_list)
                rows_affected = cursor.rowcount
                logger.info(f"✅ 批量插入完成 ({rows_affected} 行)")
                return rows_affected
        except psycopg2.Error as e:
            logger.error(f"❌ 批量插入失敗: {str(e)}")
            raise
    
    def call_function(self, func_name: str, params: Tuple = None, fetch_one: bool = True) -> Any:
        """
        呼叫 PostgreSQL 函數
        
        Args:
            func_name: 函數名稱
            params: 參數
            fetch_one: 只返回第一條記錄
        
        Returns:
            函數返回值
        
        示例：
            has_perm = db.call_function('has_permission', (user_id, 'view_logs'))
        """
        try:
            with self.get_cursor() as cursor:
                # 構建 SELECT 語句呼叫函數
                placeholders = ','.join(['%s'] * len(params)) if params else ''
                sql = f"SELECT {func_name}({placeholders})"
                
                cursor.execute(sql, params or ())
                
                if fetch_one:
                    result = cursor.fetchone()
                else:
                    result = cursor.fetchall()
                
                logger.info(f"✅ 函數 {func_name} 執行完成")
                return result
        except psycopg2.Error as e:
            logger.error(f"❌ 函數執行失敗: {str(e)}")
            raise
    
    def transaction(self, operations: List[Tuple[str, Tuple]]) -> bool:
        """
        執行事務性操作 - 全部成功或全部失敗
        
        Args:
            operations: 操作列表，每個元素是 (sql, params) 元組
        
        Returns:
            是否成功
        
        示例：
            success = db.transaction([
                ("UPDATE users SET role_id = %s WHERE id = %s", (2, 1)),
                ("INSERT INTO audit_logs ...", (...)),
            ])
        """
        with self.get_connection() as conn:
            try:
                with conn.cursor() as cursor:
                    for sql, params in operations:
                        cursor.execute(sql, params or ())
                
                conn.commit()
                logger.info(f"✅ 事務完成 ({len(operations)} 個操作)")
                return True
            except psycopg2.Error as e:
                conn.rollback()
                logger.error(f"❌ 事務失敗，已回滾: {str(e)}")
                return False
    
    def close_all(self):
        """關閉所有連接"""
        try:
            self.pool.closeall()
            logger.info("✅ 所有資料庫連接已關閉")
        except Exception as e:
            logger.error(f"❌ 關閉連接失敗: {str(e)}")
            raise


# 全局資料庫實例
db = DatabaseManager()


# ============================================================
# 日誌記錄模組
# ============================================================

class ActivityLogger:
    """活動日誌記錄"""
    
    @staticmethod
    def log_action(user_id: int, action_type: str, resource_type: str = None,
                   resource_id: int = None, action_details: dict = None, 
                   ip_address: str = None, user_agent: str = None) -> bool:
        """記錄使用者活動"""
        try:
            import json
            sql = """
                INSERT INTO activity_logs 
                (user_id, action_type, resource_type, resource_id, action_details, ip_address, user_agent, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (user_id, action_type, resource_type, resource_id, 
                 json.dumps(action_details or {}), ip_address, user_agent)
            )
            return True
        except Exception as e:
            logger.error(f"❌ 記錄活動失敗: {str(e)}")
            return False


class ErrorLogger:
    """錯誤日誌記錄"""
    
    @staticmethod
    def log_error(user_id: int = None, error_type: str = None, error_message: str = None,
                  error_code: str = None, severity: str = 'error', context: dict = None,
                  endpoint: str = None) -> bool:
        """記錄系統錯誤"""
        try:
            import json
            import traceback
            
            sql = """
                INSERT INTO error_logs 
                (user_id, error_type, error_message, error_code, severity, context, error_traceback, endpoint, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (user_id, error_type, error_message, error_code, severity,
                 json.dumps(context or {}), traceback.format_exc(), endpoint)
            )
            return True
        except Exception as e:
            logger.error(f"❌ 記錄錯誤失敗: {str(e)}")
            return False


class AuditLogger:
    """審計日誌記錄"""
    
    @staticmethod
    def log_operation(admin_id: int, operation_type: str, target_table: str,
                     target_id: int, old_values: dict = None, new_values: dict = None,
                     change_summary: str = None, ip_address: str = None) -> bool:
        """記錄審計操作"""
        try:
            import json
            
            sql = """
                INSERT INTO audit_logs 
                (admin_id, operation_type, target_table, target_id, old_values, new_values, change_summary, ip_address, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (admin_id, operation_type, target_table, target_id,
                 json.dumps(old_values or {}), json.dumps(new_values or {}),
                 change_summary, ip_address)
            )
            return True
        except Exception as e:
            logger.error(f"❌ 記錄審計日誌失敗: {str(e)}")
            return False


class APILogger:
    """API 日誌記錄"""
    
    @staticmethod
    def log_request(user_id: int = None, endpoint: str = None, method: str = None,
                   status_code: int = None, execution_time_ms: int = None,
                   ip_address: str = None, user_agent: str = None,
                   error_message: str = None, request_size: int = None,
                   response_size: int = None) -> bool:
        """記錄 API 請求"""
        try:
            sql = """
                INSERT INTO api_logs 
                (user_id, endpoint, method, status_code, execution_time_ms, ip_address, user_agent, error_message, request_body_size, response_body_size, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (user_id, endpoint, method, status_code, execution_time_ms,
                 ip_address, user_agent, error_message, request_size, response_size)
            )
            return True
        except Exception as e:
            logger.error(f"❌ 記錄 API 日誌失敗: {str(e)}")
            return False


class PerformanceLogger:
    """性能日誌記錄"""
    
    @staticmethod
    def log_performance(operation_name: str, execution_time_ms: int, status: str = 'success',
                       memory_used_mb: float = None, cpu_percentage: float = None,
                       details: dict = None) -> bool:
        """記錄性能指標"""
        try:
            import json
            
            sql = """
                INSERT INTO performance_logs 
                (operation_name, execution_time_ms, memory_used_mb, cpu_percentage, status, details, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (operation_name, execution_time_ms, memory_used_mb, cpu_percentage,
                 status, json.dumps(details or {}))
            )
            return True
        except Exception as e:
            logger.error(f"❌ 記錄性能日誌失敗: {str(e)}")
            return False
