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


class MobileNetV3Large(nn.Module):
    """
    MobileNetV3-Large 模型定義（與訓練時一致）
    """
    
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


def load_cnn_model(model_path: str, num_classes: int = 5, device: Optional[str] = None) -> nn.Module:
    """
    載入 CNN 模型
    
    Args:
        model_path: CNN 模型路徑 (.pth 檔案)
        num_classes: 類別數量
        device: 設備 ('cuda', 'cpu', 或 None 自動選擇)
    
    Returns:
        載入完成的模型
    """
    try:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"CNN 模型檔案不存在: {model_path}")
        
        # 自動選擇設備
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # 創建模型
        model = MobileNetV3Large(num_classes=num_classes)
        
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
                    model.model.load_state_dict(filtered_state_dict, strict=False)
                    logger.info("✅ 使用直接格式載入權重到內部模型（無 model. 前綴）")
                except Exception as e1:
                    logger.warning(f"⚠️  直接載入失敗，嘗試非嚴格模式: {str(e1)}")
                    # 使用非嚴格模式載入整個模型（會跳過不匹配的鍵）
                    model.load_state_dict(state_dict, strict=False)
                    logger.warning("⚠️  使用非嚴格模式載入權重（部分鍵可能未匹配）")
            else:
                # 鍵名有 'model.' 前綴，直接載入
                model.load_state_dict(state_dict, strict=False)
                logger.info("✅ 使用標準格式載入權重（有 model. 前綴）")
        
        # 設置為評估模式
        model.to(device)
        model.eval()
        
        logger.info(f"✅ CNN 模型載入成功: {model_path}")
        logger.info(f"   設備: {device}")
        logger.info(f"   類別數: {num_classes}")
        
        return model
        
    except Exception as e:
        logger.error(f"❌ CNN 模型載入失敗: {str(e)}")
        import traceback
        logger.error(f"錯誤堆疊:\n{traceback.format_exc()}")
        raise
