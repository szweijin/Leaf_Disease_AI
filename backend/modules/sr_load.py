"""
超解析度模型加載模組
用於加載 PyTorch 超解析度模型

參考文獻:
Lim, B., Son, S., Kim, H., Nah, S., & Lee, K. M. (2017).
Enhanced Deep Residual Networks for Single Image Super-Resolution.
In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR) Workshops.

模型實現參考: https://github.com/sanghyun-son/EDSR-PyTorch
"""

import os
import torch
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class SuperResolutionModelLoader:
    """超解析度模型加載器"""
    
    def __init__(self, model_path: Optional[str] = None, device: Optional[str] = None):
        """
        初始化超解析度模型加載器
        
        Args:
            model_path: 模型文件路徑（可選，如果為 None 則使用預設路徑）
            device: 設備類型 ('cuda', 'cpu', 或 None 自動選擇)
        """
        self.model_path = model_path
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.scale_factor = 2  # 預設放大倍數（可根據模型調整）
        
    def load_model(self, model_type: str = 'edsr', scale: int = 2):
        """
        加載超解析度模型
        
        Args:
            model_type: 模型類型 ('edsr', 'rcan', 'srgan', 'esrgan' 等)
            scale: 放大倍數 (2, 4, 8)
        
        Returns:
            加載的模型對象
        """
        try:
            self.scale_factor = scale
            
            # 如果提供了模型路徑，直接加載
            if self.model_path and os.path.exists(self.model_path):
                logger.info(f"📦 從指定路徑加載超解析度模型: {self.model_path}")
                self.model = self._load_from_path(self.model_path)
            else:
                # 否則使用預訓練模型或創建模型架構
                logger.info(f"📦 使用預設超解析度模型: {model_type}, scale={scale}")
                self.model = self._load_pretrained_model(model_type, scale)
            
            # 設置為評估模式
            self.model.eval()
            self.model.to(self.device)
            
            logger.info(f"✅ 超解析度模型加載成功 (設備: {self.device}, scale: {scale}x)")
            return self.model
            
        except Exception as e:
            logger.error(f"❌ 超解析度模型加載失敗: {str(e)}")
            raise
    
    def _load_from_path(self, model_path: str):
        """從文件路徑加載模型"""
        try:
            checkpoint = torch.load(model_path, map_location=self.device)
            
            # 嘗試不同的模型結構
            if isinstance(checkpoint, dict):
                if 'model' in checkpoint:
                    model = checkpoint['model']
                elif 'state_dict' in checkpoint:
                    # 需要模型架構來加載 state_dict
                    # 檢查是否為 sanghyun-son 實現（通過檢查鍵名）
                    state_dict = checkpoint['state_dict']
                    use_son = 'sub_mean.weight' in state_dict or 'head.0.weight' in state_dict
                    from modules.sr_utils import create_edsr_model
                    model = create_edsr_model(scale=self.scale_factor, use_son_implementation=use_son)
                    model.load_state_dict(state_dict, strict=False)
                else:
                    # 假設整個字典就是 state_dict
                    # 檢查是否為 sanghyun-son 實現
                    use_son = 'sub_mean.weight' in checkpoint or 'head.0.weight' in checkpoint
                    from modules.sr_utils import create_edsr_model
                    model = create_edsr_model(scale=self.scale_factor, use_son_implementation=use_son)
                    # 嘗試加載，允許部分匹配
                    try:
                        model.load_state_dict(checkpoint, strict=True)
                    except:
                        # 如果嚴格加載失敗，嘗試非嚴格加載
                        logger.warning("⚠️  嚴格加載失敗，嘗試非嚴格加載...")
                        model.load_state_dict(checkpoint, strict=False)
            else:
                # 直接是模型對象
                model = checkpoint
            
            return model
            
        except Exception as e:
            logger.error(f"❌ 從路徑加載模型失敗: {str(e)}")
            raise
    
    def _load_pretrained_model(self, model_type: str, scale: int):
        """加載預訓練模型或創建模型架構"""
        from modules.sr_utils import create_edsr_model, create_rcan_model
        
        if model_type.lower() == 'edsr':
            # 檢查是否有模型路徑，如果有則使用 son 實現
            use_son = self.model_path is not None
            return create_edsr_model(scale=scale, use_son_implementation=use_son)
        elif model_type.lower() == 'rcan':
            return create_rcan_model(scale=scale)
        else:
            # 預設使用 EDSR
            logger.warning(f"⚠️  未知模型類型 {model_type}，使用預設 EDSR")
            use_son = self.model_path is not None
            return create_edsr_model(scale=scale, use_son_implementation=use_son)
    
    def is_loaded(self) -> bool:
        """檢查模型是否已加載"""
        return self.model is not None


def load_sr_model(model_path: Optional[str] = None, model_type: str = 'edsr', scale: int = 2, device: Optional[str] = None):
    """
    便捷函數：加載超解析度模型
    
    Args:
        model_path: 模型文件路徑（可選）
        model_type: 模型類型
        scale: 放大倍數
        device: 設備類型
    
    Returns:
        加載的模型對象
    """
    loader = SuperResolutionModelLoader(model_path=model_path, device=device)
    return loader.load_model(model_type=model_type, scale=scale)

