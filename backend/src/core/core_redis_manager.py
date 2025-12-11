# Redis 本地快取管理器

import redis
import json
import logging
import os
from typing import Optional, Any, Union
from functools import wraps
from datetime import timedelta

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RedisManager:
    """
    Redis 快取管理類
    用於本地端開發的快取服務
    """
    
    def __init__(self):
        """初始化 Redis 連接"""
        try:
            self.client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                db=int(os.getenv('REDIS_DB', 0)),
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # 測試連接
            self.client.ping()
            logger.info("✅ Redis 連接成功")
        except redis.ConnectionError as e:
            logger.warning(f"⚠️ Redis 連接失敗: {str(e)}，將使用記憶體快取")
            self.client = None
        except Exception as e:
            logger.error(f"❌ Redis 初始化錯誤: {str(e)}")
            self.client = None
    
    def is_available(self) -> bool:
        """檢查 Redis 是否可用"""
        if self.client is None:
            return False
        try:
            self.client.ping()
            return True
        except Exception:
            return False
    
    def get(self, key: str) -> Optional[Any]:
        """
        獲取快取值
        
        Args:
            key: 快取鍵
        
        Returns:
            快取值或 None
        """
        if not self.is_available():
            return None
        
        try:
            value = self.client.get(key)
            if value is None:
                return None
            
            # 嘗試解析 JSON
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        except Exception as e:
            logger.error(f"❌ Redis GET 錯誤: {str(e)}")
            return None
    
    def set(self, key: str, value: Any, expire: Optional[int] = None) -> bool:
        """
        設置快取值
        
        Args:
            key: 快取鍵
            value: 快取值
            expire: 過期時間（秒），None 表示不過期
        
        Returns:
            是否成功
        """
        if not self.is_available():
            return False
        
        try:
            # 嘗試序列化為 JSON
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)
            elif not isinstance(value, str):
                value = str(value)
            
            if expire:
                self.client.setex(key, expire, value)
            else:
                self.client.set(key, value)
            
            return True
        except Exception as e:
            logger.error(f"❌ Redis SET 錯誤: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        刪除快取鍵
        
        Args:
            key: 快取鍵
        
        Returns:
            是否成功
        """
        if not self.is_available():
            return False
        
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"❌ Redis DELETE 錯誤: {str(e)}")
            return False
    
    def exists(self, key: str) -> bool:
        """
        檢查鍵是否存在
        
        Args:
            key: 快取鍵
        
        Returns:
            是否存在
        """
        if not self.is_available():
            return False
        
        try:
            return self.client.exists(key) > 0
        except Exception as e:
            logger.error(f"❌ Redis EXISTS 錯誤: {str(e)}")
            return False
    
    def expire(self, key: str, seconds: int) -> bool:
        """
        設置鍵的過期時間
        
        Args:
            key: 快取鍵
            seconds: 過期時間（秒）
        
        Returns:
            是否成功
        """
        if not self.is_available():
            return False
        
        try:
            return self.client.expire(key, seconds)
        except Exception as e:
            logger.error(f"❌ Redis EXPIRE 錯誤: {str(e)}")
            return False
    
    def clear_pattern(self, pattern: str) -> int:
        """
        清除符合模式的所有鍵
        
        Args:
            pattern: 鍵的模式（如 'user:*'）
        
        Returns:
            清除的鍵數量
        """
        if not self.is_available():
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"❌ Redis CLEAR PATTERN 錯誤: {str(e)}")
            return 0
    
    def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """
        遞增計數器
        
        Args:
            key: 快取鍵
            amount: 遞增量
        
        Returns:
            遞增後的值或 None
        """
        if not self.is_available():
            return None
        
        try:
            return self.client.incrby(key, amount)
        except Exception as e:
            logger.error(f"❌ Redis INCREMENT 錯誤: {str(e)}")
            return None
    
    def get_hash(self, key: str, field: str) -> Optional[Any]:
        """
        獲取 Hash 欄位值
        
        Args:
            key: Hash 鍵
            field: 欄位名
        
        Returns:
            欄位值或 None
        """
        if not self.is_available():
            return None
        
        try:
            value = self.client.hget(key, field)
            if value is None:
                return None
            
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        except Exception as e:
            logger.error(f"❌ Redis HGET 錯誤: {str(e)}")
            return None
    
    def set_hash(self, key: str, field: str, value: Any) -> bool:
        """
        設置 Hash 欄位值
        
        Args:
            key: Hash 鍵
            field: 欄位名
            value: 欄位值
        
        Returns:
            是否成功
        """
        if not self.is_available():
            return False
        
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False)
            elif not isinstance(value, str):
                value = str(value)
            
            self.client.hset(key, field, value)
            return True
        except Exception as e:
            logger.error(f"❌ Redis HSET 錯誤: {str(e)}")
            return False
    
    def get_all_hash(self, key: str) -> Optional[dict]:
        """
        獲取整個 Hash
        
        Args:
            key: Hash 鍵
        
        Returns:
            Hash 字典或 None
        """
        if not self.is_available():
            return None
        
        try:
            return self.client.hgetall(key)
        except Exception as e:
            logger.error(f"❌ Redis HGETALL 錯誤: {str(e)}")
            return None


# 全局 Redis 實例
redis_manager = RedisManager()


def cache_result(key_prefix: str, expire: int = 3600):
    """
    快取裝飾器
    
    Args:
        key_prefix: 快取鍵前綴
        expire: 過期時間（秒）
    
    使用範例:
        @cache_result('user_profile', expire=1800)
        def get_user_profile(user_id):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 構建快取鍵
            cache_key = f"{key_prefix}:{':'.join(str(arg) for arg in args)}"
            if kwargs:
                cache_key += f":{':'.join(f'{k}={v}' for k, v in sorted(kwargs.items()))}"
            
            # 嘗試從快取獲取
            cached_value = redis_manager.get(cache_key)
            if cached_value is not None:
                logger.debug(f"✅ 快取命中: {cache_key}")
                return cached_value
            
            # 執行函數並快取結果
            result = func(*args, **kwargs)
            redis_manager.set(cache_key, result, expire=expire)
            logger.debug(f"✅ 結果已快取: {cache_key}")
            
            return result
        return wrapper
    return decorator

