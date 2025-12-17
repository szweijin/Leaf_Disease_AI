"""
YOLO 模型載入模組
負責載入 YOLO 模型
"""

import os
import logging
from ultralytics import YOLO

logger = logging.getLogger(__name__)


def load_yolo_model(model_path: str):
    """
    載入 YOLO 模型
    
    Args:
        model_path: YOLO 模型路徑 (.pt 檔案)
    
    Returns:
        載入完成的 YOLO 模型
    """
    try:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"YOLO 模型檔案不存在: {model_path}")
        
        # 檢查文件大小（模型文件應該至少幾 MB）
        file_size = os.path.getsize(model_path)
        logger.info(f"🔍 檢查 YOLO 模型文件: {model_path}")
        logger.info(f"   文件大小: {file_size / 1024 / 1024:.2f} MB ({file_size} bytes)")
        
        if file_size < 1024 * 1024:  # 小於 1MB 可能是損壞的文件
            raise ValueError(f"YOLO 模型文件大小異常（{file_size / 1024 / 1024:.2f} MB），模型文件通常應該大於 1MB: {model_path}")
        
        # 檢查文件是否為有效的 PyTorch 文件（檢查文件頭）
        with open(model_path, 'rb') as f:
            header = f.read(16)  # 讀取更多字節以便診斷
            header_preview = header[:4]
            header_hex = header.hex()
            
            logger.info(f"   文件頭（前4字節）: {header_hex[:8]} ({repr(header_preview)})")
            
            # PyTorch 模型文件通常是 ZIP 格式，以 'PK' 開頭（PKZIP 格式）
            # 如果文件以 'v' 開頭，很可能是文本文件（例如版本號文件）
            if header_preview.startswith(b'v'):
                # 嘗試讀取前幾行來確認是否為文本文件
                f.seek(0)
                try:
                    first_line = f.readline(100).decode('utf-8', errors='ignore').strip()
                    raise ValueError(
                        f"YOLO 模型文件格式異常，文件以 'v' 開頭，可能是文本文件而非模型文件: {model_path}\n"
                        f"   文件開頭內容: {first_line[:100]}\n"
                        f"   文件大小: {file_size} bytes\n"
                        f"   請確認模型文件未損壞且為正確的 .pt 格式"
                    )
                except:
                    raise ValueError(
                        f"YOLO 模型文件格式異常，文件以 'v' 開頭，可能是文本文件而非模型文件: {model_path}\n"
                        f"   文件大小: {file_size} bytes\n"
                        f"   請確認模型文件未損壞且為正確的 .pt 格式"
                    )
            
            # PyTorch 模型文件應該以 'PK' 開頭（ZIP 格式）
            if header_preview.startswith(b'PK'):
                logger.info(f"   ✅ 文件頭格式正確（ZIP/PyTorch 格式）")
            else:
                logger.warning(f"   ⚠️  文件頭不是標準的 ZIP 格式（'PK'），但繼續嘗試載入...")
                logger.warning(f"   文件頭: {header_hex[:8]} ({repr(header_preview)})")
        
        logger.info(f"📦 開始載入 YOLO 模型: {model_path} (大小: {file_size / 1024 / 1024:.2f} MB)")
        model = YOLO(model_path)
        logger.info(f"✅ YOLO 模型載入成功: {model_path}")
        
        return model
        
    except Exception as e:
        logger.error(f"❌ YOLO 模型載入失敗: {str(e)}")
        logger.error(f"   文件路徑: {model_path}")
        if os.path.exists(model_path):
            logger.error(f"   文件大小: {os.path.getsize(model_path)} bytes")
        raise
