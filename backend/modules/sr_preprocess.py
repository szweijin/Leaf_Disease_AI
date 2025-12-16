"""
超解析度預處理模組
在進入 CNN 分類前對圖片進行超解析度處理

參考文獻:
Lim, B., Son, S., Kim, H., Nah, S., & Lee, K. M. (2017).
Enhanced Deep Residual Networks for Single Image Super-Resolution.
In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR) Workshops.
"""

import os
import cv2
import numpy as np
import torch
import logging
from typing import Optional, Tuple, Union
from PIL import Image

from modules.sr_utils import prepare_image_for_sr, postprocess_sr_output

logger = logging.getLogger(__name__)


def enhance_image_with_sr(
    image_path: str,
    model: torch.nn.Module,
    device: str = 'cpu',
    scale: int = 2,
    output_path: Optional[str] = None,
    save_intermediate: bool = False
) -> Union[str, np.ndarray]:
    """
    使用超解析度模型增強圖片
    
    Args:
        image_path: 輸入圖片路徑
        model: 超解析度模型
        device: 設備類型 ('cuda' 或 'cpu')
        scale: 放大倍數
        output_path: 輸出圖片路徑（可選，如果為 None 則返回 numpy 數組）
        save_intermediate: 是否保存中間結果
    
    Returns:
        如果 output_path 為 None，返回增強後的圖片數組；否則返回輸出路徑
    """
    try:
        # 讀取圖片
        logger.info(f"📖 讀取圖片: {image_path}")
        image = cv2.imread(image_path)
        
        if image is None:
            raise ValueError(f"無法讀取圖片: {image_path}")
        
        original_shape = image.shape[:2]  # (H, W)
        logger.info(f"   原始尺寸: {original_shape[1]}x{original_shape[0]}")
        
        # 轉換為 RGB（OpenCV 使用 BGR）
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # 轉換為 PIL Image 以便更好地處理
        pil_image = Image.fromarray(image_rgb)
        
        # 轉換為張量並正規化到 [0, 1]
        image_tensor = torch.from_numpy(np.array(pil_image)).float() / 255.0
        image_tensor = image_tensor.permute(2, 0, 1)  # (H, W, C) -> (C, H, W)
        
        # 準備輸入
        input_tensor = prepare_image_for_sr(image_tensor, device=device)
        
        # 執行超解析度
        logger.info(f"🔍 執行超解析度處理 (scale={scale}x)...")
        model.eval()
        with torch.no_grad():
            enhanced_tensor = model(input_tensor)
            enhanced_tensor = postprocess_sr_output(enhanced_tensor)
        
        # 轉換回 numpy 數組
        enhanced_tensor = enhanced_tensor.squeeze(0)  # 移除 batch 維度
        enhanced_tensor = enhanced_tensor.permute(1, 2, 0)  # (C, H, W) -> (H, W, C)
        enhanced_array = (enhanced_tensor.cpu().numpy() * 255.0).astype(np.uint8)
        
        enhanced_shape = enhanced_array.shape[:2]
        logger.info(f"   增強後尺寸: {enhanced_shape[1]}x{enhanced_shape[0]}")
        
        # 如果需要保存
        if output_path:
            # 轉換回 BGR 以便 OpenCV 保存
            enhanced_bgr = cv2.cvtColor(enhanced_array, cv2.COLOR_RGB2BGR)
            cv2.imwrite(output_path, enhanced_bgr)
            logger.info(f"✅ 超解析度圖片已保存: {output_path}")
            return output_path
        else:
            return enhanced_array
            
    except Exception as e:
        logger.error(f"❌ 超解析度處理失敗: {str(e)}")
        raise


def enhance_image_array_with_sr(
    image_array: np.ndarray,
    model: torch.nn.Module,
    device: str = 'cpu',
    scale: int = 2
) -> np.ndarray:
    """
    使用超解析度模型增強圖片數組（內存中處理）
    
    Args:
        image_array: 輸入圖片數組 (H, W, C) 或 (H, W) 灰度圖
        model: 超解析度模型
        device: 設備類型
        scale: 放大倍數
    
    Returns:
        增強後的圖片數組
    """
    try:
        # 處理灰度圖
        if len(image_array.shape) == 2:
            image_array = np.stack([image_array] * 3, axis=-1)
        
        # 確保是 RGB
        if image_array.shape[2] == 4:  # RGBA
            image_array = image_array[:, :, :3]
        
        original_shape = image_array.shape[:2]
        logger.debug(f"   原始尺寸: {original_shape[1]}x{original_shape[0]}")
        
        # 轉換為張量並正規化
        image_tensor = torch.from_numpy(image_array).float()
        if image_tensor.max() > 1.0:
            image_tensor = image_tensor / 255.0
        
        image_tensor = image_tensor.permute(2, 0, 1)  # (H, W, C) -> (C, H, W)
        
        # 準備輸入
        input_tensor = prepare_image_for_sr(image_tensor, device=device)
        
        # 執行超解析度
        model.eval()
        with torch.no_grad():
            enhanced_tensor = model(input_tensor)
            enhanced_tensor = postprocess_sr_output(enhanced_tensor)
        
        # 轉換回 numpy 數組
        enhanced_tensor = enhanced_tensor.squeeze(0)
        enhanced_tensor = enhanced_tensor.permute(1, 2, 0)
        enhanced_array = (enhanced_tensor.cpu().numpy() * 255.0).astype(np.uint8)
        
        enhanced_shape = enhanced_array.shape[:2]
        logger.debug(f"   增強後尺寸: {enhanced_shape[1]}x{enhanced_shape[0]}")
        
        return enhanced_array
        
    except Exception as e:
        logger.error(f"❌ 超解析度處理失敗: {str(e)}")
        raise


def preprocess_with_sr(
    image_path: str,
    model: torch.nn.Module,
    device: str = 'cpu',
    scale: int = 2,
    temp_dir: Optional[str] = None
) -> str:
    """
    預處理圖片：使用超解析度增強後保存到臨時文件
    
    Args:
        image_path: 原始圖片路徑
        model: 超解析度模型
        device: 設備類型
        scale: 放大倍數
        temp_dir: 臨時目錄（如果為 None 則使用原圖目錄）
    
    Returns:
        增強後的圖片路徑
    """
    try:
        # 生成輸出路徑
        if temp_dir:
            os.makedirs(temp_dir, exist_ok=True)
            base_name = os.path.basename(image_path)
            name, ext = os.path.splitext(base_name)
            output_path = os.path.join(temp_dir, f"{name}_sr{scale}x{ext}")
        else:
            # 在同一目錄下創建增強版本
            dir_name = os.path.dirname(image_path)
            base_name = os.path.basename(image_path)
            name, ext = os.path.splitext(base_name)
            output_path = os.path.join(dir_name, f"{name}_sr{scale}x{ext}")
        
        # 執行超解析度
        enhanced_path = enhance_image_with_sr(
            image_path=image_path,
            model=model,
            device=device,
            scale=scale,
            output_path=output_path
        )
        
        return enhanced_path
        
    except Exception as e:
        logger.error(f"❌ 預處理失敗: {str(e)}")
        raise

