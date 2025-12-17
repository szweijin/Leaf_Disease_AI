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
        
        # 檢查文件大小（模型文件應該至少幾 MB）
        file_size = os.path.getsize(model_path)
        if file_size < 1024:  # 小於 1KB 可能是損壞的文件
            raise ValueError(f"YOLO 模型文件大小異常（{file_size} bytes），可能已損壞: {model_path}")
        
        # 檢查文件是否為有效的 PyTorch 文件（檢查文件頭）
        with open(model_path, 'rb') as f:
            header = f.read(4)
            # PyTorch 文件通常以特定的魔術字節開頭
            # 如果文件以文本開頭（如 'v'），可能是損壞的
            if header.startswith(b'v') or header.startswith(b'PK'):
                # 'PK' 是 ZIP 格式（PyTorch 模型是 ZIP 格式）
                # 但如果是 'v' 開頭，可能是文本文件
                if header.startswith(b'v'):
                    raise ValueError(f"YOLO 模型文件格式異常，可能是文本文件而非模型文件: {model_path}")
        
        logger.info(f"📦 載入 YOLO 模型: {model_path} (大小: {file_size / 1024 / 1024:.2f} MB)")
        model = YOLO(model_path)
        logger.info(f"✅ YOLO 模型載入成功: {model_path}")
        
        return model
        
    except Exception as e:
        logger.error(f"❌ YOLO 模型載入失敗: {str(e)}")
        logger.error(f"   文件路徑: {model_path}")
        if os.path.exists(model_path):
            logger.error(f"   文件大小: {os.path.getsize(model_path)} bytes")
        raise
