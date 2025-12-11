"""
YOLO 模型載入模組
負責載入 YOLO 模型
"""

import os
import logging
from ultralytics import YOLO

logger = logging.getLogger(__name__)


def load_yolo_model(model_path: str):
    """
    載入 YOLO 模型
    
    Args:
        model_path: YOLO 模型路徑 (.pt 檔案)
    
    Returns:
        載入完成的 YOLO 模型
    """
    try:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO 模型檔案不存在: {model_path}")
        
        model = YOLO(model_path)
        logger.info(f"✅ YOLO 模型載入成功: {model_path}")
        
        return model
        
    except Exception as e:
        logger.error(f"❌ YOLO 模型載入失敗: {str(e)}")
        raise
