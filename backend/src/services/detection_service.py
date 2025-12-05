# detection_service.py
# 檢測服務 - 處理 YOLO 預測、資料庫儲存等

import os
import json
import time
import logging
from typing import Dict, Any, Optional, Tuple
from ultralytics import YOLO
import sys
import os

# 確保可以匯入專案模組
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from src.core.db_manager import db, ActivityLogger, ErrorLogger, PerformanceLogger
from src.services.image_service import ImageService
import psycopg2

logger = logging.getLogger(__name__)


class DetectionService:
    """檢測服務類"""
    
    def __init__(self, model_path: str):
        """
        初始化檢測服務
        
        Args:
            model_path: YOLO 模型路徑
        """
        try:
            self.model = YOLO(model_path)
            logger.info(f"✅ YOLO 模型載入成功: {model_path}")
        except Exception as e:
            logger.error(f"❌ 模型載入失敗: {str(e)}")
            raise
    
    def predict(self, image_path: str, user_id: int, image_source: str = 'upload',
                image_hash: str = None, web_image_path: str = None) -> Dict[str, Any]:
        """
        執行病害檢測
        
        Args:
            image_path: 圖片檔案路徑
            user_id: 使用者 ID
            image_source: 圖片來源 ('camera', 'gallery', 'upload')
            image_hash: 圖片 hash（用於檢測重複）
            web_image_path: Web 訪問路徑（用於保存到資料庫）
        
        Returns:
            檢測結果字典
        """
        # 保存 web_image_path 供後續使用
        self._web_image_path = web_image_path
        start_time = time.time()
        
        try:
            # 1. 檢查重複上傳
            if image_hash:
                try:
                    existing = db.execute_query(
                        "SELECT id, disease_name, confidence FROM detection_records WHERE image_hash = %s AND user_id = %s",
                        (image_hash, user_id),
                        fetch_one=True,
                        dict_cursor=True
                    )
                    if existing:
                        logger.info(f"⚠️ 檢測到重複圖片 (hash: {image_hash[:8]}...)")
                        return {
                            "disease": existing['disease_name'],
                            "severity": "Unknown",
                            "confidence": float(existing['confidence']),
                            "image_path": image_path,
                            "disease_info": self._get_disease_info(existing['disease_name']),
                            "is_duplicate": True,
                            "duplicate_id": existing['id']
                        }
                except Exception as e:
                    error_msg = str(e)
                    logger.warning(f"⚠️ 檢查重複圖片失敗，繼續處理: {error_msg}")
                    # 繼續執行，不影響主要流程
            
            # 2. 執行 YOLO 預測
            results = self.model(image_path)[0]
            boxes = results.boxes
            
            processing_time = int((time.time() - start_time) * 1000)
            
            # 3. 處理預測結果
            if len(boxes) == 0:
                # 沒有檢測到病害
                disease_name = "Healthy"
                severity = "Healthy"
                confidence = 0.0
                raw_output = {"boxes": [], "message": "No disease detected"}
            else:
                cls_id = int(boxes[0].cls)
                confidence = float(boxes[0].conf)
                disease_name = results.names[cls_id]
                
                # 解析嚴重程度
                severity = self._parse_severity(disease_name)
                
                # 儲存完整模型輸出
                raw_output = {
                    "boxes": [
                        {
                            "cls": int(box.cls),
                            "conf": float(box.conf),
                            "xyxy": box.xyxy.tolist() if hasattr(box.xyxy, 'tolist') else []
                        }
                        for box in boxes
                    ],
                    "names": results.names
                }
            
            # 4. 獲取病害資訊
            disease_info = self._get_disease_info(disease_name)
            
            # 5. 讀取圖片位元組（用於壓縮存儲到資料庫）
            image_bytes_for_db = None
            try:
                if os.path.exists(image_path):
                    with open(image_path, 'rb') as f:
                        image_bytes_for_db = f.read()
            except Exception as read_error:
                logger.warning(f"⚠️ 讀取圖片位元組失敗，將不存儲到資料庫: {str(read_error)}")
            
            # 6. 儲存到資料庫
            record_id = None
            image_saved_to_db = False  # 標記是否成功保存到資料庫
            try:
                # 如果提供了 web_image_path，使用它；否則從 image_path 提取相對路徑
                db_image_path = image_path
                if hasattr(self, '_web_image_path') and self._web_image_path:
                    db_image_path = self._web_image_path
                    logger.debug(f"使用 web_image_path: {db_image_path}")
                elif os.path.isabs(image_path) and '/uploads/' in image_path:
                    # 從完整路徑中提取 /uploads/filename 部分
                    uploads_index = image_path.find('/uploads/')
                    if uploads_index >= 0:
                        db_image_path = image_path[uploads_index:]
                        logger.debug(f"從完整路徑提取相對路徑: {db_image_path}")
                
                logger.info(f"💾 準備保存檢測記錄: user_id={user_id}, disease={disease_name}, path={db_image_path}")
                
                record_id, image_saved_to_db = self._save_detection(
                    user_id=user_id,
                    disease_name=disease_name,
                    severity=severity,
                    confidence=confidence,
                    image_path=db_image_path,  # 使用相對路徑保存
                    image_hash=image_hash,
                    image_source=image_source,
                    raw_output=raw_output,
                    processing_time_ms=processing_time,
                    image_bytes=image_bytes_for_db  # 傳遞圖片位元組用於壓縮存儲
                )
                logger.info(f"✅ 檢測記錄已保存: record_id={record_id}, 圖片已存儲到資料庫: {image_saved_to_db}")
                
                # 如果成功保存到資料庫，刪除檔案系統中的原檔（節省磁碟空間）
                if image_saved_to_db and os.path.exists(image_path):
                    try:
                        os.remove(image_path)
                        logger.info(f"🗑️ 已刪除檔案系統原檔: {image_path}（圖片已存儲在資料庫中）")
                    except Exception as delete_error:
                        logger.warning(f"⚠️ 刪除原檔失敗（不影響功能）: {str(delete_error)}")
            except Exception as save_error:
                error_msg = str(save_error)
                logger.error(f"❌ 儲存檢測記錄失敗: {error_msg}", exc_info=True)
                logger.error(f"   詳細資訊: user_id={user_id}, disease={disease_name}, path={db_image_path}")
                # 即使儲存失敗，也返回檢測結果（但不包含 record_id）
                record_id = None
                logger.warning("⚠️ 檢測完成但記錄未儲存到資料庫，用戶仍可看到檢測結果")
                # 記錄到錯誤日誌表
                try:
                    ErrorLogger.log_error(
                        user_id=user_id,
                        error_type="DatabaseError",
                        error_message=f"儲存檢測記錄失敗: {error_msg}",
                        severity="error",
                        context={"disease_name": disease_name, "image_path": db_image_path}
                    )
                except:
                    pass
                # 不拋出異常，讓檢測結果仍然可以返回
            
            # 6. 記錄活動日誌
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='upload',
                resource_type='detection_record',
                resource_id=record_id,
                action_details={
                    'disease': disease_name,
                    'confidence': confidence,
                    'image_source': image_source,
                    'processing_time_ms': processing_time
                }
            )
            
            # 7. 記錄性能日誌
            PerformanceLogger.log_performance(
                operation_name='yolo_prediction',
                execution_time_ms=processing_time,
                status='success',
                details={'disease': disease_name, 'confidence': confidence}
            )
            
            logger.info(f"✅ 檢測完成: {disease_name} (置信度: {confidence:.2%}, 耗時: {processing_time}ms)")
            
            # 如果圖片已存儲到資料庫，使用資料庫圖片 URL；否則使用原路徑
            result_image_path = image_path
            if image_saved_to_db and record_id:
                # 使用資料庫圖片 API 路徑
                result_image_path = f"/image/{record_id}"
            
            return {
                "disease": disease_name,
                "severity": severity,
                "confidence": confidence,
                "image_path": result_image_path,
                "disease_info": disease_info,
                "record_id": record_id,
                "processing_time_ms": processing_time,
                "image_from_db": image_saved_to_db  # 標記圖片是否來自資料庫
            }
            
        except Exception as e:
            processing_time = int((time.time() - start_time) * 1000)
            
            # 記錄錯誤
            ErrorLogger.log_error(
                user_id=user_id,
                error_type='ProcessingError',
                error_message=f'病害檢測失敗: {str(e)}',
                severity='error',
                context={'image_path': image_path, 'processing_time_ms': processing_time}
            )
            
            PerformanceLogger.log_performance(
                operation_name='yolo_prediction',
                execution_time_ms=processing_time,
                status='error',
                details={'error': str(e)}
            )
            
            logger.error(f"❌ 檢測失敗: {str(e)}")
            raise
    
    def _parse_severity(self, disease_name: str) -> str:
        """
        從病害名稱解析嚴重程度
        
        Args:
            disease_name: 病害名稱
        
        Returns:
            嚴重程度 ('Mild', 'Moderate', 'Severe', 'Healthy', 'Unknown')
        """
        # 簡單規則：根據命名或預設值
        if disease_name == "Healthy":
            return "Healthy"
        
        # 可以根據實際模型輸出調整
        # 目前先返回 Unknown，後續可根據實際需求調整
        return "Unknown"
    
    def _get_disease_info(self, disease_name: str) -> Optional[Dict[str, Any]]:
        """
        從資料庫或 JSON 檔案獲取病害詳細資訊
        
        Args:
            disease_name: 病害名稱
        
        Returns:
            病害資訊字典或 None
        """
        try:
            # 先嘗試從資料庫獲取
            try:
                result = db.execute_query(
                    """
                    SELECT chinese_name, causes, features, pesticides, management_measures
                    FROM disease_library
                    WHERE disease_name = %s AND is_active = TRUE
                    """,
                    (disease_name,),
                    fetch_one=True,
                    dict_cursor=True
                )
                
                if result:
                    return {
                        "name": result.get('chinese_name', disease_name),
                        "causes": result.get('causes', ''),
                        "feature": result.get('features', ''),
                        "solution": {
                            "pesticide": result.get('pesticides', []),
                            "management": result.get('management_measures', [])
                        }
                    }
            except Exception as db_error:
                error_msg = str(db_error)
                logger.warning(f"⚠️ 從資料庫獲取病害資訊失敗: {error_msg}")
                if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                    logger.warning("   提示: disease_library 表不存在，將嘗試從 JSON 檔案讀取")
                # 繼續嘗試從 JSON 檔案讀取
            
            # 如果資料庫沒有，嘗試從 JSON 檔案讀取（向後兼容）
            disease_info_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                "data", "disease_info.json"
            )
            
            if os.path.exists(disease_info_file):
                with open(disease_info_file, 'r', encoding='utf-8') as f:
                    disease_db = json.load(f)
                    if disease_name in disease_db:
                        info = disease_db[disease_name]
                        return {
                            "name": info.get("name", disease_name),
                            "causes": info.get("causes", ''),
                            "feature": info.get("feature", ''),
                            "solution": info.get("solution", {})
                        }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ 獲取病害資訊失敗: {str(e)}")
            return None
    
    def _save_detection(self, user_id: int, disease_name: str, severity: str,
                       confidence: float, image_path: str, image_hash: str = None,
                       image_source: str = 'upload', raw_output: Dict = None,
                       processing_time_ms: int = None, image_bytes: bytes = None) -> tuple[int, bool]:
        """
        儲存檢測記錄到資料庫
        
        Args:
            user_id: 使用者 ID
            disease_name: 病害名稱
            severity: 嚴重程度
            confidence: 置信度
            image_path: 圖片路徑
            image_hash: 圖片 hash
            image_source: 圖片來源
            raw_output: 原始模型輸出
            processing_time_ms: 處理時間（毫秒）
            image_bytes: 圖片位元組資料（用於壓縮存儲到資料庫）
        
        Returns:
            (記錄 ID, 是否成功保存圖片到資料庫)
        """
        try:
            # 獲取圖片大小
            image_size = os.path.getsize(image_path) if os.path.exists(image_path) else None
            
            # 準備壓縮圖片資料（如果提供）
            image_data = None
            image_data_size = None
            image_compressed = False
            
            if image_bytes:
                try:
                    from src.services.image_service import ImageService
                    # 壓縮圖片（品質 75，最大尺寸 640x640）
                    compressed_bytes = ImageService.compress_image(image_bytes, quality=75, max_size=(640, 640))
                    image_data = psycopg2.Binary(compressed_bytes)  # 轉換為 PostgreSQL BYTEA
                    image_data_size = len(compressed_bytes)
                    image_compressed = True
                    logger.debug(f"✅ 圖片已壓縮準備存儲: {len(image_bytes)} -> {image_data_size} bytes")
                except Exception as compress_error:
                    logger.warning(f"⚠️ 圖片壓縮失敗，將不存儲到資料庫: {str(compress_error)}")
                    # 繼續執行，不影響主要流程
            
            # 構建 SQL 和參數
            if image_compressed and image_data is not None:
                # 有壓縮圖片，使用完整 SQL
                sql = """
                    INSERT INTO detection_records
                    (user_id, disease_name, severity, confidence, image_path, image_hash,
                     image_size, image_source, image_resized, raw_model_output, status,
                     processing_time_ms, image_data, image_data_size, image_compressed, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """
                params = (
                    user_id,
                    disease_name,
                    severity,
                    confidence,
                    image_path,
                    image_hash,
                    image_size,
                    image_source,
                    True,  # 假設已經 resize（由 ImageService 處理）
                    json.dumps(raw_output) if raw_output else None,
                    'completed',
                    processing_time_ms,
                    image_data,  # 壓縮後的圖片資料
                    image_data_size,  # 壓縮後的大小
                    image_compressed,  # 是否已壓縮
                )
            else:
                # 沒有壓縮圖片，使用基本 SQL（但欄位仍然存在，只是設為 NULL）
                sql = """
                    INSERT INTO detection_records
                    (user_id, disease_name, severity, confidence, image_path, image_hash,
                     image_size, image_source, image_resized, raw_model_output, status,
                     processing_time_ms, image_data, image_data_size, image_compressed, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                """
                params = (
                    user_id,
                    disease_name,
                    severity,
                    confidence,
                    image_path,
                    image_hash,
                    image_size,
                    image_source,
                    True,  # 假設已經 resize（由 ImageService 處理）
                    json.dumps(raw_output) if raw_output else None,
                    'completed',
                    processing_time_ms,
                    None,  # image_data
                    None,  # image_data_size
                    False,  # image_compressed
                )
            
            logger.debug(f"執行 SQL: {sql[:100]}...")
            logger.debug(f"參數: user_id={user_id}, disease={disease_name}, path={image_path}")
            
            result = db.execute_returning(sql, params)
            
            if not result or len(result) == 0:
                logger.error("❌ INSERT 操作未返回 record_id")
                raise ValueError("無法獲取檢測記錄 ID")
            
            record_id = result[0]
            logger.debug(f"✅ 檢測記錄已儲存 (ID: {record_id})")
            # 返回記錄 ID 和是否成功保存圖片到資料庫的標記
            return record_id, image_compressed
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ 儲存檢測記錄失敗: {error_msg}", exc_info=True)
            # 提供更具體的錯誤訊息
            if "relation" in error_msg.lower() and "does not exist" in error_msg.lower():
                logger.error("   提示: detection_records 表不存在，請執行: python scripts/init_database.py")
            elif "foreign key" in error_msg.lower():
                logger.error(f"   提示: 外鍵約束失敗，可能是 user_id={user_id} 不存在於 users 表中")
            elif "duplicate key" in error_msg.lower() or "unique constraint" in error_msg.lower():
                logger.warning(f"   提示: 檢測到重複記錄（可能是 image_hash 重複），嘗試查詢現有記錄")
                # 嘗試查詢現有記錄
                try:
                    existing = db.execute_query(
                        "SELECT id, image_compressed FROM detection_records WHERE image_hash = %s AND user_id = %s",
                        (image_hash, user_id),
                        fetch_one=True
                    )
                    if existing:
                        existing_id = existing[0]
                        existing_compressed = existing[1] if len(existing) > 1 else False
                        logger.info(f"   找到現有記錄 ID: {existing_id}")
                        return existing_id, existing_compressed
                except:
                    pass
            raise  # 重新拋出異常，讓上層處理

