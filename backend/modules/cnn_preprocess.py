"""
CNN 圖片預處理模組
負責圖片的前處理轉換
"""

import os
from io import BytesIO
from PIL import Image
from torchvision import transforms
import torch
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def get_cnn_transform():
    """
    獲取 CNN 圖片預處理轉換（與訓練時一致）
    
    Returns:
        transforms.Compose 轉換物件
    """
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])


def preprocess_image(image_path: str, transform: Optional[transforms.Compose] = None, device: Optional[str] = None) -> torch.Tensor:
    """
    從圖片路徑預處理圖片
    
    Args:
        image_path: 圖片檔案路徑
        transform: 預處理轉換（如果為 None，使用預設轉換）
        device: 設備 ('cuda', 'cpu', 或 None 自動選擇)
    
    Returns:
        預處理後的圖片張量（已添加 batch 維度並移到指定設備）
    """
    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"圖片檔案不存在: {image_path}")
        
        # 使用預設轉換或提供的轉換
        if transform is None:
            transform = get_cnn_transform()
        
        # 自動選擇設備
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # 載入並預處理圖片
        image = Image.open(image_path).convert('RGB')
        input_tensor = transform(image).unsqueeze(0)  # 添加 batch 維度
        input_tensor = input_tensor.to(device)
        
        return input_tensor
        
    except Exception as e:
        logger.error(f"❌ CNN 圖片預處理失敗: {str(e)}")
        raise


def preprocess_image_from_bytes(image_bytes: bytes, transform: Optional[transforms.Compose] = None, device: Optional[str] = None) -> torch.Tensor:
    """
    從圖片位元組預處理圖片
    
    Args:
        image_bytes: 圖片位元組資料
        transform: 預處理轉換（如果為 None，使用預設轉換）
        device: 設備 ('cuda', 'cpu', 或 None 自動選擇)
    
    Returns:
        預處理後的圖片張量（已添加 batch 維度並移到指定設備）
    """
    try:
        # 使用預設轉換或提供的轉換
        if transform is None:
            transform = get_cnn_transform()
        
        # 自動選擇設備
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # 從位元組載入圖片
        image = Image.open(BytesIO(image_bytes)).convert('RGB')
        input_tensor = transform(image).unsqueeze(0)  # 添加 batch 維度
        input_tensor = input_tensor.to(device)
        
        return input_tensor
        
    except Exception as e:
        logger.error(f"❌ CNN 圖片預處理失敗（從位元組）: {str(e)}")
        raise
