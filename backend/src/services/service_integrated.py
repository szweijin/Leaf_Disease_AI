"""
整合檢測服務
整合 CNN 分類和 YOLO 檢測功能
"""

import os
import json
import time
import uuid
import logging
import traceback
from typing import Dict, Any, Optional, List
from datetime import datetime

from src.core.core_db_manager import db, ActivityLogger, ErrorLogger, PerformanceLogger
from src.services.service_cnn import CNNClassifierService
from src.services.service_yolo import DetectionService
from src.services.service_image import ImageService

# 導入 YOLO 模組（用於直接使用模組功能）
from modules.yolo_detect import yolo_detect
from modules.yolo_postprocess import postprocess_yolo_result, draw_boxes_on_image

# 導入超解析度模組
from modules.sr_load import SuperResolutionModelLoader
from modules.sr_preprocess import preprocess_with_sr

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IntegratedDetectionService:
    """整合檢測服務類 - 整合 CNN 分類和 YOLO 檢測"""
    
    def __init__(
        self, 
        cnn_model_path: str, 
        yolo_model_path: str,
        sr_model_path: Optional[str] = None,
        sr_model_type: str = 'edsr',
        sr_scale: int = 2,
        enable_sr: bool = True
    ):
        """
        初始化整合檢測服務
        
        Args:
            cnn_model_path: CNN 模型路徑
            yolo_model_path: YOLO 模型路徑
            sr_model_path: 超解析度模型路徑（可選）
            sr_model_type: 超解析度模型類型 ('edsr', 'rcan' 等)
            sr_scale: 超解析度放大倍數 (2, 4, 8)
            enable_sr: 是否啟用超解析度預處理
        """
        try:
            # 初始化 CNN 分類服務
            self.cnn_service = CNNClassifierService(cnn_model_path)
            logger.info("✅ CNN 分類服務初始化成功")
            
            # 初始化 YOLO 檢測服務
            self.yolo_service = DetectionService(yolo_model_path)
            logger.info("✅ YOLO 檢測服務初始化成功")
            
            # 初始化超解析度模型（可選）
            self.enable_sr = enable_sr
            self.sr_model = None
            self.sr_scale = sr_scale
            self.sr_device = 'cuda' if __import__('torch').cuda.is_available() else 'cpu'
            
            if self.enable_sr:
                try:
                    self.sr_loader = SuperResolutionModelLoader(
                        model_path=sr_model_path,
                        device=self.sr_device
                    )
                    self.sr_model = self.sr_loader.load_model(
                        model_type=sr_model_type,
                        scale=sr_scale
                    )
                    logger.info(f"✅ 超解析度模型初始化成功 (類型: {sr_model_type}, scale: {sr_scale}x)")
                except Exception as e:
                    logger.warning(f"⚠️  超解析度模型初始化失敗，將跳過超解析度預處理: {str(e)}")
                    self.enable_sr = False
                    self.sr_model = None
            else:
                logger.info("ℹ️  超解析度預處理已禁用")
            
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
            # ========== 階段 0: 超解析度預處理（可選）==========
            processed_image_path = image_path
            sr_time = 0
            
            if self.enable_sr and self.sr_model is not None:
                try:
                    logger.info(f"🔍 階段 0: 執行超解析度預處理 (scale={self.sr_scale}x)...")
                    sr_start = time.time()
                    
                    # 創建臨時目錄用於存放超解析度處理後的圖片
                    temp_dir = os.path.join(os.path.dirname(image_path), 'sr_temp')
                    os.makedirs(temp_dir, exist_ok=True)
                    
                    # 執行超解析度處理
                    processed_image_path = preprocess_with_sr(
                        image_path=image_path,
                        model=self.sr_model,
                        device=self.sr_device,
                        scale=self.sr_scale,
                        temp_dir=temp_dir
                    )
                    
                    sr_time = int((time.time() - sr_start) * 1000)
                    logger.info(f"✅ 超解析度預處理完成，耗時: {sr_time}ms")
                except Exception as e:
                    logger.warning(f"⚠️  超解析度預處理失敗，使用原始圖片: {str(e)}")
                    processed_image_path = image_path
                    sr_time = 0
            
            # ========== 階段 1: CNN 分類 ==========
            logger.info("🔍 階段 1: 執行 CNN 分類...")
            cnn_start = time.time()
            cnn_result = self.cnn_service.predict(processed_image_path)
            cnn_time = int((time.time() - cnn_start) * 1000)
            
            # 清理臨時超解析度圖片（如果創建了）
            if processed_image_path != image_path and os.path.exists(processed_image_path):
                try:
                    os.remove(processed_image_path)
                    logger.debug(f"🗑️  已清理臨時超解析度圖片: {processed_image_path}")
                except:
                    pass
            
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
                # 使用 YOLO 模組進行檢測
                try:
                    # 使用 YOLO 模組進行檢測
                    yolo_results = yolo_detect(self.yolo_service.model, image_path)
                    processed_result = postprocess_yolo_result(yolo_results)
                    
                    yolo_detected = processed_result['detected']
                    yolo_result = processed_result['detections']
                    
                    if yolo_detected:
                        logger.info(f"✅ YOLO 檢測完成: 發現 {len(yolo_result)} 個病害")
                    else:
                        logger.info("✅ YOLO 檢測完成: 未發現病害（健康）")
                        yolo_result = [{
                            'class': 'Healthy',
                            'confidence': 1.0,
                            'bbox': []
                        }]
                    
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
            
            # 圖片不再儲存在資料庫，只儲存 Cloudinary URL 或資料庫 URL 在 image_path
            # image_data 相關欄位設為 NULL（保留欄位以維持向後兼容）
            # 確定圖片路徑：優先使用 web_image_path（可能是 Cloudinary URL），否則使用資料庫 URL
            if web_image_path and (web_image_path.startswith('http://') or web_image_path.startswith('https://')):
                # 使用 Cloudinary URL 或其他外部 URL
                final_image_path = web_image_path
                is_cloudinary = True
                logger.info(f"✅ 使用外部圖片 URL: {final_image_path}")
            else:
                # 使用資料庫 URL（符合資料庫約束要求）
                final_image_path = f"/image/prediction/{prediction_id}"
                is_cloudinary = False
                logger.info(f"✅ 使用資料庫圖片 URL: {final_image_path}")
            
            # 注意：帶框圖片的生成和上傳將在 API 層處理
            # 因為 IntegratedDetectionService 不直接訪問 ImageManager
            predict_img_url = None  # 將在 API 層設置
            
            # 插入 prediction_log
            try:
                db.execute_update(
                    """
                    INSERT INTO prediction_log (
                        id, user_id, image_path, image_hash, image_size, image_source,
                        image_data, image_data_size, image_compressed,
                        cnn_mean_score, cnn_best_class, cnn_best_score, cnn_all_scores,
                        yolo_result, yolo_detected, final_status, workflow_step,
                        crop_coordinates, predict_img_url, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, NOW()
                    )
                    """,
                    (
                        prediction_id, user_id, final_image_path, image_hash, image_size, image_source,
                        None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                        None,  # image_data_size - 不再使用
                        False,  # image_compressed - 不再使用
                        mean_score, best_class, best_score, json.dumps(all_scores),
                        json.dumps(yolo_result) if yolo_result else None, yolo_detected, final_status, workflow_step,
                        json.dumps(crop_coordinates) if crop_coordinates else None,
                        predict_img_url  # 帶框圖片 URL（將在 API 層設置）
                    )
                )
                storage_type = "Cloudinary" if is_cloudinary else "本地路徑"
                logger.info(f"✅ 預測記錄已儲存: {prediction_id}, 圖片儲存: {storage_type}")
            except Exception as e:
                logger.error(f"❌ 儲存預測記錄失敗: {str(e)}")
                # 繼續流程，不中斷
            
            # 儲存到 detection_records（無論是否有 YOLO 檢測結果，包括 "others" 類別）
            # 這樣可以確保所有檢測結果都顯示在歷史記錄中
            record_id = None
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
                
                logger.info(f"💾 準備儲存檢測記錄: user_id={user_id}, disease={disease_name}, confidence={confidence}, image_path={db_image_path}")
                
                # 確定原始圖片 URL（優先使用 Cloudinary URL）
                original_image_url = None
                if web_image_path and (web_image_path.startswith('http://') or web_image_path.startswith('https://')):
                    original_image_url = web_image_path
                elif final_image_path and (final_image_path.startswith('http://') or final_image_path.startswith('https://')):
                    original_image_url = final_image_path
                
                # 儲存到 detection_records（圖片不再儲存在資料庫，只儲存 URL）
                # 使用 ON CONFLICT 處理重複圖片 hash 的情況
                # 如果圖片 hash 已存在，返回現有記錄的 ID；否則創建新記錄
                try:
                    record_result = db.execute_returning(
                        """
                        INSERT INTO detection_records (
                            user_id, disease_name, severity, confidence,
                            image_path, image_hash, image_size, image_source,
                            raw_model_output, status, processing_time_ms,
                            image_data, image_data_size, image_compressed,
                            prediction_log_id, original_image_url, annotated_image_url, created_at
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s, NOW()
                        )
                        ON CONFLICT (image_hash) DO UPDATE SET
                            updated_at = NOW()
                        RETURNING id
                        """,
                        (
                            user_id, disease_name, 'Unknown', confidence,
                            db_image_path, image_hash, image_size, image_source,
                            json.dumps(raw_output), 'completed', total_time,
                            None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                            None,  # image_data_size - 不再使用
                            False,  # image_compressed - 不再使用
                            prediction_id,
                            original_image_url,  # 原始圖片 URL
                            None  # annotated_image_url - 將在 API 層更新
                        ),
                        fetch_one=True
                    )
                    
                    if not record_result:
                        raise ValueError("INSERT 操作未返回 record_id")
                    
                    record_id = record_result[0] if record_result else None
                    
                    if not record_id:
                        raise ValueError(f"無法獲取 record_id，record_result: {record_result}")
                    
                    logger.info(f"✅ 檢測記錄已插入/更新: record_id={record_id}")
                except Exception as e:
                    # 如果 ON CONFLICT 失敗（可能是其他錯誤），嘗試查詢現有記錄
                    if "duplicate key" in str(e).lower() or "unique constraint" in str(e).lower():
                        logger.warning(f"⚠️  圖片 hash 已存在，查詢現有記錄: {image_hash[:16]}...")
                        existing_record = db.execute_query(
                            """
                            SELECT id FROM detection_records
                            WHERE image_hash = %s
                            LIMIT 1
                            """,
                            (image_hash,),
                            fetch_one=True
                        )
                        if existing_record:
                            record_id = existing_record[0]
                            logger.info(f"✅ 使用現有記錄: record_id={record_id}")
                            # 更新現有記錄的時間戳
                            db.execute_update(
                                """
                                UPDATE detection_records
                                SET updated_at = NOW()
                                WHERE id = %s
                                """,
                                (record_id,)
                            )
                        else:
                            raise ValueError(f"無法找到現有記錄，也無法創建新記錄: {str(e)}")
                    else:
                        raise
                
                # 如果使用資料庫 URL，更新為正確的 record_id URL
                if not (web_image_path and (web_image_path.startswith('http://') or web_image_path.startswith('https://'))):
                    if record_id:
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
                        logger.info(f"✅ 已更新圖片路徑: {final_db_image_path}")
                    else:
                        logger.warning(f"⚠️  無法更新圖片路徑，record_id 為 None")
                
                storage_type = "Cloudinary" if (db_image_path.startswith('http://') or db_image_path.startswith('https://')) else "本地路徑"
                logger.info(f"✅ 檢測記錄已儲存: record_id={record_id}, disease={disease_name}, confidence={confidence:.4f}, 圖片儲存: {storage_type}")
            except Exception as e:
                error_traceback = traceback.format_exc()
                logger.error(f"❌ 儲存檢測記錄失敗: {str(e)}")
                logger.error(f"   錯誤堆疊:\n{error_traceback}")
                logger.error(f"   參數: user_id={user_id}, disease={disease_name}, prediction_id={prediction_id}")
                # 不中斷流程，繼續返回結果，但記錄詳細錯誤
                record_id = None
            
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
                        image_url = f"/image/prediction/{prediction_id}"
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
            
            # 添加超解析度處理時間（如果執行了）
            if sr_time > 0:
                result['sr_time_ms'] = sr_time
                result['sr_enabled'] = True
                result['sr_scale'] = self.sr_scale
            
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
        image_bytes: Optional[bytes] = None,
        crop_count: int = 1
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
            crop_count: 裁切次數（默認為 1，最多 3 次）
        
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
        # ========== 階段 0: 超解析度預處理（可選）==========
        processed_cropped_image_path = cropped_image_path
        sr_time = 0
        
        if self.enable_sr and self.sr_model is not None:
            try:
                logger.info(f"🔍 階段 0: 執行超解析度預處理（裁切後圖片）(scale={self.sr_scale}x)...")
                sr_start = time.time()
                
                # 創建臨時目錄用於存放超解析度處理後的圖片
                temp_dir = os.path.join(os.path.dirname(cropped_image_path), 'sr_temp')
                os.makedirs(temp_dir, exist_ok=True)
                
                # 執行超解析度處理
                processed_cropped_image_path = preprocess_with_sr(
                    image_path=cropped_image_path,
                    model=self.sr_model,
                    device=self.sr_device,
                    scale=self.sr_scale,
                    temp_dir=temp_dir
                )
                
                sr_time = int((time.time() - sr_start) * 1000)
                logger.info(f"✅ 超解析度預處理完成，耗時: {sr_time}ms")
            except Exception as e:
                logger.warning(f"⚠️  超解析度預處理失敗，使用原始圖片: {str(e)}")
                processed_cropped_image_path = cropped_image_path
                sr_time = 0
        
        # ========== 階段 1: CNN 分類 ==========
        logger.info("🔍 階段 1: 執行 CNN 分類（裁切後圖片）...")
        cnn_start = time.time()
        cnn_result = self.cnn_service.predict(processed_cropped_image_path)
        cnn_time = int((time.time() - cnn_start) * 1000)
        
        # 清理臨時超解析度圖片（如果創建了）
        if processed_cropped_image_path != cropped_image_path and os.path.exists(processed_cropped_image_path):
            try:
                os.remove(processed_cropped_image_path)
                logger.debug(f"🗑️  已清理臨時超解析度圖片: {processed_cropped_image_path}")
            except:
                pass
        
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
        
        # 檢查：如果 crop 後還是 'whole_plant'，處理 crop 次數限制
        if best_class == 'whole_plant':
            if crop_count >= 3:
                # 第 3 次 crop 後還是 'whole_plant'，強制返回 'others'
                logger.warning(f"⚠️  已達到最大 crop 次數 ({crop_count}/3)，強制設置為 'others'")
                best_class = 'others'
                final_status = 'not_plant'
                # 更新 CNN 結果以反映強制設置
                all_scores['others'] = all_scores.get('others', 0.0)
                all_scores['whole_plant'] = best_score
                best_score = all_scores.get('others', 0.0)
                
                # 更新 prediction_log 表中的 CNN 分類結果
                try:
                    db.execute_update(
                        """
                        UPDATE prediction_log
                        SET cnn_best_class = %s,
                            cnn_best_score = %s,
                            cnn_all_scores = %s,
                            final_status = %s,
                            updated_at = NOW()
                        WHERE id = %s AND user_id = %s
                        """,
                        (
                            best_class,
                            best_score,
                            json.dumps(all_scores),
                            final_status,
                            prediction_log_id,
                            user_id
                        )
                    )
                    logger.info(f"✅ 已更新 prediction_log: 強制設置為 'others'")
                except Exception as e:
                    logger.error(f"❌ 更新 prediction_log 失敗: {str(e)}")
                    # 不中斷流程，繼續執行
            else:
                # 還未達到最大次數，返回需要繼續 crop
                logger.info(f"✂️  Crop 後仍為 'whole_plant'，需要繼續 crop ({crop_count}/3)")
                final_status = 'need_crop'
                # 返回結果，提示前端需要繼續 crop
                return {
                    'prediction_id': prediction_log_id,
                    'status': 'need_crop',
                    'final_status': 'need_crop',
                    'cnn_result': {
                        'best_class': best_class,
                        'best_score': best_score,
                        'mean_score': mean_score,
                        'all_scores': all_scores
                    },
                    'disease': best_class,
                    'confidence': best_score,
                    'severity': 'Unknown',
                    'crop_count': crop_count,
                    'max_crop_count': 3,
                    'message': f'請重新裁切圖片中的葉片區域 ({crop_count}/3)',
                    'processing_time_ms': int((time.time() - start_time) * 1000),
                    'cnn_time_ms': cnn_time
                }
        
        # 路徑 A: 進入 YOLO 檢測
        if self.cnn_service.should_run_yolo(best_class):
            logger.info(f"🔍 階段 2: 進入 YOLO 檢測流程 ({best_class})...")
            workflow_step = 'cnn_yolo'
            
            yolo_start = time.time()
            try:
                # 使用 YOLO 模組進行檢測
                yolo_results = yolo_detect(self.yolo_service.model, cropped_image_path)
                processed_result = postprocess_yolo_result(yolo_results)
                
                yolo_detected = processed_result['detected']
                yolo_result = processed_result['detections']
                yolo_time = int((time.time() - yolo_start) * 1000)
                
                if yolo_detected:
                    logger.info(f"✅ YOLO 檢測完成: 發現 {len(yolo_result)} 個病害區域")
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
        record_id = None
        
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
                
                logger.info(f"💾 準備更新檢測記錄: record_id={record_id}, disease={disease_name}, confidence={confidence}")
                
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
                logger.info(f"✅ 檢測記錄已更新: record_id={record_id}, disease={disease_name}, confidence={confidence:.4f}, 圖片儲存: {storage_type}")
            else:
                # 如果沒有現有記錄，創建新記錄（向後兼容）
                if yolo_detected and yolo_result:
                    primary_detection = yolo_result[0]
                    disease_name = primary_detection['class']
                    confidence = primary_detection['confidence']
                else:
                    disease_name = best_class
                    confidence = best_score
                
                logger.info(f"💾 準備創建檢測記錄: user_id={user_id}, disease={disease_name}, confidence={confidence}, prediction_log_id={prediction_log_id}")
                
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
                    ON CONFLICT (image_hash) DO UPDATE SET
                        updated_at = NOW()
                    RETURNING id
                    """,
                    (
                        user_id, disease_name, 'Unknown', confidence,
                        'temp_path', image_hash, image_size, image_source,  # 臨時路徑，稍後更新
                        json.dumps({'yolo_detections': yolo_result} if yolo_result else {'cnn_class': best_class, 'cnn_score': best_score}), 'completed', total_time,
                        None,  # image_data - 不再使用，圖片儲存在 Cloudinary
                        None,  # image_data_size - 不再使用
                        False,  # image_compressed - 不再使用
                        prediction_log_id
                    ),
                    fetch_one=True
                )
                
                if not record_result:
                    raise ValueError("INSERT 操作未返回 record_id")
                
                record_id = record_result[0] if record_result else None
                
                if not record_id:
                    raise ValueError(f"無法獲取 record_id，record_result: {record_result}")
                
                logger.info(f"✅ 檢測記錄已插入: record_id={record_id}")
                
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
            error_traceback = traceback.format_exc()
            logger.error(f"❌ 更新/創建檢測記錄失敗: {str(e)}")
            logger.error(f"   錯誤堆疊:\n{error_traceback}")
            logger.error(f"   參數: user_id={user_id}, prediction_log_id={prediction_log_id}")
            # 不中斷流程，繼續返回結果，但記錄詳細錯誤
            record_id = None
        
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
                    image_url = f"/image/prediction/{prediction_log_id}"
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
            'crop_coordinates': crop_coordinates,
            'crop_count': crop_count,
            'max_crop_count': 3
        }
        
        # 添加超解析度處理時間（如果執行了）
        if sr_time > 0:
            result['sr_time_ms'] = sr_time
            result['sr_enabled'] = True
            result['sr_scale'] = self.sr_scale
        
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

