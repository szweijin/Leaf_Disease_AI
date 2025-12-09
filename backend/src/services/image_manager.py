# image_manager.py
# 圖片管理服務 - 統一管理圖片上傳、暫存、裁切、儲存等操作

import os
import base64
import tempfile
import logging
import uuid
from typing import Tuple, Optional, Dict, Any
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

from src.services.image_service import ImageService

logger = logging.getLogger(__name__)


class ImageManager:
    """圖片管理服務類 - 統一管理圖片處理流程"""
    
    def __init__(
        self,
        upload_folder: str,
        temp_file_ttl_hours: int = 24,
        cloudinary_storage=None,
        use_cloudinary: bool = False,
        cloudinary_folder: str = 'leaf_disease_ai'
    ):
        """
        初始化圖片管理器
        
        Args:
            upload_folder: 上傳資料夾路徑
            temp_file_ttl_hours: 暫存文件保留時間（小時），預設 24 小時
            cloudinary_storage: Cloudinary 儲存服務實例（可選）
            use_cloudinary: 是否使用 Cloudinary 儲存
            cloudinary_folder: Cloudinary 資料夾路徑
        """
        self.upload_folder = upload_folder
        self.temp_file_ttl_hours = temp_file_ttl_hours
        self.temp_files_registry = {}  # 追蹤暫存文件：{file_path: created_time}
        self.cloudinary_storage = cloudinary_storage
        self.use_cloudinary = use_cloudinary and cloudinary_storage is not None
        self.cloudinary_folder = cloudinary_folder
        
        # 確保上傳資料夾存在（即使使用 Cloudinary，仍需要暫存文件）
        os.makedirs(upload_folder, exist_ok=True)
        
        storage_type = "Cloudinary" if self.use_cloudinary else "本地文件系統"
        logger.info(f"✅ 圖片管理器初始化: upload_folder={upload_folder}, storage={storage_type}")
    
    def decode_base64_image(self, base64_data: str) -> bytes:
        """
        解碼 base64 圖片資料
        
        Args:
            base64_data: base64 編碼的圖片資料（可能包含 data:image/...;base64, 前綴）
        
        Returns:
            解碼後的圖片位元組
        """
        try:
            # 移除 data URL 前綴（如果存在）
            if "," in base64_data:
                _, encoded = base64_data.split(",", 1)
            else:
                encoded = base64_data
            
            img_bytes = base64.b64decode(encoded)
            logger.debug(f"✅ Base64 解碼成功: {len(img_bytes)} bytes")
            return img_bytes
            
        except Exception as e:
            logger.error(f"❌ Base64 解碼失敗: {str(e)}")
            raise ValueError(f"圖片格式錯誤: {str(e)}")
    
    def process_uploaded_image(self, image_bytes: bytes, resize: bool = True) -> Tuple[bytes, str]:
        """
        處理上傳的圖片（驗證、resize、計算 hash）
        
        Args:
            image_bytes: 原始圖片位元組
            resize: 是否 resize
        
        Returns:
            (processed_bytes, image_hash)
        """
        try:
            processed_bytes, image_hash = ImageService.process_image(
                image_bytes, 
                resize=resize
            )
            logger.debug(f"✅ 圖片處理完成: hash={image_hash[:8]}..., size={len(processed_bytes)} bytes")
            return processed_bytes, image_hash
            
        except Exception as e:
            logger.error(f"❌ 圖片處理失敗: {str(e)}")
            raise
    
    def process_cropped_image(self, cropped_base64: str) -> Tuple[bytes, str]:
        """
        處理裁切後的圖片
        
        Args:
            cropped_base64: 裁切後的 base64 圖片資料
        
        Returns:
            (processed_bytes, image_hash)
        """
        try:
            # 解碼 base64
            img_bytes = self.decode_base64_image(cropped_base64)
            
            # 處理圖片（驗證、resize、計算 hash）
            processed_bytes, image_hash = self.process_uploaded_image(img_bytes, resize=True)
            
            logger.info(f"✅ 裁切圖片處理完成: hash={image_hash[:8]}...")
            return processed_bytes, image_hash
            
        except Exception as e:
            logger.error(f"❌ 裁切圖片處理失敗: {str(e)}")
            raise
    
    @contextmanager
    def create_temp_file(self, image_bytes: bytes, suffix: str = '.jpg'):
        """
        創建暫存文件的上下文管理器（自動清理）
        
        Args:
            image_bytes: 要寫入的圖片位元組
            suffix: 文件後綴
        
        Yields:
            暫存文件路徑
        """
        temp_file = None
        temp_file_path = None
        
        try:
            # 創建暫存文件
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=suffix,
                dir=self.upload_folder
            )
            temp_file.write(image_bytes)
            temp_file_path = temp_file.name
            temp_file.close()
            temp_file = None
            
            # 註冊暫存文件（用於追蹤和清理）
            self.temp_files_registry[temp_file_path] = datetime.now()
            logger.debug(f"📝 創建暫存文件: {temp_file_path}")
            
            yield temp_file_path
            
        finally:
            # 自動清理暫存文件
            if temp_file_path:
                self.cleanup_temp_file(temp_file_path)
            if temp_file:
                try:
                    temp_file.close()
                except:
                    pass
    
    def cleanup_temp_file(self, file_path: str) -> bool:
        """
        清理單個暫存文件
        
        Args:
            file_path: 文件路徑
        
        Returns:
            是否成功刪除
        """
        if not file_path or not os.path.exists(file_path):
            return False
        
        try:
            os.remove(file_path)
            # 從註冊表中移除
            self.temp_files_registry.pop(file_path, None)
            logger.debug(f"🗑️  暫存文件已刪除: {file_path}")
            return True
            
        except Exception as e:
            logger.warning(f"⚠️  刪除暫存文件失敗: {file_path}, 錯誤: {str(e)}")
            return False
    
    def cleanup_old_temp_files(self, max_age_hours: Optional[int] = None) -> int:
        """
        清理過期的暫存文件
        
        Args:
            max_age_hours: 最大保留時間（小時），如果為 None 則使用預設值
        
        Returns:
            清理的文件數量
        """
        if max_age_hours is None:
            max_age_hours = self.temp_file_ttl_hours
        
        max_age = timedelta(hours=max_age_hours)
        now = datetime.now()
        cleaned_count = 0
        
        # 檢查註冊表中的文件
        files_to_check = list(self.temp_files_registry.items())
        
        for file_path, created_time in files_to_check:
            age = now - created_time
            if age > max_age:
                if self.cleanup_temp_file(file_path):
                    cleaned_count += 1
        
        # 檢查上傳資料夾中的臨時文件（可能不在註冊表中）
        try:
            for filename in os.listdir(self.upload_folder):
                if filename.startswith('tmp') or filename.startswith('temp'):
                    file_path = os.path.join(self.upload_folder, filename)
                    try:
                        # 檢查文件修改時間
                        file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                        age = now - file_mtime
                        if age > max_age:
                            if self.cleanup_temp_file(file_path):
                                cleaned_count += 1
                    except Exception as e:
                        logger.debug(f"檢查文件時出錯: {file_path}, {str(e)}")
        except Exception as e:
            logger.warning(f"⚠️  掃描上傳資料夾時出錯: {str(e)}")
        
        if cleaned_count > 0:
            logger.info(f"🧹 清理了 {cleaned_count} 個過期暫存文件")
        
        return cleaned_count
    
    def save_image_to_db(self, image_bytes: bytes, quality: int = 75) -> bytes:
        """
        壓縮圖片以準備存儲到資料庫
        
        Args:
            image_bytes: 原始圖片位元組
            quality: JPEG 品質 (1-100)
        
        Returns:
            壓縮後的圖片位元組
        """
        try:
            compressed_bytes = ImageService.compress_image(
                image_bytes,
                quality=quality,
                max_size=(1920, 1920)  # 限制最大尺寸
            )
            logger.debug(f"✅ 圖片壓縮完成: {len(image_bytes)} -> {len(compressed_bytes)} bytes")
            return compressed_bytes
            
        except Exception as e:
            logger.warning(f"⚠️  圖片壓縮失敗，使用原始圖片: {str(e)}")
            return image_bytes
    
    def get_image_info(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        獲取圖片資訊
        
        Args:
            image_bytes: 圖片位元組
        
        Returns:
            圖片資訊字典
        """
        try:
            from PIL import Image
            import io
            
            img = Image.open(io.BytesIO(image_bytes))
            return {
                'width': img.width,
                'height': img.height,
                'format': img.format,
                'mode': img.mode,
                'size_bytes': len(image_bytes)
            }
        except Exception as e:
            logger.warning(f"⚠️  獲取圖片資訊失敗: {str(e)}")
            return {
                'size_bytes': len(image_bytes)
            }
    
    def validate_image_for_upload(self, image_bytes: bytes, filename: Optional[str] = None) -> Tuple[bool, str]:
        """
        驗證上傳的圖片
        
        Args:
            image_bytes: 圖片位元組
            filename: 檔案名稱（可選）
        
        Returns:
            (is_valid, error_message)
        """
        return ImageService.validate_image(image_bytes, filename)
    
    def upload_to_cloudinary(
        self,
        image_bytes: bytes,
        public_id: Optional[str] = None,
        folder: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        上傳圖片到 Cloudinary
        
        Args:
            image_bytes: 圖片位元組
            public_id: 公開 ID（可選，會自動生成）
            folder: 資料夾路徑（可選，預設使用 self.cloudinary_folder）
            **kwargs: 其他 Cloudinary 上傳選項
        
        Returns:
            上傳結果字典，包含 secure_url, public_id 等
        
        Raises:
            RuntimeError: 如果 Cloudinary 未啟用或未初始化
        """
        if not self.use_cloudinary:
            raise RuntimeError("Cloudinary 未啟用，無法上傳圖片")
        
        if not self.cloudinary_storage:
            raise RuntimeError("Cloudinary 儲存服務未初始化")
        
        # 如果沒有提供 public_id，自動生成一個（格式：uuid.jpg）
        if not public_id:
            public_id = f"{uuid.uuid4()}.jpg"
        else:
            # 確保 public_id 有 .jpg 擴展名（如果沒有擴展名）
            if not public_id.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                public_id = f"{public_id}.jpg"
        
        # 使用預設資料夾或提供的資料夾
        upload_folder = folder or self.cloudinary_folder
        
        try:
            upload_result = self.cloudinary_storage.upload_image(
                image_bytes=image_bytes,
                public_id=public_id,
                folder=upload_folder,
                **kwargs
            )
            logger.info(f"✅ 圖片已上傳到 Cloudinary: public_id={upload_result.get('public_id')}")
            return upload_result
            
        except Exception as e:
            logger.error(f"❌ Cloudinary 上傳失敗: {str(e)}")
            raise
    
    def save_image(
        self,
        image_bytes: bytes,
        filename: Optional[str] = None,
        use_cloudinary: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        儲存圖片（根據配置選擇本地或 Cloudinary）
        
        Args:
            image_bytes: 圖片位元組
            filename: 檔案名稱（可選，僅用於本地儲存）
            use_cloudinary: 是否使用 Cloudinary（可選，預設使用 self.use_cloudinary）
        
        Returns:
            儲存結果字典，包含：
            - 如果使用 Cloudinary: {'url': secure_url, 'public_id': public_id, 'storage': 'cloudinary'}
            - 如果使用本地: {'path': file_path, 'storage': 'local'}
        """
        use_cloud = use_cloudinary if use_cloudinary is not None else self.use_cloudinary
        
        if use_cloud:
            # 上傳到 Cloudinary
            upload_result = self.upload_to_cloudinary(image_bytes)
            return {
                'url': upload_result.get('secure_url'),
                'public_id': upload_result.get('public_id'),
                'storage': 'cloudinary',
                'upload_result': upload_result
            }
        else:
            # 儲存到本地
            if not filename:
                filename = f"{uuid.uuid4()}.jpg"
            
            file_path = ImageService.save_image(image_bytes, self.upload_folder, filename)
            return {
                'path': file_path,
                'storage': 'local'
            }
    
    def get_image_url(
        self,
        identifier: str,
        storage_type: str = 'auto',
        transformation: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        獲取圖片 URL
        
        Args:
            identifier: 圖片識別符（public_id 或文件路徑）
            storage_type: 儲存類型 ('cloudinary', 'local', 'auto')
            transformation: Cloudinary 轉換選項（僅用於 Cloudinary）
        
        Returns:
            圖片 URL，如果無法獲取則返回 None
        """
        # 自動判斷儲存類型
        if storage_type == 'auto':
            if identifier.startswith('http://') or identifier.startswith('https://'):
                # 已經是完整 URL
                return identifier
            elif identifier.startswith('/image/') or identifier.startswith('/uploads/'):
                # 本地路徑，需要轉換為完整 URL（由前端處理）
                return identifier
            elif self.use_cloudinary:
                # 假設是 Cloudinary public_id
                storage_type = 'cloudinary'
            else:
                # 本地文件路徑
                storage_type = 'local'
        
        if storage_type == 'cloudinary' and self.use_cloudinary and self.cloudinary_storage:
            try:
                return self.cloudinary_storage.get_image_url(
                    identifier,
                    transformation=transformation
                )
            except Exception as e:
                logger.warning(f"⚠️  獲取 Cloudinary URL 失敗: {str(e)}")
                return None
        elif storage_type == 'local':
            # 本地文件路徑，返回相對路徑（由前端處理）
            if os.path.isabs(identifier):
                # 提取相對路徑
                if '/uploads/' in identifier:
                    uploads_index = identifier.find('/uploads/')
                    return identifier[uploads_index:]
            return identifier if identifier.startswith('/') else f"/uploads/{identifier}"
        
        return None


# 全局實例（將在 app.py 中初始化）
_image_manager: Optional[ImageManager] = None


def get_image_manager() -> ImageManager:
    """獲取全局圖片管理器實例"""
    if _image_manager is None:
        raise RuntimeError("圖片管理器尚未初始化，請先調用 init_image_manager()")
    return _image_manager


def init_image_manager(
    upload_folder: str,
    temp_file_ttl_hours: int = 24,
    cloudinary_storage=None,
    use_cloudinary: bool = False,
    cloudinary_folder: str = 'leaf_disease_ai'
) -> ImageManager:
    """
    初始化全局圖片管理器
    
    Args:
        upload_folder: 上傳資料夾路徑
        temp_file_ttl_hours: 暫存文件保留時間（小時）
        cloudinary_storage: Cloudinary 儲存服務實例（可選）
        use_cloudinary: 是否使用 Cloudinary 儲存
        cloudinary_folder: Cloudinary 資料夾路徑
    
    Returns:
        ImageManager 實例
    """
    global _image_manager
    _image_manager = ImageManager(
        upload_folder,
        temp_file_ttl_hours,
        cloudinary_storage=cloudinary_storage,
        use_cloudinary=use_cloudinary,
        cloudinary_folder=cloudinary_folder
    )
    return _image_manager

