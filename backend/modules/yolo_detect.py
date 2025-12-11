"""
YOLO 檢測模組
負責執行 YOLO 模型檢測
"""

import os
import logging
from typing import List, Any

logger = logging.getLogger(__name__)


def yolo_detect(model, image_path: str) -> List[Any]:
    """
    執行 YOLO 檢測
    
    Args:
        model: 已載入的 YOLO 模型
        image_path: 圖片檔案路徑
    
    Returns:
        YOLO 檢測結果列表
    """
    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"圖片檔案不存在: {image_path}")
        
        # 執行 YOLO 檢測
        results = model(image_path)
        
        return results
        
    except Exception as e:
        logger.error(f"❌ YOLO 檢測失敗: {str(e)}")
        raise
