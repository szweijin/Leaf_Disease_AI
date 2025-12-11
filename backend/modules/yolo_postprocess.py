"""
YOLO 後處理模組
負責處理 YOLO 檢測結果並轉換為可讀格式
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


def postprocess_yolo_result(results: List[Any]) -> Dict[str, Any]:
    """
    後處理 YOLO 檢測結果
    
    Args:
        results: YOLO 檢測結果列表
    
    Returns:
        包含以下欄位的字典：
        - detections: 檢測結果列表（每個包含 class, confidence, bbox）
        - detected: 是否檢測到病害
        - raw_output: 原始模型輸出
    """
    try:
        if not results or len(results) == 0:
            return {
                'detections': [],
                'detected': False,
                'raw_output': {"boxes": [], "message": "No results"}
            }
        
        # 獲取第一個結果（通常只有一張圖片）
        result = results[0]
        boxes = result.boxes
        
        detections = []
        raw_output = {
            "boxes": [],
            "names": result.names
        }
        
        if len(boxes) == 0:
            # 沒有檢測到病害
            return {
                'detections': [],
                'detected': False,
                'raw_output': {"boxes": [], "message": "No disease detected", "names": result.names}
            }
        
        # 處理每個檢測框
        for box in boxes:
            cls_id = int(box.cls)
            confidence = float(box.conf)
            class_name = result.names[cls_id]
            
            detections.append({
                'class': class_name,
                'confidence': confidence,
                'bbox': box.xyxy.tolist() if hasattr(box.xyxy, 'tolist') else []
            })
            
            raw_output["boxes"].append({
                "cls": cls_id,
                "conf": confidence,
                "xyxy": box.xyxy.tolist() if hasattr(box.xyxy, 'tolist') else []
            })
        
        return {
            'detections': detections,
            'detected': len(detections) > 0,
            'raw_output': raw_output
        }
        
    except Exception as e:
        logger.error(f"❌ YOLO 後處理失敗: {str(e)}")
        raise


def parse_severity(disease_name: str) -> str:
    """
    從病害名稱解析嚴重程度
    
    Args:
        disease_name: 病害名稱
    
    Returns:
        嚴重程度 ('Mild', 'Moderate', 'Severe', 'Healthy', 'Unknown')
    """
    # 簡單規則：根據命名或預設值
    if disease_name == "Healthy":
        return "Healthy"
    
    # 可以根據實際模型輸出調整
    # 目前先返回 Unknown，後續可根據實際需求調整
    return "Unknown"
