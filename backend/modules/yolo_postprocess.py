"""
YOLO 後處理模組
負責處理 YOLO 檢測結果並轉換為可讀格式
"""

import logging
import io
from typing import Dict, Any, List, Optional
from PIL import Image, ImageDraw
import numpy as np

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


def draw_boxes_on_image(
    image_path: str,
    detections: List[Dict[str, Any]],
    line_width: int = 2,
    box_color: tuple = (255, 255, 0)  # 黃色框
) -> bytes:
    """
    在圖片上繪製檢測框（只繪製框，不添加文字）
    
    Args:
        image_path: 原始圖片路徑
        detections: 檢測結果列表，每個包含 'bbox' 欄位 [x1, y1, x2, y2]
        line_width: 框線寬度（預設 2，不要太粗）
        box_color: 框線顏色 RGB 元組（預設黃色）
    
    Returns:
        帶框圖片的位元組資料（JPEG 格式）
    """
    try:
        # 讀取原始圖片
        image = Image.open(image_path)
        # 確保是 RGB 模式
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 創建繪圖對象
        draw = ImageDraw.Draw(image)
        
        # 繪製每個檢測框
        for detection in detections:
            bbox = detection.get('bbox', [])
            if len(bbox) == 4:
                x1, y1, x2, y2 = bbox
                # 確保座標是整數
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                # 繪製矩形框（只繪製框，不添加文字）
                draw.rectangle(
                    [(x1, y1), (x2, y2)],
                    outline=box_color,
                    width=line_width
                )
        
        # 將圖片轉換為位元組
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='JPEG', quality=95)
        img_bytes.seek(0)
        
        return img_bytes.getvalue()
        
    except Exception as e:
        logger.error(f"❌ 繪製檢測框失敗: {str(e)}")
        raise


def draw_boxes_on_image_from_bytes(
    image_bytes: bytes,
    detections: List[Dict[str, Any]],
    line_width: int = 2,
    box_color: tuple = (255, 255, 0)  # 黃色框
) -> bytes:
    """
    在圖片位元組上繪製檢測框（只繪製框，不添加文字）
    
    Args:
        image_bytes: 原始圖片位元組
        detections: 檢測結果列表，每個包含 'bbox' 欄位 [x1, y1, x2, y2]
        line_width: 框線寬度（預設 2，不要太粗）
        box_color: 框線顏色 RGB 元組（預設黃色）
    
    Returns:
        帶框圖片的位元組資料（JPEG 格式）
    """
    try:
        # 從位元組讀取圖片
        image = Image.open(io.BytesIO(image_bytes))
        # 確保是 RGB 模式
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 創建繪圖對象
        draw = ImageDraw.Draw(image)
        
        # 繪製每個檢測框
        for detection in detections:
            bbox = detection.get('bbox', [])
            if len(bbox) == 4:
                x1, y1, x2, y2 = bbox
                # 確保座標是整數
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                # 繪製矩形框（只繪製框，不添加文字）
                draw.rectangle(
                    [(x1, y1), (x2, y2)],
                    outline=box_color,
                    width=line_width
                )
        
        # 將圖片轉換為位元組
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='JPEG', quality=95)
        img_bytes.seek(0)
        
        return img_bytes.getvalue()
        
    except Exception as e:
        logger.error(f"❌ 繪製檢測框失敗: {str(e)}")
        raise
