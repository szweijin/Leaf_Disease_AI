"""
整合檢測 API 服務
處理 CNN + YOLO 整合檢測的 HTTP 請求
"""

from flask import request, jsonify
from datetime import datetime
import os
import traceback
import io
import numpy as np
from PIL import Image
from src.core.core_helpers import get_user_id_from_session, log_api_request
from src.core.core_redis_manager import redis_manager
from src.core.core_db_manager import db
from src.core.core_user_manager import DetectionQueries
from src.services.service_integrated import IntegratedDetectionService
from src.services.service_image_manager import ImageManager
import logging

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
                # Verify the DB record still exists (cache may be stale after a DB reset)
                cached_prediction_id = cached_result.get('prediction_id', '')
                record_exists = False
                if cached_prediction_id:
                    try:
                        record_exists = bool(db.execute_query(
                            "SELECT 1 FROM detection_records WHERE prediction_log_id = %s AND user_id = %s",
                            (cached_prediction_id, user_id),
                            fetch_one=True
                        ))
                    except Exception:
                        record_exists = False
                if not record_exists:
                    logger.warning(f"⚠️  快取記錄已失效（DB 無對應記錄），重新執行預測: prediction_id={cached_prediction_id}")
                    redis_manager.delete(cache_key)
                    cached_result = None
                else:
                    logger.info(f"✅ 從快取獲取檢測結果: hash={image_hash[:8]}...")
                    # Null out any /image/ placeholder — no actual image is stored at those paths
                    cached_image_path = cached_result.get('image_path', '')
                    if cached_image_path and cached_image_path.startswith('/image/'):
                        cached_result['image_path'] = None
                        logger.info(f"🔄 已清除快取中的無效圖片路徑: {cached_image_path}")
                    execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
                    log_api_request(
                        user_id=user_id,
                        endpoint="/api/predict",
                        method="POST",
                        status_code=200,
                        execution_time_ms=execution_time,
                        error_message=None
                    )
                    return jsonify(cached_result)
            
            # 4. 創建臨時文件並執行檢測（使用上下文管理器自動清理）
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
                    
                    # 5. 執行整合檢測（先執行預測以獲取 prediction_id）
                    result = self.integrated_service.predict(
                        image_path=temp_file_path,
                        user_id=user_id,
                        image_source=image_source,
                        image_hash=image_hash,
                        web_image_path=None,  # 先不傳 URL，稍後更新
                        image_bytes=processed_bytes  # 傳遞圖片位元組
                    )
                    
                    # 6. 上傳原始圖片到 Cloudinary（如果啟用）- 存儲到 origin 資料夾
                    prediction_id = result.get('prediction_id')
                    cloudinary_original_url = None
                    if prediction_id and self.image_manager.use_cloudinary:
                        try:
                            upload_result = self.image_manager.upload_to_cloudinary(
                                processed_bytes,
                                public_id=f"origin/{prediction_id}",
                                folder="leaf_disease_ai/origin"
                            )
                            cloudinary_original_url = upload_result.get('secure_url')
                            logger.info(f"✅ 原始圖片已上傳到 Cloudinary (origin): {cloudinary_original_url}")
                            
                            # 更新資料庫中的 image_path 和 original_image_url
                            db.execute_update(
                                """
                                UPDATE prediction_log
                                SET image_path = %s, original_image_url = %s
                                WHERE id = %s
                                """,
                                (cloudinary_original_url, cloudinary_original_url, prediction_id)
                            )
                            logger.info(f"✅ 已更新資料庫中的原始圖片 URL")
                            
                            # 同時更新 detection_records 表中的 original_image_url
                            db.execute_update(
                                """
                                UPDATE detection_records
                                SET original_image_url = %s
                                WHERE prediction_log_id = %s AND user_id = %s
                                """,
                                (cloudinary_original_url, prediction_id, user_id)
                            )
                            logger.info(f"✅ 已更新 detection_records 中的原始圖片 URL")
                            
                            result['image_path'] = cloudinary_original_url
                        except Exception as e:
                            logger.warning(f"⚠️  上傳原始圖片到 Cloudinary 失敗: {str(e)}")
                            # 不中斷流程，繼續執行
                    
                    # 10. 如果有 YOLO 檢測結果，使用 YOLO predict() 方法生成帶框圖片並上傳到 Cloudinary
                    yolo_result = result.get('yolo_result')
                    if prediction_id and yolo_result and yolo_result.get('detected') and yolo_result.get('detections'):
                        try:
                            detections = yolo_result.get('detections', [])
                            if len(detections) > 0:
                                # 使用 YOLO 模型的 predict() 方法生成帶框圖片（不包含文字）
                                yolo_model = self.integrated_service.yolo_service.model
                                predict_results = yolo_model.predict(
                                    source=temp_file_path,
                                    save=False,  # 不保存到硬碟，我們要手動處理
                                    conf=0.75  # 設定最小置信度
                                )
                                
                                # 從結果中獲取帶框的圖片（numpy array）
                                if predict_results and len(predict_results) > 0:
                                    annotated_image_array = predict_results[0].plot(
                                        labels=False,  # 不顯示文字
                                        boxes=True,  # 顯示框
                                        line_width=2  # 框線寬度
                                    )
                                    
                                    # 將 numpy array 轉換為 PIL Image，再轉換為 bytes
                                    annotated_image = Image.fromarray(annotated_image_array)
                                    img_bytes = io.BytesIO()
                                    annotated_image.save(img_bytes, format='JPEG', quality=95)
                                    annotated_image_bytes = img_bytes.getvalue()
                                    
                                    logger.info(f"✅ 已使用 YOLO predict() 生成帶檢測框的圖片（無文字）")
                                    
                                    # 上傳到 Cloudinary（如果啟用）- 存儲到 predictions 資料夾
                                    predict_img_url = None
                                    if self.image_manager.use_cloudinary:
                                        try:
                                            upload_result = self.image_manager.upload_to_cloudinary(
                                                annotated_image_bytes,
                                                public_id=f"predictions/{prediction_id}",
                                                folder="leaf_disease_ai/predictions"
                                            )
                                            predict_img_url = upload_result.get('secure_url')
                                            logger.info(f"✅ 帶框圖片已上傳到 Cloudinary (predictions): {predict_img_url}")
                                            
                                            # 更新資料庫中的 predict_img_url
                                            db.execute_update(
                                                """
                                                UPDATE prediction_log
                                                SET predict_img_url = %s
                                                WHERE id = %s
                                                """,
                                                (predict_img_url, prediction_id)
                                            )
                                            logger.info(f"✅ 已更新資料庫中的帶框圖片 URL")
                                            
                                            # 同時更新 detection_records 表中的 annotated_image_url
                                            db.execute_update(
                                                """
                                                UPDATE detection_records
                                                SET annotated_image_url = %s
                                                WHERE prediction_log_id = %s AND user_id = %s
                                                """,
                                                (predict_img_url, prediction_id, user_id)
                                            )
                                            logger.info(f"✅ 已更新 detection_records 中的帶框圖片 URL")
                                            
                                            # 在返回結果中添加 predict_img_url
                                            result['predict_img_url'] = predict_img_url
                                            
                                        except Exception as e:
                                            logger.warning(f"⚠️  上傳帶框圖片到 Cloudinary 失敗: {str(e)}")
                                            # 不中斷流程，繼續返回結果
                                    else:
                                        logger.info("ℹ️  Cloudinary 未啟用，跳過帶框圖片上傳")
                                else:
                                    logger.warning("⚠️  YOLO predict() 未返回結果")
                        except Exception as e:
                            logger.warning(f"⚠️  生成帶框圖片失敗: {str(e)}", exc_info=True)
                            # 不中斷流程，繼續返回結果
            except FileNotFoundError as e:
                logger.error(f"❌ 臨時文件錯誤: {str(e)}", exc_info=True)
                raise
            except PermissionError as e:
                logger.error(f"❌ 文件權限錯誤: {str(e)}", exc_info=True)
                raise
            except Exception as e:
                logger.error(f"❌ 檢測執行錯誤: {str(e)}", exc_info=True)
                raise
            
            # 6. 查詢病害詳細資訊（如果檢測到病害）
            # 優先從 yolo_result 中獲取病害名稱，其次從 disease，最後從 cnn_result
            disease_name = None
            if result.get('yolo_result') and result.get('yolo_result', {}).get('detections'):
                # 從 YOLO 檢測結果中獲取第一個檢測到的病害
                detections = result.get('yolo_result', {}).get('detections', [])
                if detections and len(detections) > 0:
                    disease_name = detections[0].get('class')
            
            if not disease_name:
                disease_name = result.get('disease')
            
            if not disease_name:
                disease_name = result.get('cnn_result', {}).get('best_class')
            
            if disease_name and disease_name not in ['others', 'whole_plant']:
                logger.debug(f"🔍 查詢病害資訊: disease_name={disease_name}")
                disease_info = DetectionQueries.get_disease_info(disease_name)
                if disease_info:
                    logger.info(f"✅ 找到病害資訊: {disease_name} -> {disease_info.get('chinese_name', 'N/A')}")
                    
                    # 處理時間字段
                    disease_created_at = disease_info.get('created_at')
                    disease_updated_at = disease_info.get('updated_at')
                    
                    disease_created_at_str = None
                    if disease_created_at:
                        if hasattr(disease_created_at, 'isoformat'):
                            disease_created_at_str = disease_created_at.isoformat()
                        else:
                            disease_created_at_str = str(disease_created_at)
                    
                    disease_updated_at_str = None
                    if disease_updated_at:
                        if hasattr(disease_updated_at, 'isoformat'):
                            disease_updated_at_str = disease_updated_at.isoformat()
                        else:
                            disease_updated_at_str = str(disease_updated_at)
                    
                    result['disease_info'] = {
                        "id": disease_info.get('id'),
                        "disease_name": disease_info.get('disease_name'),  # 資料庫中的原始名稱
                        "chinese_name": disease_info.get('chinese_name'),
                        "english_name": disease_info.get('english_name'),
                        "causes": disease_info.get('causes'),
                        "features": disease_info.get('features'),
                        "symptoms": disease_info.get('symptoms'),
                        "pesticides": disease_info.get('pesticides'),
                        "management_measures": disease_info.get('management_measures'),
                        "target_crops": disease_info.get('target_crops'),
                        "severity_levels": disease_info.get('severity_levels'),
                        "prevention_tips": disease_info.get('prevention_tips'),
                        "reference_links": disease_info.get('reference_links'),
                        "created_at": disease_created_at_str,
                        "updated_at": disease_updated_at_str,
                        "is_active": disease_info.get('is_active')
                    }
                    # 如果有中文名稱，更新顯示名稱
                    if disease_info.get('chinese_name'):
                        result['disease'] = disease_info.get('chinese_name')
                else:
                    logger.warning(f"⚠️  未找到病害資訊: disease_name={disease_name}")
            
            # 7. 快取結果（1 小時）
            # Null out placeholder /image/ paths before caching — no actual image at those paths
            if result.get('image_path', '').startswith('/image/'):
                result['image_path'] = None
            redis_manager.set(cache_key, result, expire=3600)
            
            # 8. 記錄 API 日誌
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/api/predict", 
                method="POST",
                status_code=200, 
                execution_time_ms=execution_time,
                error_message=None
            )
            return jsonify(result)
            
        except ValueError as e:
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(
                user_id=user_id, 
                endpoint="/api/predict", 
                method="POST",
                status_code=400, 
                execution_time_ms=execution_time,
                error_message=str(e)
            )
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
            log_api_request(
                user_id=current_user_id, 
                endpoint="/api/predict", 
                method="POST",
                status_code=500, 
                execution_time_ms=execution_time,
                error_message=str(e)
            )
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
            crop_count = data.get("crop_count", 1)  # 默認為第 1 次 crop
            
            if not prediction_log_id:
                return jsonify({"error": "缺少 prediction_id"}), 400
            if not crop_coordinates:
                return jsonify({"error": "缺少 crop_coordinates"}), 400
            if not cropped_image:
                return jsonify({"error": "缺少 cropped_image"}), 400
            
            # 確保 crop_count 是整數且在合理範圍內
            try:
                crop_count = int(crop_count)
                if crop_count < 1:
                    crop_count = 1
                elif crop_count > 3:
                    crop_count = 3
            except (ValueError, TypeError):
                crop_count = 1
            
            logger.info(f"📊 Crop 次數: {crop_count}/3")
            
            # 2. 處理裁切後的圖片（使用圖片管理器）
            try:
                processed_bytes, image_hash = self.image_manager.process_cropped_image(cropped_image)
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception as e:
                logger.error(f"❌ 裁切圖片處理錯誤: {str(e)}")
                return jsonify({"error": "裁切圖片處理失敗"}), 400
            
            # 3. 創建臨時文件並執行檢測（使用上下文管理器自動清理）
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
                    
                    # 4. 執行檢測（先執行預測以獲取 prediction_id）
                    result = self.integrated_service.predict_with_crop(
                        cropped_image_path=temp_file_path,
                        user_id=user_id,
                        prediction_log_id=prediction_log_id,
                        crop_coordinates=crop_coordinates,
                        web_image_path=None,  # 先不傳 URL，稍後更新
                        image_bytes=processed_bytes,
                        crop_count=crop_count
                    )
                    
                    # 5. 上傳裁切後的原始圖片到 Cloudinary（如果啟用）- 存儲到 origin 資料夾
                    prediction_id = result.get('prediction_id')
                    cloudinary_original_url = None
                    if prediction_id and self.image_manager.use_cloudinary:
                        try:
                            upload_result = self.image_manager.upload_to_cloudinary(
                                processed_bytes,
                                public_id=f"origin/{prediction_id}",
                                folder="leaf_disease_ai/origin"
                            )
                            cloudinary_original_url = upload_result.get('secure_url')
                            logger.info(f"✅ 裁切原始圖片已上傳到 Cloudinary (origin): {cloudinary_original_url}")
                            
                            # 更新資料庫中的 image_path 和 original_image_url
                            db.execute_update(
                                """
                                UPDATE prediction_log
                                SET image_path = %s, original_image_url = %s
                                WHERE id = %s
                                """,
                                (cloudinary_original_url, cloudinary_original_url, prediction_id)
                            )
                            logger.info(f"✅ 已更新資料庫中的原始圖片 URL（裁切後）")
                            
                            # 同時更新 detection_records 表中的 original_image_url
                            db.execute_update(
                                """
                                UPDATE detection_records
                                SET original_image_url = %s
                                WHERE prediction_log_id = %s AND user_id = %s
                                """,
                                (cloudinary_original_url, prediction_id, user_id)
                            )
                            logger.info(f"✅ 已更新 detection_records 中的原始圖片 URL（裁切後）")
                            
                            result['image_path'] = cloudinary_original_url
                        except Exception as e:
                            logger.warning(f"⚠️  上傳原始圖片到 Cloudinary 失敗: {str(e)}")
                            # 不中斷流程，繼續執行
                    
                    # 9. 如果有 YOLO 檢測結果，使用 YOLO predict() 方法生成帶框圖片並上傳到 Cloudinary
                    yolo_result = result.get('yolo_result')
                    if prediction_id and yolo_result and yolo_result.get('detected') and yolo_result.get('detections'):
                        try:
                            detections = yolo_result.get('detections', [])
                            if len(detections) > 0:
                                # 使用 YOLO 模型的 predict() 方法生成帶框圖片（不包含文字）
                                yolo_model = self.integrated_service.yolo_service.model
                                predict_results = yolo_model.predict(
                                    source=temp_file_path,
                                    save=False,  # 不保存到硬碟，我們要手動處理
                                    conf=0.75  # 設定最小置信度
                                )
                                
                                # 從結果中獲取帶框的圖片（numpy array）
                                if predict_results and len(predict_results) > 0:
                                    annotated_image_array = predict_results[0].plot(
                                        labels=False,  # 不顯示文字
                                        boxes=True,  # 顯示框
                                        line_width=2  # 框線寬度
                                    )
                                    
                                    # 將 numpy array 轉換為 PIL Image，再轉換為 bytes
                                    annotated_image = Image.fromarray(annotated_image_array)
                                    img_bytes = io.BytesIO()
                                    annotated_image.save(img_bytes, format='JPEG', quality=95)
                                    annotated_image_bytes = img_bytes.getvalue()
                                    
                                    logger.info(f"✅ 已使用 YOLO predict() 生成帶檢測框的圖片（無文字，裁切後）")
                                    
                                    # 上傳到 Cloudinary（如果啟用）- 存儲到 predictions 資料夾
                                    predict_img_url = None
                                    if self.image_manager.use_cloudinary:
                                        try:
                                            upload_result = self.image_manager.upload_to_cloudinary(
                                                annotated_image_bytes,
                                                public_id=f"predictions/{prediction_id}",
                                                folder="leaf_disease_ai/predictions"
                                            )
                                            predict_img_url = upload_result.get('secure_url')
                                            logger.info(f"✅ 帶框圖片已上傳到 Cloudinary (predictions): {predict_img_url}")
                                            
                                            # 更新資料庫中的 predict_img_url
                                            db.execute_update(
                                                """
                                                UPDATE prediction_log
                                                SET predict_img_url = %s
                                                WHERE id = %s
                                                """,
                                                (predict_img_url, prediction_id)
                                            )
                                            logger.info(f"✅ 已更新資料庫中的帶框圖片 URL（裁切後）")
                                            
                                            # 同時更新 detection_records 表中的 annotated_image_url
                                            db.execute_update(
                                                """
                                                UPDATE detection_records
                                                SET annotated_image_url = %s
                                                WHERE prediction_log_id = %s AND user_id = %s
                                                """,
                                                (predict_img_url, prediction_id, user_id)
                                            )
                                            logger.info(f"✅ 已更新 detection_records 中的帶框圖片 URL（裁切後）")
                                            
                                            # 在返回結果中添加 predict_img_url
                                            result['predict_img_url'] = predict_img_url
                                            
                                        except Exception as e:
                                            logger.warning(f"⚠️  上傳帶框圖片到 Cloudinary 失敗: {str(e)}")
                                            # 不中斷流程，繼續返回結果
                                    else:
                                        logger.info("ℹ️  Cloudinary 未啟用，跳過帶框圖片上傳")
                                else:
                                    logger.warning("⚠️  YOLO predict() 未返回結果")
                        except Exception as e:
                            logger.warning(f"⚠️  生成帶框圖片失敗: {str(e)}", exc_info=True)
                            # 不中斷流程，繼續返回結果
                    # 確保臨時文件已刪除（上下文管理器會自動處理，這裡是雙重保險）
                    logger.debug(f"✅ 裁切檢測完成，臨時文件將自動清理: {temp_file_path}")
            except FileNotFoundError as e:
                logger.error(f"❌ 臨時文件錯誤: {str(e)}", exc_info=True)
                raise
            except PermissionError as e:
                logger.error(f"❌ 文件權限錯誤: {str(e)}", exc_info=True)
                raise
            except Exception as e:
                logger.error(f"❌ 檢測執行錯誤: {str(e)}", exc_info=True)
                raise
            
            # 5. 查詢病害詳細資訊（如果檢測到病害）
            # 優先從 yolo_result 中獲取病害名稱，其次從 disease，最後從 cnn_result
            disease_name = None
            if result.get('yolo_result') and result.get('yolo_result', {}).get('detections'):
                # 從 YOLO 檢測結果中獲取第一個檢測到的病害
                detections = result.get('yolo_result', {}).get('detections', [])
                if detections and len(detections) > 0:
                    disease_name = detections[0].get('class')
            
            if not disease_name:
                disease_name = result.get('disease')
            
            if not disease_name:
                disease_name = result.get('cnn_result', {}).get('best_class')
            
            if disease_name and disease_name not in ['others', 'whole_plant']:
                logger.debug(f"🔍 查詢病害資訊（裁切後）: disease_name={disease_name}")
                disease_info = DetectionQueries.get_disease_info(disease_name)
                if disease_info:
                    logger.info(f"✅ 找到病害資訊（裁切後）: {disease_name} -> {disease_info.get('chinese_name', 'N/A')}")
                    
                    # 處理時間字段
                    disease_created_at = disease_info.get('created_at')
                    disease_updated_at = disease_info.get('updated_at')
                    
                    disease_created_at_str = None
                    if disease_created_at:
                        if hasattr(disease_created_at, 'isoformat'):
                            disease_created_at_str = disease_created_at.isoformat()
                        else:
                            disease_created_at_str = str(disease_created_at)
                    
                    disease_updated_at_str = None
                    if disease_updated_at:
                        if hasattr(disease_updated_at, 'isoformat'):
                            disease_updated_at_str = disease_updated_at.isoformat()
                        else:
                            disease_updated_at_str = str(disease_updated_at)
                    
                    result['disease_info'] = {
                        "id": disease_info.get('id'),
                        "disease_name": disease_info.get('disease_name'),  # 資料庫中的原始名稱
                        "chinese_name": disease_info.get('chinese_name'),
                        "english_name": disease_info.get('english_name'),
                        "causes": disease_info.get('causes'),
                        "features": disease_info.get('features'),
                        "symptoms": disease_info.get('symptoms'),
                        "pesticides": disease_info.get('pesticides'),
                        "management_measures": disease_info.get('management_measures'),
                        "target_crops": disease_info.get('target_crops'),
                        "severity_levels": disease_info.get('severity_levels'),
                        "prevention_tips": disease_info.get('prevention_tips'),
                        "reference_links": disease_info.get('reference_links'),
                        "created_at": disease_created_at_str,
                        "updated_at": disease_updated_at_str,
                        "is_active": disease_info.get('is_active')
                    }
                    # 如果有中文名稱，更新顯示名稱
                    if disease_info.get('chinese_name'):
                        result['disease'] = disease_info.get('chinese_name')
                else:
                    logger.warning(f"⚠️  未找到病害資訊（裁切後）: disease_name={disease_name}")
            
            # 6. 記錄 API 日誌
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/api/predict-crop", method="POST",
                           status_code=200, execution_time_ms=execution_time)

            # Null out placeholder /image/ paths — no actual image at those paths
            if result.get('image_path', '').startswith('/image/'):
                result['image_path'] = None

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

