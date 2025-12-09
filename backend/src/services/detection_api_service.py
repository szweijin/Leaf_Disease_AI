# detection_api_service.py
# 檢測相關的 API 業務邏輯

from flask import request, jsonify, Response, send_from_directory
from datetime import datetime
import base64
import os
import uuid
from src.core.helpers import get_user_id_from_session, log_api_request
from src.core.db_manager import db
from src.core.redis_manager import redis_manager
from src.core.user_manager import DetectionQueries
from src.services.detection_service import DetectionService
from src.services.image_service import ImageService
import logging

logger = logging.getLogger(__name__)


class DetectionAPIService:
    """檢測 API 服務類"""
    
    def __init__(self, detection_service: DetectionService, upload_folder: str):
        self.detection_service = detection_service
        self.upload_folder = upload_folder
    
    def predict(self):
        """處理病害檢測請求"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        if not self.detection_service:
            return jsonify({"error": "模型未載入"}), 500
        try:
            img_data = request.json.get("image")
            image_source = request.json.get("source", "upload")
            if not img_data:
                return jsonify({"error": "無圖片資料"}), 400
            if "," in img_data:
                _, encoded = img_data.split(",", 1)
            else:
                encoded = img_data
            try:
                img_bytes = base64.b64decode(encoded)
            except Exception:
                return jsonify({"error": "圖片格式錯誤"}), 400
            processed_bytes, image_hash = ImageService.process_image(img_bytes, resize=True)
            
            # 檢查快取中是否有相同 hash 的結果
            cache_key = f"detection_result:{image_hash}:{user_id}"
            cached_result = redis_manager.get(cache_key)
            if cached_result:
                logger.info(f"✅ 從快取獲取檢測結果: hash={image_hash[:8]}...")
                execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
                log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                               status_code=200, execution_time_ms=execution_time)
                return jsonify(cached_result)
            
            # 創建臨時文件用於模型推理（模型需要文件路徑）
            import tempfile
            temp_file = None
            temp_file_path = None
            try:
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', dir=self.upload_folder)
                temp_file.write(processed_bytes)
                temp_file_path = temp_file.name
                temp_file.close()
                temp_file = None
                
                # 執行檢測（傳遞圖片位元組用於存儲到資料庫）
                result = self.detection_service.predict(
                    image_path=temp_file_path, 
                    user_id=user_id,
                    image_source=image_source, 
                    image_hash=image_hash,
                    image_bytes=processed_bytes  # 傳遞圖片位元組用於存儲到資料庫
                )
            finally:
                # 確保臨時文件被刪除（無論成功或失敗）
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                        logger.info(f"🗑️  臨時文件已刪除: {temp_file_path}")
                    except Exception as e:
                        logger.warning(f"⚠️  刪除臨時文件失敗: {str(e)}")
                if temp_file:
                    try:
                        temp_file.close()
                    except:
                        pass
            
            # 快取結果 1 小時
            redis_manager.set(cache_key, result, expire=3600)
            
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                           status_code=200, execution_time_ms=execution_time)
            return jsonify(result)
        except ValueError as e:
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                           status_code=400, execution_time_ms=execution_time, error_message=str(e))
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            logger.error(f"❌ 預測錯誤: {str(e)}")
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/predict", method="POST",
                           status_code=500, execution_time_ms=execution_time, error_message=str(e))
            return jsonify({"error": "系統發生錯誤"}), 500
    
    def get_history(self):
        """獲取檢測歷史記錄（支持分頁、排序、過濾）"""
        start_time = datetime.now()
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        
        try:
            # 獲取查詢參數
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 20, type=int)
            order_by = request.args.get('order_by', 'created_at', type=str)
            order_dir = request.args.get('order_dir', 'DESC', type=str)
            disease_filter = request.args.get('disease', None, type=str)
            min_confidence = request.args.get('min_confidence', None, type=float)
            
            # 限制每頁最大記錄數
            per_page = min(per_page, 100)
            offset = (page - 1) * per_page
            
            # 查詢記錄
            records, total_count = DetectionQueries.get_user_detections(
                user_id=user_id,
                limit=per_page,
                offset=offset,
                order_by=order_by,
                order_dir=order_dir,
                disease_filter=disease_filter,
                min_confidence=min_confidence
            )
            
            logger.info(f"📊 查詢到 {len(records)}/{total_count} 筆檢測記錄 (user_id={user_id}, page={page}, per_page={per_page})")
            if records:
                logger.debug(f"📋 原始記錄樣本: {records[0]}")
                logger.debug(f"📋 記錄字段: {list(records[0].keys()) if records else []}")
            else:
                logger.warning(f"⚠️ 沒有查詢到任何記錄 (user_id={user_id})")
            
            formatted_records = []
            for record in records:
                created_at = record.get('created_at')
                image_path = record.get('image_path')
                record_id = record.get('id')
                disease_name = record.get('disease_name')
                
                # 處理圖片路徑：優先使用 Cloudinary URL，然後是資料庫存儲的圖片
                image_compressed = record.get('image_compressed', False)
                image_url = None
                
                if image_path:
                    # 優先檢查是否為 Cloudinary URL（http:// 或 https://）
                    if image_path.startswith('http://') or image_path.startswith('https://'):
                        # Cloudinary URL，直接使用
                        image_url = image_path
                        logger.debug(f"✅ 使用 Cloudinary URL: {image_url}")
                    elif image_path.startswith('/image/'):
                        # 資料庫 URL，直接使用
                        image_url = image_path
                        logger.debug(f"✅ 使用資料庫 URL: {image_url}")
                    elif image_compressed and record_id:
                        # 如果標記為已壓縮但路徑不是 /image/，使用資料庫圖片 API
                        image_url = f"/image/{record_id}"
                        logger.debug(f"✅ 使用資料庫圖片 API: {image_url}")
                    elif os.path.isabs(image_path) and '/uploads/' in image_path:
                        # 絕對路徑包含 /uploads/
                        uploads_index = image_path.find('/uploads/')
                        if uploads_index >= 0:
                            image_path = image_path[uploads_index:]
                            image_url = image_path
                            logger.debug(f"✅ 從絕對路徑提取: {image_url}")
                    elif image_path.startswith('/uploads/'):
                        # 相對路徑 /uploads/
                        image_url = image_path
                        logger.debug(f"✅ 使用上傳路徑: {image_url}")
                    elif not image_path.startswith('/'):
                        # 相對路徑，轉換為 /uploads/ 路徑
                        filename = os.path.basename(image_path)
                        image_url = f"/uploads/{filename}"
                        logger.debug(f"✅ 轉換相對路徑: {image_url}")
                    else:
                        # 其他情況，直接使用
                        image_url = image_path
                        logger.debug(f"✅ 使用原始路徑: {image_url}")
                elif image_compressed and record_id:
                    # 沒有 image_path 但標記為已壓縮，使用資料庫圖片 API
                    image_url = f"/image/{record_id}"
                    logger.debug(f"✅ 使用資料庫圖片 API（無路徑）: {image_url}")
                else:
                    # 沒有圖片路徑
                    image_url = None
                    logger.warning(f"⚠️  記錄 {record_id} 沒有圖片路徑")
                
                # 處理病害名稱顯示（將 "others" 轉換為更友好的名稱）
                display_disease = disease_name
                if disease_name == 'others':
                    display_disease = '非植物影像'
                elif disease_name == 'whole_plant':
                    display_disease = '整株植物'
                
                # 處理時間字段：確保正確序列化
                timestamp_str = None
                created_at_str = None
                if created_at:
                    if hasattr(created_at, 'isoformat'):
                        timestamp_str = created_at.isoformat()
                        created_at_str = created_at.isoformat()
                    else:
                        # 如果是字符串，直接使用
                        timestamp_str = str(created_at)
                        created_at_str = str(created_at)
                
                formatted_records.append({
                    "id": record_id,
                    "disease": display_disease,  # 使用友好的顯示名稱
                    "disease_name": disease_name,  # 保留原始名稱
                    "severity": record.get('severity', 'Unknown'),
                    "confidence": float(record.get('confidence', 0)),
                    "image_path": image_url,
                    "image_compressed": image_compressed,
                    "image_source": record.get('image_source', 'upload'),
                    "status": record.get('status', 'completed'),
                    "processing_time_ms": record.get('processing_time_ms'),
                    "timestamp": timestamp_str,
                    "created_at": created_at_str
                })
            
            # 計算分頁資訊
            total_pages = (total_count + per_page - 1) // per_page if total_count > 0 else 0
            
            response_data = {
                "records": formatted_records,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total_count,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1
                }
            }
            
            logger.info(f"✅ 返回 {len(formatted_records)} 筆格式化記錄，總計 {total_count} 筆")
            logger.debug(f"📤 響應數據樣本: {response_data['records'][0] if formatted_records else '無記錄'}")
            
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id, endpoint="/history", method="GET",
                           status_code=200, execution_time_ms=execution_time)
            
            return jsonify(response_data)
            
        except Exception as e:
            logger.error(f"❌ 查詢歷史失敗: {str(e)}", exc_info=True)
            execution_time = int((datetime.now() - start_time).total_seconds() * 1000)
            log_api_request(user_id=user_id if 'user_id' in locals() else None, 
                          endpoint="/history", method="GET",
                          status_code=500, execution_time_ms=execution_time, 
                          error_message=str(e))
            return jsonify({"error": "系統錯誤", "message": str(e)}), 500
    
    def serve_uploaded_file(self, filename: str):
        """提供上傳的圖片文件"""
        try:
            return send_from_directory(self.upload_folder, filename)
        except Exception as e:
            logger.error(f"❌ 提供圖片文件失敗: {str(e)}")
            return jsonify({"error": "文件不存在"}), 404
    
    def get_image_from_db(self, record_id: int):
        """從 Cloudinary 或本地獲取圖片（圖片不再儲存在資料庫）"""
        user_id = get_user_id_from_session()
        if not user_id:
            return jsonify({"error": "請先登入"}), 401
        
        try:
            # 查詢記錄並驗證權限（只查詢圖片路徑）
            record = db.execute_query(
                """
                SELECT image_path, user_id
                FROM detection_records 
                WHERE id = %s AND user_id = %s
                """,
                (record_id, user_id),
                fetch_one=True
            )
            
            if not record:
                logger.warning(f"⚠️  記錄不存在或無權限: record_id={record_id}, user_id={user_id}")
                return jsonify({"error": "記錄不存在或無權限"}), 404
            
            image_path = record[0]
            
            # 如果 image_path 是 Cloudinary URL，重定向到該 URL
            if image_path and (image_path.startswith('http://') or image_path.startswith('https://')):
                logger.debug(f"✅ 重定向到 Cloudinary URL: {image_path}")
                from flask import redirect
                return redirect(image_path, code=302)
            
            # 如果是資料庫 URL（/image/xxx），返回錯誤（圖片應在 Cloudinary）
            if image_path and image_path.startswith('/image/'):
                logger.warning(f"⚠️  圖片路徑指向資料庫 URL，但圖片應在 Cloudinary: record_id={record_id}")
                return jsonify({"error": "圖片未找到，請檢查 Cloudinary 配置"}), 404
            
            # 嘗試從本地文件系統讀取（向後兼容）
            if image_path:
                filename = os.path.basename(image_path)
                try:
                    logger.debug(f"📁 嘗試從文件系統讀取圖片: {filename}")
                    return send_from_directory(self.upload_folder, filename)
                except Exception as file_error:
                    logger.warning(f"⚠️  從文件系統讀取失敗: {str(file_error)}")
            
            logger.warning(f"⚠️  圖片未找到: record_id={record_id}, image_path={image_path}")
            return jsonify({"error": "圖片未找到"}), 404
            
        except Exception as e:
            logger.error(f"❌ 獲取圖片失敗: {str(e)}", exc_info=True)
            return jsonify({"error": "獲取圖片失敗"}), 500

