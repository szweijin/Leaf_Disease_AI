"""
CNN 後處理模組
負責處理推論結果並轉換為可讀格式
"""

import torch
import torch.nn.functional as F
import numpy as np
import logging
from typing import Dict, Any, List

from modules.cnn_utils import CNN_CLASSES

logger = logging.getLogger(__name__)


def postprocess_cnn_result(output: torch.Tensor, classes: List[str] = None) -> Dict[str, Any]:
    """
    後處理 CNN 推論結果
    
    Args:
        output: 模型原始輸出（未應用 softmax）
        classes: 類別列表（如果為 None，使用預設 CNN_CLASSES）
    
    Returns:
        包含以下欄位的字典：
        - mean_score: 平均分數
        - best_class: 最佳分類類別
        - best_score: 最佳分類分數
        - all_scores: 所有類別的分數字典
        - probabilities: 原始機率陣列
    """
    try:
        # 使用預設類別或提供的類別
        if classes is None:
            classes = CNN_CLASSES
        
        # 應用 softmax 獲取機率
        probabilities = F.softmax(output, dim=1)
        probabilities = probabilities.cpu().numpy()[0]  # 移除 batch 維度
        
        # 計算結果
        mean_score = float(probabilities.mean())
        best_class_idx = int(probabilities.argmax())
        best_class = classes[best_class_idx]
        best_score = float(probabilities[best_class_idx])
        
        # 構建所有類別分數字典
        all_scores = {
            class_name: float(probabilities[i])
            for i, class_name in enumerate(classes)
        }
        
        result = {
            'mean_score': mean_score,
            'best_class': best_class,
            'best_score': best_score,
            'all_scores': all_scores,
            'probabilities': probabilities.tolist()  # 用於調試
        }
        
        logger.debug(f"CNN 預測結果: {best_class} ({best_score:.4f}), 平均分數: {mean_score:.4f}")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ CNN 後處理失敗: {str(e)}")
        raise
