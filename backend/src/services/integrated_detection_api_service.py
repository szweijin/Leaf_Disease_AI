# integrated_detection_api_service.py
# 整合檢測 API 服務 - CNN + YOLO 完整流程

from flask import request, jsonify
from datetime import datetime
import os
import traceback
from src.core.helpers import get_user_id_from_session, log_api_request
from src.core.redis_manager import redis_manager
from src.services.integrated_detection_service import IntegratedDetectionService
from src.services.image_manager import ImageManager
import logging

logger = logging.getLogger(__name__)


class IntegratedDetectionAPIService:
    """整合檢測 API 服務類"""
    
    def __init__(self, integrated_service: IntegratedDetectionService, image_manager: ImageManager):
        self.integrated_service = integrated_service
        self.image_manager = image_manager
    
    def predict(self):
        """處理整合檢測請求（CNN + YOLO）"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        
        if not self.integrated_service:
            return jsonify({"error": "檢測服務未載入"}), 500
        
        try:
            # 1. 解析圖片資料
            if not request.json:
                return jsonify({"error": "請求資料格式錯誤（缺少 JSON 資料）"}), 400
            
            img_data = request.json.get("image")
            image_source = request.json.get("source", "upload")
            
            if not img_data:
                return jsonify({"error": "無圖片資料"}), 400
            
            # 2. 解碼並處理圖片（使用圖片管理器）
            try:
                img_bytes = self.image_manager.decode_base64_image(img_data)
                processed_bytes, image_hash = self.image_manager.process_uploaded_image(img_bytes, resize=True)
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception as e:
                logger.error(f"❌ 圖片處理錯誤: {str(e)}")
                return jsonify({"error": "圖片處理失敗"}), 400
            
            # 3. 檢查快取
            cache_key = f"integrated_detection:{image_hash}:{user_id}"
            cached_result = redis_manager.get(cache_key)
            if cached_result:
                logger.info(f"✅ 從快取獲取檢測結果: hash={image_hash[:8]}...")
                execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
                log_api_request(user_id=user_id, endpoint="/api/predict", method="POST",
                               status_code=200, execution_time_ms=execution_time)
                return jsonify(cached_result)
            
            # 4. 上傳圖片到 Cloudinary（如果啟用）
            cloudinary_original_url = None
            cloudinary_public_id = None
            if self.image_manager.use_cloudinary:
                try:
                    upload_result = self.image_manager.upload_to_cloudinary(processed_bytes)
                    cloudinary_public_id = upload_result.get('public_id')
                    cloudinary_original_url = upload_result.get('secure_url')
                    logger.info(f"✅ 圖片已上傳到 Cloudinary: {cloudinary_original_url}")
                    logger.info(f"   Public ID: {cloudinary_public_id}")
                except Exception as e:
                    logger.error(f"❌ Cloudinary 上傳失敗: {str(e)}", exc_info=True)
                    # 上傳失敗不應該阻止預測，繼續使用本地儲存
                    logger.warning(f"⚠️  將使用本地儲存繼續預測")
            
            # 5. 創建臨時文件並執行檢測（使用上下文管理器自動清理）
            # 注意：儲存到資料庫的是原始 URL，轉換後的 URL 只用於預測驗證
            try:
                with self.image_manager.create_temp_file(processed_bytes, suffix='.jpg') as temp_file_path:
                    # 驗證臨時文件是否存在且可讀
                    if not os.path.exists(temp_file_path):
                        raise FileNotFoundError(f"臨時文件不存在: {temp_file_path}")
                    if not os.access(temp_file_path, os.R_OK):
                        raise PermissionError(f"臨時文件無法讀取: {temp_file_path}")
                    
                    # 記錄臨時文件信息（用於調試）
                    file_size = os.path.getsize(temp_file_path)
                    logger.debug(f"📁 臨時文件已創建: {temp_file_path}, 大小: {file_size} bytes")
                    
                    # 8. 執行整合檢測（傳遞原始 Cloudinary URL 用於儲存）
                    result = self.integrated_service.predict(
                        image_path=temp_file_path,
                        user_id=user_id,
                        image_source=image_source,
                        image_hash=image_hash,
                        web_image_path=cloudinary_original_url,  # 傳遞原始 Cloudinary URL（用於儲存到資料庫）
                        image_bytes=processed_bytes  # 傳遞圖片位元組
                    )
            except FileNotFoundError as e:
                logger.error(f"❌ 臨時文件錯誤: {str(e)}", exc_info=True)
                raise
            except PermissionError as e:
                logger.error(f"❌ 文件權限錯誤: {str(e)}", exc_info=True)
                raise
            except Exception as e:
                logger.error(f"❌ 檢測執行錯誤: {str(e)}", exc_info=True)
                raise
            
            # 6. 快取結果（1 小時）
            redis_manager.set(cache_key, result, expire=3600)
            
            # 7. 記錄 API 日誌
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/api/predict", method="POST",
                           status_code=200, execution_time_ms=execution_time)
            
            return jsonify(result)
            
        except ValueError as e:
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/api/predict", method="POST",
                           status_code=400, execution_time_ms=execution_time, error_message=str(e))
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"❌ 整合檢測錯誤: {str(e)}")
            logger.error(f"錯誤堆疊:\n{error_traceback}")
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            # 安全獲取 user_id
            try:
                current_user_id = get_user_id_from_session()
            except:
                current_user_id = None
            log_api_request(user_id=current_user_id, endpoint="/api/predict", method="POST",
                           status_code=500, execution_time_ms=execution_time, error_message=str(e))
            # 在開發環境中返回詳細錯誤信息
            if os.getenv('FLASK_ENV') == 'development' or os.getenv('ENV') == 'development':
                return jsonify({
                    "error": "系統發生錯誤",
                    "details": str(e),
                    "traceback": error_traceback
                }), 500
            # 生產環境返回簡化的錯誤信息
            return jsonify({
                "error": "系統發生錯誤",
                "message": "預測過程中發生錯誤，請稍後再試"
            }), 500
    
    def predict_with_crop(self):
        """處理裁切後的圖片檢測請求"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        
        if not self.integrated_service:
            return jsonify({"error": "檢測服務未載入"}), 500
        
        try:
            # 1. 解析請求資料
            if not request.json:
                return jsonify({"error": "請求資料格式錯誤（缺少 JSON 資料）"}), 400
            
            data = request.json
            prediction_log_id = data.get("prediction_id")
            crop_coordinates = data.get("crop_coordinates")
            cropped_image = data.get("cropped_image")
            
            if not prediction_log_id:
                return jsonify({"error": "缺少 prediction_id"}), 400
            if not crop_coordinates:
                return jsonify({"error": "缺少 crop_coordinates"}), 400
            if not cropped_image:
                return jsonify({"error": "缺少 cropped_image"}), 400
            
            # 2. 處理裁切後的圖片（使用圖片管理器）
            try:
                processed_bytes, image_hash = self.image_manager.process_cropped_image(cropped_image)
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception as e:
                logger.error(f"❌ 裁切圖片處理錯誤: {str(e)}")
                return jsonify({"error": "裁切圖片處理失敗"}), 400
            
            # 3. 上傳圖片到 Cloudinary（如果啟用）
            cloudinary_original_url = None
            cloudinary_public_id = None
            if self.image_manager.use_cloudinary:
                try:
                    upload_result = self.image_manager.upload_to_cloudinary(processed_bytes)
                    cloudinary_public_id = upload_result.get('public_id')
                    cloudinary_original_url = upload_result.get('secure_url')
                    logger.info(f"✅ 裁切圖片已上傳到 Cloudinary: {cloudinary_original_url}")
                    logger.info(f"   Public ID: {cloudinary_public_id}")
                except Exception as e:
                    logger.error(f"❌ Cloudinary 上傳失敗: {str(e)}", exc_info=True)
                    # 上傳失敗不應該阻止預測，繼續使用本地儲存
                    logger.warning(f"⚠️  將使用本地儲存繼續預測")
            
            # 4. 創建臨時文件並執行檢測（使用上下文管理器自動清理）
            # 注意：儲存到資料庫的是原始 URL，轉換後的 URL 只用於預測驗證
            # 注意：臨時文件僅用於模型推理，檢測完成後會自動刪除
            # 圖片只存儲在資料庫中，不存儲在文件系統
            try:
                with self.image_manager.create_temp_file(processed_bytes, suffix='.jpg') as temp_file_path:
                    # 驗證臨時文件是否存在且可讀
                    if not os.path.exists(temp_file_path):
                        raise FileNotFoundError(f"臨時文件不存在: {temp_file_path}")
                    if not os.access(temp_file_path, os.R_OK):
                        raise PermissionError(f"臨時文件無法讀取: {temp_file_path}")
                    
                    # 記錄臨時文件信息（用於調試）
                    file_size = os.path.getsize(temp_file_path)
                    logger.debug(f"📁 臨時文件已創建: {temp_file_path}, 大小: {file_size} bytes")
                    
                    # 7. 執行檢測（傳遞原始 Cloudinary URL 用於儲存）
                    result = self.integrated_service.predict_with_crop(
                        cropped_image_path=temp_file_path,
                        user_id=user_id,
                        prediction_log_id=prediction_log_id,
                        crop_coordinates=crop_coordinates,
                        image_source='crop',
                        web_image_path=cloudinary_original_url,  # 傳遞原始 Cloudinary URL（用於儲存到資料庫）
                        image_bytes=processed_bytes  # 傳遞圖片位元組
                    )
                    
                    # 確保臨時文件已刪除（上下文管理器會自動處理，這裡是雙重保險）
                    logger.debug(f"✅ 裁切檢測完成，臨時文件將自動清理: {temp_file_path}")
            except FileNotFoundError as e:
                logger.error(f"❌ 臨時文件錯誤: {str(e)}", exc_info=True)
                raise
            except PermissionError as e:
                logger.error(f"❌ 文件權限錯誤: {str(e)}", exc_info=True)
                raise
            except Exception as e:
                logger.error(f"❌ 裁切檢測執行錯誤: {str(e)}", exc_info=True)
                raise
            
            # 5. 記錄 API 日誌
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/api/predict-crop", method="POST",
                           status_code=200, execution_time_ms=execution_time)
            
            return jsonify(result)
            
        except Exception as e:
            error_traceback = traceback.format_exc()
            logger.error(f"❌ 裁切檢測錯誤: {str(e)}")
            logger.error(f"錯誤堆疊:\n{error_traceback}")
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            # 安全獲取 user_id
            try:
                current_user_id = get_user_id_from_session()
            except:
                current_user_id = None
            log_api_request(user_id=current_user_id, endpoint="/api/predict-crop", method="POST",
                           status_code=500, execution_time_ms=execution_time, error_message=str(e))
            # 在開發環境中返回詳細錯誤信息
            if os.getenv('FLASK_ENV') == 'development' or os.getenv('ENV') == 'development':
                return jsonify({
                    "error": "系統發生錯誤",
                    "details": str(e),
                    "traceback": error_traceback
                }), 500
            # 生產環境返回簡化的錯誤信息
            return jsonify({
                "error": "系統發生錯誤",
                "message": "裁切檢測過程中發生錯誤，請稍後再試"
            }), 500

