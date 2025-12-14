"""
CNN 模型載入模組
負責載入 CNN 模型和權重
"""

import os
import torch
import torch.nn as nn
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# 嘗試導入 timm，如果沒有則提示安裝
try:
    import timm
    TIMM_AVAILABLE = True
except ImportError:
    TIMM_AVAILABLE = False
    logger.warning("⚠️  timm 庫未安裝，請執行: pip install timm")


def load_cnn_model(model_path: str, num_classes: int = 5, device: Optional[str] = None) -> nn.Module:
    """
    載入 CNN 模型（使用 timm 庫，與訓練時一致）
    
    Args:
        model_path: CNN 模型路徑 (.pth 檔案)
        num_classes: 類別數量
        device: 設備 ('cuda', 'cpu', 或 None 自動選擇)
    
    Returns:
        載入完成的模型
    """
    try:
        if not TIMM_AVAILABLE:
            raise ImportError("timm 庫未安裝，請執行: pip install timm")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"CNN 模型檔案不存在: {model_path}")
        
        # 自動選擇設備
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # 使用 timm 創建模型（與訓練時一致）
        # 訓練時使用: timm.create_model("mobilenetv3_large_100", pretrained=True, num_classes=num_classes)
        # 載入時使用 pretrained=False，因為我們會載入訓練好的權重
        model = timm.create_model("mobilenetv3_large_100", pretrained=False, num_classes=num_classes)
        model.to(device)
        
        # 載入權重
        checkpoint = torch.load(model_path, map_location=device)
        
        # 提取實際的 state_dict
        state_dict = None
        if isinstance(checkpoint, dict):
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
            elif 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
            else:
                state_dict = checkpoint
        else:
            state_dict = checkpoint
        
        # 載入權重（timm 模型的 state_dict 應該可以直接載入）
        if state_dict:
            try:
                model.load_state_dict(state_dict, strict=True)
                logger.info("✅ 使用嚴格模式載入權重（所有鍵都匹配）")
            except Exception as e1:
                logger.warning(f"⚠️  嚴格模式載入失敗，嘗試非嚴格模式: {str(e1)}")
                # 使用非嚴格模式載入（會跳過不匹配的鍵）
                model.load_state_dict(state_dict, strict=False)
                logger.warning("⚠️  使用非嚴格模式載入權重（部分鍵可能未匹配）")
        
        # 設置為評估模式
        model.eval()
        
        logger.info(f"✅ CNN 模型載入成功: {model_path}")
        logger.info(f"   設備: {device}")
        logger.info(f"   類別數: {num_classes}")
        logger.info(f"   模型架構: timm mobilenetv3_large_100（與訓練時一致）")
        
        return model
        
    except Exception as e:
        logger.error(f"❌ CNN 模型載入失敗: {str(e)}")
        import traceback
        logger.error(f"錯誤堆疊:\n{traceback.format_exc()}")
        raise
