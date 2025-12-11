"""
CNN 推論模組
負責執行 CNN 模型推論
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def cnn_predict(model: nn.Module, input_tensor: torch.Tensor) -> torch.Tensor:
    """
    執行 CNN 推論
    
    Args:
        model: 已載入的 CNN 模型
        input_tensor: 預處理後的圖片張量（已包含 batch 維度）
    
    Returns:
        模型原始輸出（未應用 softmax）
    """
    try:
        with torch.no_grad():
            output = model(input_tensor)
        return output
    except Exception as e:
        logger.error(f"❌ CNN 推論失敗: {str(e)}")
        raise


def cnn_predict_from_bytes(model: nn.Module, input_tensor: torch.Tensor) -> torch.Tensor:
    """
    從預處理張量執行 CNN 推論（與 cnn_predict 相同，保留用於向後兼容）
    
    Args:
        model: 已載入的 CNN 模型
        input_tensor: 預處理後的圖片張量（已包含 batch 維度）
    
    Returns:
        模型原始輸出（未應用 softmax）
    """
    return cnn_predict(model, input_tensor)
