"""
Cloudinary 圖片儲存服務
提供 Cloudinary 圖片上傳、刪除、轉換等功能
"""    

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url
import logging
from typing import Optional, Dict, Any, Tuple
import io
from PIL import Image

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class CloudinaryStorage:
    """Cloudinary 圖片儲存服務類"""
    
    def __init__(self, cloud_name: str, api_key: str, api_secret: str, secure: bool = True):
        """
        初始化 Cloudinary 儲存服務
        
        Args:
            cloud_name: Cloudinary cloud name
            api_key: Cloudinary API key
            api_secret: Cloudinary API secret
            secure: 是否使用 HTTPS
        """
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=secure
        )
        self.cloud_name = cloud_name
        logger.info(f"✅ Cloudinary 儲存服務初始化: cloud_name={cloud_name}")
    
    def upload_image(
        self,
        image_bytes: bytes,
        public_id: Optional[str] = None,
        folder: Optional[str] = None,
        resource_type: str = "image",
        overwrite: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        上傳圖片到 Cloudinary
        
        Args:
            image_bytes: 圖片位元組資料
            public_id: 公開 ID（可選，會自動生成）
            folder: 資料夾路徑（可選）
            resource_type: 資源類型，預設 "image"
            overwrite: 是否覆蓋已存在的圖片
            **kwargs: 其他 Cloudinary 上傳選項
        
        Returns:
            上傳結果字典，包含 secure_url, public_id 等
        """
        try:
            # 確保 public_id 有 .jpg 擴展名（如果提供但沒有擴展名）
            if public_id and not public_id.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                public_id = f"{public_id}.jpg"
            
            # 準備上傳選項
            upload_options = {
                "resource_type": resource_type,
                "overwrite": overwrite,
            }
            
            if folder:
                upload_options["folder"] = folder
            
            if public_id:
                upload_options["public_id"] = public_id
            
            # 合併其他選項
            upload_options.update(kwargs)
            
            # 上傳圖片（使用 bytes）
            upload_result = cloudinary.uploader.upload(
                image_bytes,
                **upload_options
            )
            
            logger.info(f"✅ 圖片上傳成功: public_id={upload_result.get('public_id')}, url={upload_result.get('secure_url')}")
            return upload_result
            
        except Exception as e:
            logger.error(f"❌ Cloudinary 上傳失敗: {str(e)}")
            raise
    
    def upload_image_from_path(
        self,
        file_path: str,
        public_id: Optional[str] = None,
        folder: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        從文件路徑上傳圖片到 Cloudinary
        
        Args:
            file_path: 本地文件路徑
            public_id: 公開 ID（可選，格式：uuid.jpg）
            folder: 資料夾路徑（可選）
            **kwargs: 其他 Cloudinary 上傳選項
        
        Returns:
            上傳結果字典
        """
        try:
            # 確保 public_id 有 .jpg 擴展名（如果提供但沒有擴展名）
            if public_id and not public_id.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                public_id = f"{public_id}.jpg"
            
            upload_options = {}
            if folder:
                upload_options["folder"] = folder
            if public_id:
                upload_options["public_id"] = public_id
            upload_options.update(kwargs)
            
            upload_result = cloudinary.uploader.upload(file_path, **upload_options)
            logger.info(f"✅ 圖片上傳成功: public_id={upload_result.get('public_id')}")
            return upload_result
            
        except Exception as e:
            logger.error(f"❌ Cloudinary 上傳失敗: {str(e)}")
            raise
    
    def get_image_url(
        self,
        public_id: str,
        transformation: Optional[Dict[str, Any]] = None,
        fetch_format: str = "auto",
        quality: str = "auto",
        **kwargs
    ) -> str:
        """
        獲取圖片 URL（可選轉換）
        
        Args:
            public_id: 公開 ID
            transformation: 轉換選項字典
            fetch_format: 自動格式（auto, jpg, png 等）
            quality: 自動品質（auto, 或 1-100）
            **kwargs: 其他 URL 選項
        
        Returns:
            圖片 URL
        """
        try:
            url_options = {
                "fetch_format": fetch_format,
                "quality": quality,
            }
            
            if transformation:
                url_options.update(transformation)
            
            url_options.update(kwargs)
            
            url, _ = cloudinary_url(public_id, **url_options)
            return url
            
        except Exception as e:
            logger.error(f"❌ 獲取圖片 URL 失敗: {str(e)}")
            raise
    
    def delete_image(self, public_id: str, resource_type: str = "image") -> Dict[str, Any]:
        """
        刪除 Cloudinary 上的圖片
        
        Args:
            public_id: 公開 ID
            resource_type: 資源類型，預設 "image"
        
        Returns:
            刪除結果字典
        """
        try:
            result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            if result.get("result") == "ok":
                logger.info(f"✅ 圖片已刪除: public_id={public_id}")
            else:
                logger.warning(f"⚠️  刪除圖片失敗: public_id={public_id}, result={result.get('result')}")
            return result
            
        except Exception as e:
            logger.error(f"❌ 刪除圖片失敗: {str(e)}")
            raise
    
    def optimize_url(
        self,
        public_id: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        crop: str = "auto",
        gravity: str = "auto",
        fetch_format: str = "auto",
        quality: str = "auto"
    ) -> str:
        """
        獲取優化後的圖片 URL（自動裁切、格式、品質）
        
        Args:
            public_id: 公開 ID
            width: 寬度（可選）
            height: 高度（可選）
            crop: 裁切模式，預設 "auto"
            gravity: 重力模式，預設 "auto"
            fetch_format: 自動格式
            quality: 自動品質
        
        Returns:
            優化後的圖片 URL
        """
        try:
            url_options = {
                "fetch_format": fetch_format,
                "quality": quality,
            }
            
            if width or height:
                if width:
                    url_options["width"] = width
                if height:
                    url_options["height"] = height
                url_options["crop"] = crop
                url_options["gravity"] = gravity
            
            url, _ = cloudinary_url(public_id, **url_options)
            return url
            
        except Exception as e:
            logger.error(f"❌ 獲取優化 URL 失敗: {str(e)}")
            raise
    
    def get_transformed_url(
        self,
        public_id: str,
        transformation: list = None,
        fetch_format: str = "auto",
        quality: str = "auto"
    ) -> str:
        """
        獲取帶有轉換的圖片 URL（使用 transformation 參數）
        
        Args:
            public_id: 公開 ID
            transformation: 轉換列表，例如 ["scale640"] 或 [{"width": 640, "height": 640, "crop": "scale"}]
            fetch_format: 自動格式
            quality: 自動品質
        
        Returns:
            轉換後的圖片 URL
        """
        try:
            url_options = {
                "fetch_format": fetch_format,
                "quality": quality,
            }
            
            if transformation:
                url_options["transformation"] = transformation
            
            url, _ = cloudinary_url(public_id, **url_options)
            return url
            
        except Exception as e:
            logger.error(f"❌ 獲取轉換 URL 失敗: {str(e)}")
            raise


# 全局實例
_cloudinary_storage: Optional[CloudinaryStorage] = None


def get_cloudinary_storage() -> CloudinaryStorage:
    """獲取全局 Cloudinary 儲存服務實例"""
    if _cloudinary_storage is None:
        raise RuntimeError("Cloudinary 儲存服務尚未初始化，請先調用 init_cloudinary_storage()")
    return _cloudinary_storage


def init_cloudinary_storage(
    cloud_name: str,
    api_key: str,
    api_secret: str,
    secure: bool = True
) -> CloudinaryStorage:
    """
    初始化全局 Cloudinary 儲存服務
    
    Args:
        cloud_name: Cloudinary cloud name
        api_key: Cloudinary API key
        api_secret: Cloudinary API secret
        secure: 是否使用 HTTPS
    
    Returns:
        CloudinaryStorage 實例
    """
    global _cloudinary_storage
    _cloudinary_storage = CloudinaryStorage(cloud_name, api_key, api_secret, secure)
    return _cloudinary_storage

