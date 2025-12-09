# cnn_classifier_service.py
# CNN 分類服務 - 植物種類分類

import os
import sys
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image
import logging
from typing import Dict, List, Tuple, Optional
import json

logger = logging.getLogger(__name__)

# CNN 類別定義
CNN_CLASSES = ['others', 'pepper_bell', 'potato', 'tomato', 'whole_plant']


class MobileNetV3Large(nn.Module):
    """MobileNetV3-Large 模型定義（與訓練時一致）"""
    
    def __init__(self, num_classes=5):
        super(MobileNetV3Large, self).__init__()
        from torchvision.models import mobilenet_v3_large
        
        # 載入預訓練模型
        self.model = mobilenet_v3_large(pretrained=True)
        
        # 修改最後一層
        self.model.classifier = nn.Sequential(
            nn.Linear(960, 1280),
            nn.Hardswish(),
            nn.Dropout(0.2),
            nn.Linear(1280, num_classes)
        )
    
    def forward(self, x):
        return self.model(x)


class CNNClassifierService:
    """CNN 分類服務類"""
    
    def __init__(self, model_path: str, device: Optional[str] = None):
        """
        初始化 CNN 分類服務
        
        Args:
            model_path: CNN 模型路徑 (.pth 檔案)
            device: 設備 ('cuda', 'cpu', 或 None 自動選擇)
        """
        self.model_path = model_path
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.classes = CNN_CLASSES
        self.num_classes = len(self.classes)
        
        # 圖片預處理（與訓練時一致）
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        # 載入模型
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """載入 CNN 模型"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"CNN 模型檔案不存在: {self.model_path}")
            
            # 創建模型
            self.model = MobileNetV3Large(num_classes=self.num_classes)
            
            # 載入權重
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
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
            
            # 檢查鍵名格式，處理不同的保存格式
            if state_dict:
                # 獲取第一個鍵來判斷格式
                first_key = next(iter(state_dict.keys()))
                
                # 如果鍵名沒有 'model.' 前綴（例如：'conv_stem.weight'），
                # 說明權重是直接保存的 mobilenet_v3_large 模型權重
                if not first_key.startswith('model.'):
                    # 過濾掉 classifier 相關的鍵（因為我們已經修改了分類器）
                    filtered_state_dict = {
                        k: v for k, v in state_dict.items() 
                        if not k.startswith('classifier')
                    }
                    
                    # 直接載入到內部的 mobilenet_v3_large 模型
                    try:
                        self.model.model.load_state_dict(filtered_state_dict, strict=False)
                        logger.info("✅ 使用直接格式載入權重到內部模型（無 model. 前綴）")
                    except Exception as e1:
                        logger.warning(f"⚠️  直接載入失敗，嘗試非嚴格模式: {str(e1)}")
                        # 使用非嚴格模式載入整個模型（會跳過不匹配的鍵）
                        self.model.load_state_dict(state_dict, strict=False)
                        logger.warning("⚠️  使用非嚴格模式載入權重（部分鍵可能未匹配）")
                else:
                    # 鍵名有 'model.' 前綴，直接載入
                    self.model.load_state_dict(state_dict, strict=False)
                    logger.info("✅ 使用標準格式載入權重（有 model. 前綴）")
            
            # 設置為評估模式
            self.model.to(self.device)
            self.model.eval()
            
            logger.info(f"✅ CNN 模型載入成功: {self.model_path}")
            logger.info(f"   設備: {self.device}")
            logger.info(f"   類別數: {self.num_classes}")
            logger.info(f"   類別: {self.classes}")
            
        except Exception as e:
            logger.error(f"❌ CNN 模型載入失敗: {str(e)}")
            import traceback
            logger.error(f"錯誤堆疊:\n{traceback.format_exc()}")
            raise
    
    def predict(self, image_path: str) -> Dict[str, any]:
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
            # 1. 載入並預處理圖片
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"圖片檔案不存在: {image_path}")
            
            image = Image.open(image_path).convert('RGB')
            input_tensor = self.transform(image).unsqueeze(0)  # 添加 batch 維度
            input_tensor = input_tensor.to(self.device)
            
            # 2. 執行推論
            with torch.no_grad():
                output = self.model(input_tensor)
                # 應用 softmax 獲取機率
                probabilities = torch.nn.functional.softmax(output, dim=1)
                probabilities = probabilities.cpu().numpy()[0]  # 移除 batch 維度
            
            # 3. 計算結果
            mean_score = float(probabilities.mean())
            best_class_idx = int(probabilities.argmax())
            best_class = self.classes[best_class_idx]
            best_score = float(probabilities[best_class_idx])
            
            # 4. 構建所有類別分數字典
            all_scores = {
                class_name: float(probabilities[i])
                for i, class_name in enumerate(self.classes)
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
            logger.error(f"❌ CNN 預測失敗: {str(e)}")
            raise
    
    def predict_from_bytes(self, image_bytes: bytes) -> Dict[str, any]:
        """
        從圖片位元組執行 CNN 分類預測
        
        Args:
            image_bytes: 圖片位元組資料
        
        Returns:
            與 predict() 相同的結果字典
        """
        try:
            from io import BytesIO
            
            # 從位元組載入圖片
            image = Image.open(BytesIO(image_bytes)).convert('RGB')
            input_tensor = self.transform(image).unsqueeze(0)
            input_tensor = input_tensor.to(self.device)
            
            # 執行推論
            with torch.no_grad():
                output = self.model(input_tensor)
                probabilities = torch.nn.functional.softmax(output, dim=1)
                probabilities = probabilities.cpu().numpy()[0]
            
            # 計算結果
            mean_score = float(probabilities.mean())
            best_class_idx = int(probabilities.argmax())
            best_class = self.classes[best_class_idx]
            best_score = float(probabilities[best_class_idx])
            
            all_scores = {
                class_name: float(probabilities[i])
                for i, class_name in enumerate(self.classes)
            }
            
            result = {
                'mean_score': mean_score,
                'best_class': best_class,
                'best_score': best_score,
                'all_scores': all_scores,
                'probabilities': probabilities.tolist()
            }
            
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
        return best_class in ['pepper_bell', 'potato', 'tomato']
    
    def get_final_status(self, best_class: str) -> str:
        """
        根據 CNN 分類結果獲取最終狀態
        
        Args:
            best_class: CNN 最佳分類類別
        
        Returns:
            最終狀態：'yolo_detected', 'need_crop', 'not_plant'
        """
        if best_class in ['pepper_bell', 'potato', 'tomato']:
            return 'yolo_detected'  # 會執行 YOLO，最終狀態在 YOLO 完成後確定
        elif best_class == 'whole_plant':
            return 'need_crop'
        elif best_class == 'others':
            return 'not_plant'
        else:
            return 'unknown'

