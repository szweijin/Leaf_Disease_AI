"""
CNN 分類服務
整合 CNN 模組功能，提供高層服務接口
"""

import os
import logging
from typing import Dict, Optional

# 導入 CNN 模組
from modules.cnn_load import load_cnn_model
from modules.cnn_preprocess import preprocess_image, preprocess_image_from_bytes
from modules.cnn_predict import cnn_predict
from modules.cnn_postprocess import postprocess_cnn_result
from modules.cnn_utils import CNN_CLASSES, should_run_yolo, get_final_status

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CNNClassifierService:
    """
    CNN 分類服務類
    整合 CNN 模組功能，提供統一的服務接口
    """
    
    def __init__(self, model_path: str, device: Optional[str] = None):
        """
        初始化 CNN 分類服務
        
        Args:
            model_path: CNN 模型路徑 (.pth 檔案)
            device: 設備 ('cuda', 'cpu', 或 None 自動選擇)
        """
        self.model_path = model_path
        self.device = device or ('cuda' if __import__('torch').cuda.is_available() else 'cpu')
        self.classes = CNN_CLASSES
        self.num_classes = len(self.classes)
        
        # 載入模型
        self.model = load_cnn_model(model_path, self.num_classes, self.device)
        logger.info(f"✅ CNN 分類服務初始化完成，類別: {self.classes}")
    
    def predict(self, image_path: str) -> Dict:
        """
        執行 CNN 分類預測
        
        Args:
            image_path: 圖片檔案路徑
        
        Returns:
            包含以下欄位的字典：
            - mean_score: 平均分數
            - best_class: 最佳分類類別
            - best_score: 最佳分類分數
            - all_scores: 所有類別的分數字典
            - probabilities: 原始機率陣列
        """
        try:
            # 1. 預處理圖片
            input_tensor = preprocess_image(image_path, device=self.device)
            
            # 2. 執行推論
            output = cnn_predict(self.model, input_tensor)
            
            # 3. 後處理結果
            result = postprocess_cnn_result(output, self.classes)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ CNN 預測失敗: {str(e)}")
            raise
    
    def predict_from_bytes(self, image_bytes: bytes) -> Dict:
        """
        從圖片位元組執行 CNN 分類預測
        
        Args:
            image_bytes: 圖片位元組資料
        
        Returns:
            與 predict() 相同的結果字典
        """
        try:
            # 1. 預處理圖片
            input_tensor = preprocess_image_from_bytes(image_bytes, device=self.device)
            
            # 2. 執行推論
            output = cnn_predict(self.model, input_tensor)
            
            # 3. 後處理結果
            result = postprocess_cnn_result(output, self.classes)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ CNN 預測失敗（從位元組）: {str(e)}")
            raise
    
    def should_run_yolo(self, best_class: str) -> bool:
        """
        判斷是否應該執行 YOLO 檢測
        
        Args:
            best_class: CNN 最佳分類類別
        
        Returns:
            True 如果應該執行 YOLO，False 否則
        """
        return should_run_yolo(best_class)
    
    def get_final_status(self, best_class: str) -> str:
        """
        根據 CNN 分類結果獲取最終狀態
        
        Args:
            best_class: CNN 最佳分類類別
        
        Returns:
            最終狀態：'yolo_detected', 'need_crop', 'not_plant'
        """
        return get_final_status(best_class)
