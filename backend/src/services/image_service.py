# image_service.py
# 圖片處理服務 - 包含 resize、hash、驗證等功能

import os
import hashlib
from PIL import Image
import io
import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


class ImageService:
    """圖片處理服務類"""
    
    # 標準處理尺寸（根據 usermap.mmd）
    TARGET_SIZE = (640, 640)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif'}
    
    @staticmethod
    def calculate_hash(image_bytes: bytes) -> str:
        """
        計算圖片的 SHA256 hash
        
        Args:
            image_bytes: 圖片位元組資料
        
        Returns:
            SHA256 hash 字串
        """
        return hashlib.sha256(image_bytes).hexdigest()
    
    @staticmethod
    def resize_image(image_bytes: bytes, target_size: Tuple[int, int] = TARGET_SIZE) -> bytes:
        """
        將圖片 resize 到指定尺寸（直接拉伸，不保持比例）
        
        Args:
            image_bytes: 原始圖片位元組
            target_size: 目標尺寸 (width, height)
        
        Returns:
            resize 後的圖片位元組
        """
        try:
            # 開啟圖片
            img = Image.open(io.BytesIO(image_bytes))
            
            # 轉換為 RGB（處理 RGBA 等格式）
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 直接拉伸/縮放到目標尺寸（不保持比例）
            resized_img = img.resize(target_size, Image.Resampling.LANCZOS)
            
            # 轉換為位元組
            output = io.BytesIO()
            resized_img.save(output, format='JPEG', quality=85)
            output_bytes = output.getvalue()
            
            logger.debug(f"✅ 圖片已 resize（拉伸）: {img.size} -> {target_size}")
            return output_bytes
            
        except Exception as e:
            logger.error(f"❌ 圖片 resize 失敗: {str(e)}")
            raise
    
    @staticmethod
    def validate_image(image_bytes: bytes, filename: str = None) -> Tuple[bool, str]:
        """
        驗證圖片格式和大小
        
        Args:
            image_bytes: 圖片位元組
            filename: 檔案名稱（可選）
        
        Returns:
            (is_valid, error_message)
        """
        try:
            # 檢查檔案大小
            if len(image_bytes) > ImageService.MAX_FILE_SIZE:
                return False, f"圖片大小超過限制 ({ImageService.MAX_FILE_SIZE / 1024 / 1024}MB)"
            
            # 檢查檔案格式
            if filename:
                ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
                if ext not in ImageService.ALLOWED_EXTENSIONS:
                    return False, f"不支援的檔案格式: {ext}。支援格式: {', '.join(ImageService.ALLOWED_EXTENSIONS)}"
            
            # 嘗試開啟圖片驗證格式
            img = Image.open(io.BytesIO(image_bytes))
            img.verify()
            
            return True, "圖片驗證通過"
            
        except Exception as e:
            logger.error(f"❌ 圖片驗證失敗: {str(e)}")
            return False, f"圖片格式錯誤: {str(e)}"
    
    @staticmethod
    def process_image(image_bytes: bytes, resize: bool = True, 
                     target_size: Tuple[int, int] = TARGET_SIZE) -> Tuple[bytes, str]:
        """
        處理圖片：驗證、resize、計算 hash
        
        Args:
            image_bytes: 原始圖片位元組
            resize: 是否 resize
            target_size: 目標尺寸
        
        Returns:
            (processed_bytes, image_hash)
        """
        # 1. 驗證圖片
        is_valid, error_msg = ImageService.validate_image(image_bytes)
        if not is_valid:
            raise ValueError(error_msg)
        
        # 2. Resize（如果需要）
        if resize:
            processed_bytes = ImageService.resize_image(image_bytes, target_size)
        else:
            processed_bytes = image_bytes
        
        # 3. 計算 hash
        image_hash = ImageService.calculate_hash(processed_bytes)
        
        return processed_bytes, image_hash
    
    @staticmethod
    def compress_image(image_bytes: bytes, quality: int = 75, max_size: Tuple[int, int] = None) -> bytes:
        """
        壓縮圖片以減少存儲空間
        
        Args:
            image_bytes: 原始圖片位元組
            quality: JPEG 品質 (1-100，預設 75)
            max_size: 最大尺寸 (width, height)，如果提供會先 resize 再壓縮
        
        Returns:
            壓縮後的圖片位元組
        """
        try:
            img = Image.open(io.BytesIO(image_bytes))
            
            # 轉換為 RGB（處理 RGBA 等格式）
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # 如果指定了最大尺寸，先 resize
            if max_size:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # 壓縮並轉換為位元組
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=quality, optimize=True)
            compressed_bytes = output.getvalue()
            
            original_size = len(image_bytes)
            compressed_size = len(compressed_bytes)
            compression_ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
            
            logger.debug(f"✅ 圖片已壓縮: {original_size} -> {compressed_size} bytes ({compression_ratio:.1f}% 減少)")
            return compressed_bytes
            
        except Exception as e:
            logger.error(f"❌ 圖片壓縮失敗: {str(e)}")
            raise
    
    @staticmethod
    def save_image(image_bytes: bytes, upload_folder: str, filename: str = None) -> str:
        """
        儲存圖片到指定資料夾
        
        Args:
            image_bytes: 圖片位元組
            upload_folder: 上傳資料夾路徑
            filename: 檔案名稱（可選，會自動生成）
        
        Returns:
            儲存的檔案路徑
        """
        import uuid
        
        os.makedirs(upload_folder, exist_ok=True)
        
        if not filename:
            filename = f"{uuid.uuid4()}.jpg"
        
        file_path = os.path.join(upload_folder, filename)
        
        with open(file_path, 'wb') as f:
            f.write(image_bytes)
        
        logger.debug(f"✅ 圖片已儲存: {file_path}")
        return file_path

