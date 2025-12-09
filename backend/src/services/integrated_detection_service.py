# integrated_detection_service.py
# 整合檢測服務 - CNN + YOLO 完整流程

import os
import json
import time
import uuid
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from src.core.db_manager import db, ActivityLogger, ErrorLogger, PerformanceLogger
from src.services.cnn_classifier_service import CNNClassifierService
from src.services.detection_service import DetectionService
from src.services.image_service import ImageService

logger = logging.getLogger(__name__)


class IntegratedDetectionService:
    """整合檢測服務類 - 整合 CNN 分類和 YOLO 檢測"""
    
    def __init__(self, cnn_model_path: str, yolo_model_path: str):
        """
        初始化整合檢測服務
        
        Args:
            cnn_model_path: CNN 模型路徑
            yolo_model_path: YOLO 模型路徑
        """
        try:
            # 初始化 CNN 分類服務
            self.cnn_service = CNNClassifierService(cnn_model_path)
            logger.info("✅ CNN 分類服務初始化成功")
            
            # 初始化 YOLO 檢測服務
            self.yolo_service = DetectionService(yolo_model_path)
            logger.info("✅ YOLO 檢測服務初始化成功")
            
        except Exception as e:
            logger.error(f"❌ 整合檢測服務初始化失敗: {str(e)}")
            raise
    
    def predict(
        self,
        image_path: str,
        user_id: int,
        image_source: str = 'upload',
        image_hash: str = None,
        web_image_path: str = None,
        crop_coordinates: Optional[Dict] = None,
        prediction_log_id: Optional[str] = None,
        image_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        執行完整的 CNN + YOLO 檢測流程
        
        Args:
            image_path: 圖片檔案路徑
            user_id: 使用者 ID
            image_source: 圖片來源
            image_hash: 圖片 hash
            web_image_path: Web 訪問路徑
            crop_coordinates: 裁切座標（如果是裁切後的圖片）
            prediction_log_id: 預測記錄 ID（如果是裁切後的重新檢測）
        
        Returns:
            完整的檢測結果字典
        """
        start_time = time.time()
        prediction_id = str(uuid.uuid4())
        
        try:
            # ========== 階段 1: CNN 分類 ==========
            logger.info("🔍 階段 1: 執行 CNN 分類...")
            cnn_start = time.time()
            cnn_result = self.cnn_service.predict(image_path)
            cnn_time = int((time.time() - cnn_start) * 1000)
            
            best_class = cnn_result['best_class']
            mean_score = cnn_result['mean_score']
            best_score = cnn_result['best_score']
            all_scores = cnn_result['all_scores']
            
            logger.info(f"✅ CNN 分類完成: {best_class} (分數: {best_score:.4f}, 耗時: {cnn_time}ms)")
            
            # ========== 階段 2: 分流邏輯 ==========
            workflow_step = 'cnn_only'
            yolo_result = None
            yolo_detected = False
            final_status = self.cnn_service.get_final_status(best_class)
            
            # 路徑 A: 進入 YOLO 檢測
            if self.cnn_service.should_run_yolo(best_class):
                logger.info(f"🔍 階段 2: 進入 YOLO 檢測流程 ({best_class})...")
                workflow_step = 'cnn_yolo'
                
                yolo_start = time.time()
                # 使用 YOLO 服務進行檢測
                yolo_detections = []
                try:
                    # 使用 YOLO 模型進行檢測（與 DetectionService 一致）
                    yolo_results = self.yolo_service.model(image_path)[0]
                    boxes = yolo_results.boxes
                    
                    if len(boxes) > 0:
                        yolo_detected = True
                        for box in boxes:
                            cls_id = int(box.cls)
                            confidence = float(box.conf)
                            class_name = yolo_results.names[cls_id]
                            
                            yolo_detections.append({
                                'class': class_name,
                                'confidence': confidence,
                                'bbox': box.xyxy.tolist() if hasattr(box.xyxy, 'tolist') else []
                            })
                        
                        logger.info(f"✅ YOLO 檢測完成: 發現 {len(yolo_detections)} 個病害")
                    else:
                        logger.info("✅ YOLO 檢測完成: 未發現病害（健康）")
                        yolo_detections.append({
                            'class': 'Healthy',
                            'confidence': 1.0,
                            'bbox': []
                        })
                    
                    yolo_result = yolo_detections
                    yolo_time = int((time.time() - yolo_start) * 1000)
                    logger.info(f"   YOLO 耗時: {yolo_time}ms")
                    
                except Exception as e:
                    logger.error(f"❌ YOLO 檢測失敗: {str(e)}", exc_info=True)
                    yolo_result = []
                    yolo_detected = False
                    # 繼續流程，不中斷
            
            # 路徑 B: 需要裁切
            elif best_class == 'whole_plant':
                logger.info("✂️  需要裁切: whole_plant 類別")
                final_status = 'need_crop'
            
            # 路徑 C: 非植物
            elif best_class == 'others':
                logger.info("❌ 非植物影像: others 類別")
                final_status = 'not_plant'
            
            # ========== 階段 3: 儲存到資料庫 ==========
            total_time = int((time.time() - start_time) * 1000)
            
            # 獲取圖片大小
            image_size = None
            if image_bytes:
                image_size = len(image_bytes)
            else:
                try:
                    if os.path.exists(image_path):
                        image_size = os.path.getsize(image_path)
                except:
                    pass
            
            # 圖片不再儲存在資料庫，只儲存 Cloudinary URL 在 image_path
            # image_data 相關欄位設為 NULL（保留欄位以維持向後兼容）
            final_image_path = web_image_path or image_path
            is_cloudinary = final_image_path and (final_image_path.startswith('http://') or final_image_path.startswith('https://'))
            
            # 插入 prediction_log
            try:
                db.execute_update(
                    """
                    INSERT INTO prediction_log (
                        id, user_id, image_path, image_hash, image_size, image_source,
                        image_data, image_data_size, image_compressed,
                        cnn_mean_score, cnn_best_class, cnn_best_score, cnn_all_scores,
                        yolo_result, yolo_detected, final_status, workflow_step,
                        crop_coordinates, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, NOW()
                    )
                    """,
                    (
                        prediction_id, user_id, final_image_path, image_hash, image_size, image_source,
                        None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                        None,  # image_data_size - 不再使用
                        False,  # image_compressed - 不再使用
                        mean_score, best_class, best_score, json.dumps(all_scores),
                        json.dumps(yolo_result) if yolo_result else None, yolo_detected, final_status, workflow_step,
                        json.dumps(crop_coordinates) if crop_coordinates else None
                    )
                )
                storage_type = "Cloudinary" if is_cloudinary else "本地路徑"
                logger.info(f"✅ 預測記錄已儲存: {prediction_id}, 圖片儲存: {storage_type}")
            except Exception as e:
                logger.error(f"❌ 儲存預測記錄失敗: {str(e)}")
                # 繼續流程，不中斷
            
            # 儲存到 detection_records（無論是否有 YOLO 檢測結果，包括 "others" 類別）
            # 這樣可以確保所有檢測結果都顯示在歷史記錄中
            try:
                # 確定病害名稱和置信度
                if yolo_detected and yolo_result:
                    # 如果有 YOLO 檢測結果，使用 YOLO 的結果
                    primary_detection = yolo_result[0]
                    disease_name = primary_detection['class']
                    confidence = primary_detection['confidence']
                    raw_output = {'yolo_detections': yolo_result}
                else:
                    # 否則使用 CNN 分類結果（包括 "others" 類別）
                    disease_name = best_class
                    confidence = best_score
                    raw_output = {
                        'cnn_class': best_class,
                        'cnn_score': best_score,
                        'cnn_all_scores': all_scores,
                        'final_status': final_status
                    }
                
                # 確定圖片路徑（優先使用 web_image_path，可能是 Cloudinary URL）
                if web_image_path and (web_image_path.startswith('http://') or web_image_path.startswith('https://')):
                    # 使用 Cloudinary URL 或其他外部 URL
                    db_image_path = web_image_path
                    logger.info(f"✅ 使用外部圖片 URL: {db_image_path}")
                else:
                    # 使用資料庫 URL（向後兼容）
                    db_image_path = f"/image/prediction/{prediction_id}"
                
                # 儲存到 detection_records（圖片不再儲存在資料庫，只儲存 URL）
                record_result = db.execute_returning(
                    """
                    INSERT INTO detection_records (
                        user_id, disease_name, severity, confidence,
                        image_path, image_hash, image_size, image_source,
                        raw_model_output, status, processing_time_ms,
                        image_data, image_data_size, image_compressed,
                        prediction_log_id, created_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, NOW()
                    )
                    RETURNING id
                    """,
                    (
                        user_id, disease_name, 'Unknown', confidence,
                        db_image_path, image_hash, image_size, image_source,
                        json.dumps(raw_output), 'completed', total_time,
                        None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                        None,  # image_data_size - 不再使用
                        False,  # image_compressed - 不再使用
                        prediction_id
                    ),
                    fetch_one=True
                )
                record_id = record_result[0] if record_result else None
                
                # 如果使用資料庫 URL，更新為正確的 record_id URL
                if not (web_image_path and (web_image_path.startswith('http://') or web_image_path.startswith('https://'))):
                    final_db_image_path = f"/image/{record_id}"
                    db.execute_update(
                        """
                        UPDATE detection_records
                        SET image_path = %s
                        WHERE id = %s
                        """,
                        (final_db_image_path, record_id)
                    )
                    db_image_path = final_db_image_path
                
                storage_type = "Cloudinary" if (db_image_path.startswith('http://') or db_image_path.startswith('https://')) else "本地路徑"
                logger.info(f"✅ 檢測記錄已儲存: record_id={record_id}, disease={disease_name}, 圖片儲存: {storage_type}")
            except Exception as e:
                logger.warning(f"⚠️  儲存檢測記錄失敗: {str(e)}")
                # 不中斷流程，繼續返回結果
            
            # ========== 階段 4: 構建回應 ==========
            # 使用圖片 URL（可能是 Cloudinary URL 或資料庫 URL）
            # 查詢剛創建的 detection_records 記錄以獲取正確的 URL
            image_url = f"/image/prediction/{prediction_id}"  # 預設使用 prediction_log 的 URL
            try:
                record_result = db.execute_query(
                    """
                    SELECT id, image_path FROM detection_records 
                    WHERE prediction_log_id = %s AND user_id = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (prediction_id, user_id),
                    fetch_one=True
                )
                if record_result:
                    record_id = record_result[0]
                    stored_image_path = record_result[1] if len(record_result) > 1 else None
                    # 如果儲存的是 Cloudinary URL，直接使用；否則使用資料庫 URL
                    if stored_image_path and (stored_image_path.startswith('http://') or stored_image_path.startswith('https://')):
                        image_url = stored_image_path
                    else:
                        image_url = f"/image/{record_id}"
            except Exception as e:
                logger.debug(f"查詢 detection_records 失敗，使用預設 URL: {str(e)}")
            
            # 確定最終的病害名稱和置信度（用於前端顯示）
            final_disease = best_class
            final_confidence = best_score
            if yolo_detected and yolo_result:
                final_disease = yolo_result[0]['class']
                final_confidence = yolo_result[0]['confidence']
            
            result = {
                'status': 'success' if final_status != 'not_plant' else 'error',
                'workflow': workflow_step,
                'prediction_id': prediction_id,
                'cnn_result': {
                    'mean_score': mean_score,
                    'best_class': best_class,
                    'best_score': best_score,
                    'all_scores': all_scores
                },
                'disease': final_disease,  # 添加病害名稱（包括 "others"）
                'confidence': final_confidence,  # 添加置信度
                'severity': 'Unknown',
                'final_status': final_status,
                'image_path': image_url,  # 使用資料庫圖片 URL
                'image_stored_in_db': False,  # 標記是否從資料庫讀取（已改為 Cloudinary 儲存）
                'processing_time_ms': total_time,
                'cnn_time_ms': cnn_time
            }
            
            # 添加 YOLO 結果（如有）
            if yolo_result is not None:
                result['yolo_result'] = {
                    'detected': yolo_detected,
                    'detections': yolo_result
                }
                # 總是添加 YOLO 時間（如果執行了 YOLO 檢測）
                if workflow_step == 'cnn_yolo':
                    result['yolo_time_ms'] = int((time.time() - yolo_start) * 1000)
            
            # 添加錯誤訊息（如需要）
            if final_status == 'not_plant':
                result['error'] = '非植物影像，請上傳植物葉片圖片'
            elif final_status == 'need_crop':
                result['message'] = '請裁切圖片中的葉片區域'
            
            # 記錄活動
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='prediction',
                resource_type='image',
                resource_id=None,  # prediction_id 是 UUID 字符串，不適合作為整數 resource_id
                action_details={
                    'workflow': workflow_step,
                    'cnn_class': best_class,
                    'final_status': final_status,
                    'prediction_id': prediction_id  # 將 UUID 放在 action_details 中
                }
            )
            
            # 記錄性能
            PerformanceLogger.log_performance(
                operation_name='integrated_prediction',
                execution_time_ms=total_time,
                status='success',
                details={
                    'workflow': workflow_step,
                    'cnn_class': best_class,
                    'yolo_detected': yolo_detected
                }
            )
            
            logger.info(f"✅ 完整檢測流程完成: {workflow_step}, 總耗時: {total_time}ms")
            
            return result
            
        except Exception as e:
            total_time = int((time.time() - start_time) * 1000)
            
            # 記錄錯誤
            ErrorLogger.log_error(
                user_id=user_id,
                error_type='IntegratedPredictionError',
                error_message=f'整合檢測失敗: {str(e)}',
                severity='error',
                context={'image_path': image_path, 'processing_time_ms': total_time}
            )
            
            logger.error(f"❌ 整合檢測失敗: {str(e)}")
            raise
    
    def predict_with_crop(
        self,
        cropped_image_path: str,
        user_id: int,
        prediction_log_id: str,
        crop_coordinates: Dict,
        image_source: str = 'crop',
        web_image_path: str = None,
        image_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        使用裁切後的圖片重新執行檢測，並替換原始圖片資料
        
        Args:
            cropped_image_path: 裁切後的圖片路徑
            user_id: 使用者 ID
            prediction_log_id: 原始預測記錄 ID
            crop_coordinates: 裁切座標
            image_source: 圖片來源（預設為 'crop'）
            web_image_path: Web 訪問路徑
            image_bytes: 裁切後的圖片位元組
        
        Returns:
            檢測結果字典
        """
        start_time = time.time()
        
        # 1. 獲取裁切後的圖片位元組和 hash
        cropped_image_bytes = image_bytes
        image_hash = None
        try:
            if not cropped_image_bytes:
                cropped_image_bytes = open(cropped_image_path, 'rb').read()
            processed_bytes, image_hash = ImageService.process_image(cropped_image_bytes, resize=True)
        except Exception as e:
            logger.error(f"❌ 處理裁切圖片失敗: {str(e)}")
            raise
        
        # 2. 更新 prediction_log 表，使用裁切後的圖片替換原始圖片
        try:
            # 圖片不再儲存在資料庫，只儲存 Cloudinary URL
            image_size = len(processed_bytes)
            
            # 更新 prediction_log，使用裁切後的圖片替換原始圖片
            # 優先使用 web_image_path（可能是 Cloudinary URL）
            if web_image_path and (web_image_path.startswith('http://') or web_image_path.startswith('https://')):
                db_image_path = web_image_path
                logger.info(f"✅ 使用外部圖片 URL 更新 prediction_log: {db_image_path}")
            else:
                db_image_path = f"/image/prediction/{prediction_log_id}"
            
            db.execute_update(
                """
                UPDATE prediction_log
                SET image_path = %s,
                    image_hash = %s,
                    image_size = %s,
                    image_data = %s,
                    image_data_size = %s,
                    image_compressed = FALSE,
                    crop_coordinates = %s,
                    updated_at = NOW()
                WHERE id = %s AND user_id = %s
                """,
                (
                    db_image_path,  # 使用 Cloudinary URL 或資料庫 URL
                    image_hash,
                    image_size,
                    None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                    None,  # image_data_size - 不再使用
                    json.dumps(crop_coordinates),
                    prediction_log_id,
                    user_id
                )
            )
            storage_type = "Cloudinary" if (db_image_path.startswith('http://') or db_image_path.startswith('https://')) else "本地路徑"
            logger.info(f"✅ 預測記錄圖片已更新: {prediction_log_id}, 圖片儲存: {storage_type}")
        except Exception as e:
            logger.error(f"❌ 更新預測記錄失敗: {str(e)}")
            raise
        
        # 3. 使用裁切後的圖片執行完整檢測流程
        # ========== 階段 1: CNN 分類 ==========
        logger.info("🔍 階段 1: 執行 CNN 分類（裁切後圖片）...")
        cnn_start = time.time()
        cnn_result = self.cnn_service.predict(cropped_image_path)
        cnn_time = int((time.time() - cnn_start) * 1000)
        
        best_class = cnn_result['best_class']
        mean_score = cnn_result['mean_score']
        best_score = cnn_result['best_score']
        all_scores = cnn_result['all_scores']
        
        logger.info(f"✅ CNN 分類完成: {best_class} (分數: {best_score:.4f}, 耗時: {cnn_time}ms)")
        
        # ========== 階段 2: 分流邏輯 ==========
        workflow_step = 'cnn_only'
        yolo_result = None
        yolo_detected = False
        yolo_start = None
        yolo_time = None
        final_status = self.cnn_service.get_final_status(best_class)
        
        # 路徑 A: 進入 YOLO 檢測
        if self.cnn_service.should_run_yolo(best_class):
            logger.info(f"🔍 階段 2: 進入 YOLO 檢測流程 ({best_class})...")
            workflow_step = 'cnn_yolo'
            
            yolo_start = time.time()
            try:
                yolo_detections = []
                yolo_results = self.yolo_service.model(cropped_image_path)
                
                for result in yolo_results:
                    boxes = result.boxes
                    if len(boxes) > 0:
                        for box in boxes:
                            yolo_detections.append({
                                'class': result.names[int(box.cls)],
                                'confidence': float(box.conf),
                                'bbox': box.xyxy[0].tolist() if hasattr(box.xyxy, '__len__') else []
                            })
                
                yolo_detected = len(yolo_detections) > 0
                yolo_result = yolo_detections if yolo_detected else []
                yolo_time = int((time.time() - yolo_start) * 1000)
                
                if yolo_detected:
                    logger.info(f"✅ YOLO 檢測完成: 發現 {len(yolo_detections)} 個病害區域")
                    final_status = 'yolo_detected'
                else:
                    logger.info(f"✅ YOLO 檢測完成: 未發現病害（健康）")
                logger.info(f"   YOLO 耗時: {yolo_time}ms")
                
            except Exception as e:
                logger.error(f"❌ YOLO 檢測失敗: {str(e)}")
                yolo_result = []
                if yolo_start:
                    yolo_time = int((time.time() - yolo_start) * 1000)
        
        # 路徑 B: 非植物
        elif best_class == 'others':
            logger.info("❌ 非植物影像: others 類別")
            final_status = 'not_plant'
        
        # ========== 階段 3: 更新 detection_records（如果存在） ==========
        total_time = int((time.time() - start_time) * 1000)
        
        # 查找是否有對應的 detection_records
        try:
            existing_record = db.execute_query(
                """
                SELECT id FROM detection_records 
                WHERE prediction_log_id = %s AND user_id = %s
                LIMIT 1
                """,
                (prediction_log_id, user_id),
                fetch_one=True
            )
            
            if existing_record:
                record_id = existing_record[0]
                # 更新現有記錄
                disease_name = best_class
                confidence = best_score
                
                if yolo_detected and yolo_result:
                    primary_detection = yolo_result[0]
                    disease_name = primary_detection['class']
                    confidence = primary_detection['confidence']
                
                # 查詢現有記錄的 image_path（可能是 Cloudinary URL）
                existing_path = db.execute_query(
                    """
                    SELECT image_path FROM detection_records WHERE id = %s
                    """,
                    (record_id,),
                    fetch_one=True
                )
                db_image_path = existing_path[0] if existing_path and existing_path[0] else f"/image/{record_id}"
                
                db.execute_update(
                    """
                    UPDATE detection_records
                    SET disease_name = %s,
                        confidence = %s,
                        image_path = %s,
                        image_hash = %s,
                        image_size = %s,
                        image_data = %s,
                        image_data_size = %s,
                        image_compressed = FALSE,
                        raw_model_output = %s,
                        processing_time_ms = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        disease_name,
                        confidence,
                        db_image_path,  # 保留原有的 Cloudinary URL 或資料庫 URL
                        image_hash,
                        image_size,
                        None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                        None,  # image_data_size - 不再使用
                        json.dumps({'yolo_detections': yolo_result} if yolo_result else {}),
                        total_time,
                        record_id
                    )
                )
                storage_type = "Cloudinary" if (db_image_path.startswith('http://') or db_image_path.startswith('https://')) else "本地路徑"
                logger.info(f"✅ 檢測記錄已更新: record_id={record_id}, 圖片儲存: {storage_type}")
            else:
                # 如果沒有現有記錄，創建新記錄（向後兼容）
                if yolo_detected and yolo_result:
                    primary_detection = yolo_result[0]
                    disease_name = primary_detection['class']
                    confidence = primary_detection['confidence']
                    
                    # 先插入記錄（使用臨時路徑，稍後更新）
                    record_result = db.execute_returning(
                        """
                        INSERT INTO detection_records (
                            user_id, disease_name, severity, confidence,
                            image_path, image_hash, image_size, image_source,
                            raw_model_output, status, processing_time_ms,
                            image_data, image_data_size, image_compressed,
                            prediction_log_id, created_at
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s,
                            %s, NOW()
                        )
                        RETURNING id
                        """,
                        (
                            user_id, disease_name, 'Unknown', confidence,
                            'temp_path', image_hash, image_size, image_source,  # 臨時路徑，稍後更新
                            json.dumps({'yolo_detections': yolo_result}), 'completed', total_time,
                            None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                            None,  # image_data_size - 不再使用
                            False,  # image_compressed - 不再使用
                            prediction_log_id
                        ),
                        fetch_one=True
                    )
                    record_id = record_result[0] if record_result else None
                    
                    # 更新為正確的資料庫 URL
                    db_image_path = f"/image/{record_id}"
                    db.execute_update(
                        """
                        UPDATE detection_records
                        SET image_path = %s
                        WHERE id = %s
                        """,
                        (db_image_path, record_id)
                    )
                    logger.info(f"✅ 檢測記錄已創建: record_id={record_id}, path={db_image_path}")
        except Exception as e:
            logger.warning(f"⚠️  更新檢測記錄失敗: {str(e)}")
        
        # ========== 階段 4: 構建回應 ==========
        # 查詢圖片 URL（可能是 Cloudinary URL 或資料庫 URL）
        image_url = f"/image/prediction/{prediction_log_id}"
        try:
            record_result = db.execute_query(
                """
                SELECT id, image_path FROM detection_records 
                WHERE prediction_log_id = %s AND user_id = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (prediction_log_id, user_id),
                fetch_one=True
            )
            if record_result:
                record_id = record_result[0]
                stored_image_path = record_result[1] if len(record_result) > 1 else None
                # 如果儲存的是 Cloudinary URL，直接使用；否則使用資料庫 URL
                if stored_image_path and (stored_image_path.startswith('http://') or stored_image_path.startswith('https://')):
                    image_url = stored_image_path
                else:
                    image_url = f"/image/{record_id}"
        except Exception as e:
            logger.debug(f"查詢 detection_records 失敗，使用預設 URL: {str(e)}")
        
        result = {
            'prediction_id': prediction_log_id,
            'status': 'completed',
            'final_status': final_status,
            'cnn_result': {
                'best_class': best_class,
                'best_score': best_score,
                'mean_score': mean_score,
                'all_scores': all_scores
            },
            'disease': best_class if not yolo_detected else (yolo_result[0]['class'] if yolo_result else best_class),
            'confidence': best_score if not yolo_detected else (yolo_result[0]['confidence'] if yolo_result else best_score),
            'severity': 'Unknown',
            'final_status': final_status,
            'image_path': image_url,
            'image_stored_in_db': True,
            'processing_time_ms': total_time,
            'cnn_time_ms': cnn_time,
            'crop_coordinates': crop_coordinates
        }
        
        # 添加 YOLO 結果（如有）
        if yolo_result is not None:
            result['yolo_result'] = {
                'detected': yolo_detected,
                'detections': yolo_result
            }
            if yolo_time is not None:
                result['yolo_time_ms'] = yolo_time
        
        # 添加錯誤訊息（如需要）
        if final_status == 'not_plant':
            result['error'] = '非植物影像，請上傳植物葉片圖片'
        
        logger.info(f"✅ 裁切後檢測完成: {workflow_step}, 總耗時: {total_time}ms")
        
        return result

