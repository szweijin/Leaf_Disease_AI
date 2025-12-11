"""
YOLO 工具函數模組
提供病害資訊查詢等工具函數
"""

import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def get_disease_info(disease_name: str) -> Optional[Dict[str, Any]]:
    """
    從資料庫或 JSON 檔案獲取病害詳細資訊
    
    Args:
        disease_name: 病害名稱
    
    Returns:
        病害資訊字典或 None
    """
    try:
        # 先嘗試從資料庫獲取
        try:
            from src.core.core_db_manager import db
            
            result = db.execute_query(
                """
                SELECT chinese_name, causes, features, pesticides, management_measures
                FROM disease_library
                WHERE disease_name = %s AND is_active = TRUE
                """,
                (disease_name,),
                fetch_one=True,
                dict_cursor=True
            )
            
            if result:
                return {
                    "name": result.get('chinese_name', disease_name),
                    "causes": result.get('causes', ''),
                    "feature": result.get('features', ''),
                    "solution": {
                        "pesticide": result.get('pesticides', []),
                        "management": result.get('management_measures', [])
                    }
                }
        except Exception as db_error:
            error_msg = str(db_error)
            logger.warning(f"⚠️ 從資料庫獲取病害資訊失敗: {error_msg}")
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.warning("   提示: disease_library 表不存在，將嘗試從 JSON 檔案讀取")
            # 繼續嘗試從 JSON 檔案讀取
        
        # 如果資料庫沒有，嘗試從 JSON 檔案讀取（向後兼容）
        disease_info_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "data", "disease_info.json"
        )
        
        if os.path.exists(disease_info_file):
            with open(disease_info_file, 'r', encoding='utf-8') as f:
                disease_db = json.load(f)
                if disease_name in disease_db:
                    info = disease_db[disease_name]
                    return {
                        "name": info.get("name", disease_name),
                        "causes": info.get("causes", ''),
                        "feature": info.get("feature", ''),
                        "solution": info.get("solution", {})
                    }
        
        return None
        
    except Exception as e:
        logger.error(f"❌ 獲取病害資訊失敗: {str(e)}")
        return None
