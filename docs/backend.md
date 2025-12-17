# Backend 架構文檔

## 專案概述

Leaf Disease AI Backend 是一個基於 Flask 的植物葉片病害檢測系統後端服務，整合了 CNN 分類模型和 YOLO 檢測模型，提供完整的病害檢測 API 服務。

### 主要功能

-   **使用者認證與管理**：註冊、登入、登出、個人資料管理
-   **病害檢測**：整合 CNN + YOLO 的兩階段檢測流程
-   **圖片管理**：支援本地儲存和 Cloudinary 雲端儲存
-   **歷史記錄**：檢測歷史查詢、統計、刪除
-   **日誌系統**：活動日誌、錯誤日誌、API 日誌、性能日誌

---

## 目錄結構

```
backend/
├── app.py                          # Flask 應用程式主文件（路由定義）
├── test_model_loading.py          # 模型載入測試腳本
├── backend.md                      # 本文件
│
├── modules/                        # AI 模型模組
│   ├── __init__.py
│   ├── cnn_load.py                 # CNN 模型載入
│   ├── cnn_preprocess.py           # CNN 圖片預處理
│   ├── cnn_predict.py              # CNN 預測
│   ├── cnn_postprocess.py          # CNN 結果後處理
│   ├── cnn_utils.py                # CNN 工具函數
│   ├── yolo_load.py                # YOLO 模型載入
│   ├── yolo_detect.py              # YOLO 檢測
│   ├── yolo_postprocess.py         # YOLO 結果後處理
│   ├── yolo_utils.py               # YOLO 工具函數
│   ├── sr_load.py                  # 超解析度模型載入
│   ├── sr_preprocess.py            # 超解析度預處理
│   ├── sr_utils.py                  # 超解析度工具函數
│   └── SR_README.md                # 超解析度模組說明
│
└── src/                            # 應用程式源碼
    ├── __init__.py
    │
    ├── core/                       # 核心模組
    │   ├── __init__.py
    │   ├── core_app_config.py      # 應用程式配置與初始化
    │   ├── core_db_manager.py      # 資料庫連接管理器
    │   ├── core_helpers.py         # 輔助函數（認證、日誌）
    │   ├── core_redis_manager.py   # Redis 快取管理器
    │   └── core_user_manager.py    # 使用者管理（註冊、登入、查詢）
    │
    └── services/                   # 業務服務層
        ├── __init__.py
        ├── service_auth.py          # 認證服務（註冊、登入、登出）
        ├── service_user.py         # 使用者服務（個人資料、統計）
        ├── service_cnn.py          # CNN 分類服務
        ├── service_yolo.py         # YOLO 檢測服務
        ├── service_integrated.py   # 整合檢測服務（CNN + YOLO）
        ├── service_integrated_api.py # 整合檢測 API 服務
        ├── service_yolo_api.py     # YOLO 檢測 API 服務（向後兼容）
        ├── service_image.py        # 圖片處理服務
        ├── service_image_manager.py # 圖片管理器（統一管理圖片流程）
        └── service_cloudinary.py    # Cloudinary 儲存服務
```

---

## 核心模組 (src/core)

### 1. core_app_config.py

**功能**：應用程式配置和初始化

**主要函數**：

-   `create_app()`: 創建並配置 Flask 應用程式
    -   根據環境變數載入配置（DevelopmentConfig 或 ProductionConfig）
    -   配置 CORS（開發環境允許本地前端，生產環境可配置允許的域名）
    -   配置快取（Redis 或簡單記憶體快取）
    -   配置 Swagger 文檔
    -   設定上傳資料夾
    -   載入 AI 模型（CNN、YOLO、超解析度）
    -   初始化 Cloudinary 儲存

**返回**：

```python
app, cache, upload_folder, detection_service, integrated_service, cloudinary_storage
```

### 2. core_db_manager.py

**功能**：PostgreSQL 資料庫連接管理器

**主要類別**：

-   `DatabaseManager`: 資料庫連接池管理
    -   `get_connection()`: 獲取資料庫連接（上下文管理器）
    -   `get_cursor()`: 獲取遊標（自動處理事務）
    -   `execute_query()`: 執行 SELECT 查詢
    -   `execute_update()`: 執行 INSERT/UPDATE/DELETE
    -   `execute_returning()`: 執行 RETURNING 操作
    -   `execute_batch()`: 批量插入
    -   `call_function()`: 呼叫 PostgreSQL 函數
    -   `transaction()`: 執行事務性操作

**日誌記錄類別**：

-   `ActivityLogger`: 活動日誌記錄
-   `ErrorLogger`: 錯誤日誌記錄
-   `AuditLogger`: 審計日誌記錄
-   `APILogger`: API 日誌記錄
-   `PerformanceLogger`: 性能日誌記錄

**全局實例**：

```python
db = DatabaseManager()
```

### 3. core_helpers.py

**功能**：核心輔助函數

**主要函數**：

-   `get_user_id_from_session()`: 從 session 獲取使用者 ID
-   `log_api_request()`: 記錄 API 請求日誌

### 4. core_redis_manager.py

**功能**：Redis 快取管理器

**主要類別**：

-   `RedisManager`: Redis 快取管理
    -   `is_available()`: 檢查 Redis 是否可用
    -   `get()`: 獲取快取值
    -   `set()`: 設置快取值
    -   `delete()`: 刪除快取鍵
    -   `exists()`: 檢查鍵是否存在
    -   `expire()`: 設置過期時間
    -   `clear_pattern()`: 清除符合模式的所有鍵
    -   `increment()`: 遞增計數器
    -   `get_hash()` / `set_hash()`: Hash 操作

**裝飾器**：

-   `@cache_result()`: 快取裝飾器

**全局實例**：

```python
redis_manager = RedisManager()
```

### 5. core_user_manager.py

**功能**：使用者管理模組

**主要類別**：

#### UserManager

-   `validate_email()`: 驗證郵箱格式
-   `validate_password()`: 驗證密碼複雜度
-   `register()`: 註冊新使用者
-   `login()`: 使用者登入
-   `logout()`: 使用者登出
-   `change_password()`: 修改密碼
-   `has_permission()`: 檢查使用者權限
-   `get_user_info()`: 獲取使用者資訊
-   `update_user_info()`: 更新使用者資訊
-   `assign_role()`: 分配角色（管理員操作）
-   `deactivate_user()`: 停用使用者帳戶（管理員操作）

#### DetectionQueries

-   `get_user_detections()`: 獲取使用者檢測歷史（支持分頁、排序、過濾）
-   `delete_detection()`: 刪除檢測記錄
-   `get_disease_statistics()`: 獲取使用者病害統計
-   `get_severity_distribution()`: 獲取嚴重程度分佈
-   `get_disease_info()`: 根據病害名稱查詢病害詳細資訊

#### LogQueries

-   `get_activity_logs()`: 獲取最近活動日誌
-   `get_error_logs_unresolved()`: 獲取未解決的錯誤
-   `get_api_performance()`: 獲取 API 性能統計

---

## 服務層 (src/services)

### 1. service_auth.py

**功能**：使用者認證服務

**主要類別**：

-   `AuthService`: 認證服務類
    -   `register()`: 處理使用者註冊請求
    -   `login()`: 處理使用者登入請求
    -   `logout()`: 處理使用者登出請求
    -   `check_auth()`: 檢查認證狀態

### 2. service_user.py

**功能**：使用者個人資料服務

**主要類別**：

-   `UserService`: 使用者服務類
    -   `get_profile()`: 獲取使用者個人資料
    -   `change_password()`: 修改密碼
    -   `update_profile()`: 更新使用者個人資料
    -   `get_stats()`: 獲取使用者統計資料（使用快取）

### 3. service_cnn.py

**功能**：CNN 分類服務

**主要類別**：

-   `CNNClassifierService`: CNN 分類服務類
    -   `__init__()`: 初始化 CNN 模型
    -   `predict()`: 執行 CNN 分類預測
    -   `predict_from_bytes()`: 從圖片位元組執行預測
    -   `should_run_yolo()`: 判斷是否需要執行 YOLO 檢測
    -   `get_final_status()`: 獲取最終狀態

### 4. service_yolo.py

**功能**：YOLO 檢測服務

**主要類別**：

-   `DetectionService`: 檢測服務類
    -   `__init__()`: 初始化 YOLO 模型
    -   `predict()`: 執行病害檢測
    -   `_save_detection()`: 儲存檢測記錄到資料庫

### 5. service_integrated.py

**功能**：整合檢測服務（CNN + YOLO）

**主要類別**：

-   `IntegratedDetectionService`: 整合檢測服務類
    -   `__init__()`: 初始化 CNN、YOLO、超解析度模型
    -   `predict()`: 執行完整的 CNN + YOLO 檢測流程
        -   階段 0: 超解析度預處理（可選）
        -   階段 1: CNN 分類
        -   階段 2: 分流邏輯（YOLO 檢測 / 需要裁切 / 非植物）
        -   階段 3: 儲存到資料庫
        -   階段 4: 構建回應
    -   `predict_with_crop()`: 使用裁切後的圖片重新執行檢測

**工作流程**：

1. CNN 分類 → 判斷圖片類型
2. 如果是 `leaf` 類別 → 執行 YOLO 檢測
3. 如果是 `whole_plant` → 提示使用者裁切
4. 如果是 `others` → 返回非植物影像錯誤

### 6. service_integrated_api.py

**功能**：整合檢測 API 服務

**主要類別**：

-   `IntegratedDetectionAPIService`: 整合檢測 API 服務類
    -   `predict()`: 處理整合檢測請求
        -   解析 base64 圖片資料
        -   處理圖片（驗證、resize、計算 hash）
        -   檢查快取
        -   執行整合檢測
        -   上傳原始圖片到 Cloudinary
        -   生成帶框圖片並上傳到 Cloudinary
        -   查詢病害詳細資訊
        -   快取結果
    -   `predict_with_crop()`: 處理裁切後的圖片檢測請求

### 7. service_yolo_api.py

**功能**：YOLO 檢測 API 服務（向後兼容）

**主要類別**：

-   `DetectionAPIService`: 檢測 API 服務類
    -   `predict()`: 處理病害檢測請求
    -   `delete_record()`: 刪除檢測記錄
    -   `get_history()`: 獲取檢測歷史記錄（支持分頁、排序、過濾）
    -   `serve_uploaded_file()`: 提供上傳的圖片文件
    -   `get_image_from_db()`: 從 Cloudinary 或本地獲取圖片

### 8. service_image.py

**功能**：圖片處理服務

**主要類別**：

-   `ImageService`: 圖片處理服務類
    -   `calculate_hash()`: 計算圖片的 SHA256 hash
    -   `resize_image()`: 將圖片 resize 到指定尺寸
    -   `validate_image()`: 驗證圖片格式和大小
    -   `process_image()`: 處理圖片（驗證、resize、計算 hash）
    -   `compress_image()`: 壓縮圖片
    -   `save_image()`: 保存圖片到文件系統

### 9. service_image_manager.py

**功能**：圖片管理器（統一管理圖片流程）

**主要類別**：

-   `ImageManager`: 圖片管理服務類
    -   `decode_base64_image()`: 解碼 base64 圖片資料
    -   `process_uploaded_image()`: 處理上傳的圖片
    -   `process_cropped_image()`: 處理裁切後的圖片
    -   `create_temp_file()`: 創建暫存文件（上下文管理器，自動清理）
    -   `upload_to_cloudinary()`: 上傳圖片到 Cloudinary
    -   `cleanup_old_temp_files()`: 清理過期暫存文件

**初始化函數**：

-   `init_image_manager()`: 初始化圖片管理器

### 10. service_cloudinary.py

**功能**：Cloudinary 圖片儲存服務

**主要類別**：

-   `CloudinaryStorage`: Cloudinary 儲存服務類
    -   `upload_image()`: 上傳圖片到 Cloudinary
    -   `delete_image()`: 刪除 Cloudinary 圖片
    -   `get_image_url()`: 獲取圖片 URL
    -   `transform_image()`: 轉換圖片（resize、crop 等）

**初始化函數**：

-   `init_cloudinary_storage()`: 初始化 Cloudinary 儲存服務

---

## 模型模組 (modules)

### CNN 模組

#### cnn_load.py

-   `load_cnn_model()`: 載入 CNN 模型（使用 timm 庫）

#### cnn_preprocess.py

-   `preprocess_image()`: 從文件路徑預處理圖片
-   `preprocess_image_from_bytes()`: 從位元組預處理圖片

#### cnn_predict.py

-   `cnn_predict()`: 執行 CNN 預測

#### cnn_postprocess.py

-   `postprocess_cnn_result()`: 後處理 CNN 結果

#### cnn_utils.py

-   `CNN_CLASSES`: CNN 分類類別列表
-   `should_run_yolo()`: 判斷是否需要執行 YOLO
-   `get_final_status()`: 獲取最終狀態

### YOLO 模組

#### yolo_load.py

-   `load_yolo_model()`: 載入 YOLO 模型

#### yolo_detect.py

-   `yolo_detect()`: 執行 YOLO 檢測

#### yolo_postprocess.py

-   `postprocess_yolo_result()`: 後處理 YOLO 結果
-   `draw_boxes_on_image()`: 在圖片上繪製檢測框
-   `parse_severity()`: 解析嚴重程度

#### yolo_utils.py

-   `get_disease_info()`: 獲取病害資訊

### 超解析度模組

#### sr_load.py

-   `SuperResolutionModelLoader`: 超解析度模型載入器

#### sr_preprocess.py

-   `preprocess_with_sr()`: 使用超解析度預處理圖片

#### sr_utils.py

-   超解析度工具函數

---

## 主應用程式 (app.py)

### 應用程式初始化

```python
# 創建應用程式和服務
app, cache, upload_folder, detection_service, integrated_service, cloudinary_storage = create_app()

# 初始化圖片管理器
image_manager = init_image_manager(...)

# 初始化服務實例
auth_service = AuthService()
user_service = UserService()
yolo_api_service = DetectionAPIService(detection_service, upload_folder)
integrated_api_service = IntegratedDetectionAPIService(integrated_service, image_manager)
```

### API 端點

#### 診斷端點

-   `GET /api/health`: 服務健康檢查
-   `GET /api/status`: 服務狀態檢查（臨時診斷用）

#### 認證相關路由

-   `POST /register`: 使用者註冊
-   `POST /login`: 使用者登入
-   `GET/POST /logout`: 使用者登出
-   `GET /check-auth`: 檢查認證狀態

#### 使用者相關路由

-   `GET /user/profile`: 獲取使用者個人資料
-   `POST /user/change-password`: 修改密碼
-   `POST /user/update-profile`: 更新使用者個人資料
-   `GET /user/stats`: 獲取使用者統計資料（快取 5 分鐘）

#### 檢測相關路由

-   `POST /predict`: 病害檢測（使用整合檢測服務或舊的檢測服務）
-   `POST /api/predict`: 整合檢測 API（CNN + YOLO）
-   `POST /api/predict-crop`: 裁切後重新檢測
-   `GET /history`: 獲取檢測歷史記錄
-   `DELETE /history/delete`: 刪除檢測歷史記錄
-   `GET /uploads/<filename>`: 提供上傳的圖片文件
-   `GET /image/<int:record_id>`: 從資料庫獲取圖片
-   `GET /image/prediction/<prediction_id>`: 從資料庫獲取預測記錄圖片

#### 系統路由

-   `GET /`: API 狀態檢查

---

## 配置與初始化

### 配置檔案位置

-   `config/base.py`: 基礎配置（所有環境共用）
-   `config/development.py`: 開發環境配置（本地開發使用）
-   `config/production.py`: 生產環境配置（Railway 部署使用）

**環境選擇**：
- 系統會根據 `FLASK_ENV` 或 `ENVIRONMENT` 環境變數自動選擇配置
- 開發環境（預設）：使用 `DevelopmentConfig`
- 生產環境：使用 `ProductionConfig`

### 環境變數（.env）

-   資料庫配置：`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
-   Redis 配置：`REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`
-   Cloudinary 配置：`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
-   模型路徑：`CNN_MODEL_PATH_RELATIVE`, `YOLO_MODEL_PATH_RELATIVE`, `SR_MODEL_PATH_RELATIVE`
-   其他配置：`UPLOAD_FOLDER_RELATIVE`, `USE_CLOUDINARY`, `ENABLE_SR`

### 初始化流程

1. **載入環境變數**：從 `.env` 檔案載入
2. **創建 Flask 應用程式**：`create_app()`
3. **配置 CORS**：允許前端跨域請求
4. **配置快取**：優先使用 Redis，否則使用簡單記憶體快取
5. **配置 Swagger**：API 文檔
6. **設定上傳資料夾**：創建並驗證權限
7. **載入 AI 模型**：
    - CNN 模型（用於分類）
    - YOLO 模型（用於檢測）
    - 超解析度模型（可選，用於預處理）
8. **初始化 Cloudinary**：如果啟用
9. **初始化圖片管理器**：統一管理圖片流程
10. **初始化服務實例**：認證、使用者、檢測服務

---

## 資料庫管理

### 資料庫連接

使用連接池管理 PostgreSQL 連接：

-   最小連接數：2
-   最大連接數：10

### 主要資料表

-   `users`: 使用者表
-   `sessions`: 會話表
-   `detection_records`: 檢測記錄表
-   `prediction_log`: 預測日誌表
-   `disease_library`: 病害資料庫表
-   `activity_logs`: 活動日誌表
-   `error_logs`: 錯誤日誌表
-   `audit_logs`: 審計日誌表
-   `api_logs`: API 日誌表
-   `performance_logs`: 性能日誌表

### 資料庫操作

所有資料庫操作都通過 `DatabaseManager` 進行：

-   使用上下文管理器自動處理連接和事務
-   自動錯誤處理和日誌記錄
-   支持參數化查詢（防止 SQL 注入）

---

## 圖片管理

### 圖片儲存策略

1. **本地儲存**（預設）：

    - 圖片儲存在 `uploads/` 資料夾
    - 使用資料庫 URL（`/image/<record_id>`）訪問

2. **Cloudinary 儲存**（可選）：
    - 原始圖片：`leaf_disease_ai/origin/<prediction_id>`
    - 帶框圖片：`leaf_disease_ai/predictions/<prediction_id>`
    - 使用 Cloudinary URL 訪問

### 圖片處理流程

1. **接收圖片**：從前端接收 base64 編碼的圖片
2. **解碼**：解碼 base64 資料
3. **驗證**：驗證圖片格式和大小
4. **處理**：resize 到標準尺寸（640x640）
5. **計算 hash**：計算 SHA256 hash（用於檢測重複）
6. **儲存**：上傳到 Cloudinary 或保存到本地
7. **清理**：自動清理臨時文件

### 圖片管理器功能

-   統一管理圖片處理流程
-   自動清理過期暫存文件（預設 24 小時）
-   支援 Cloudinary 和本地儲存切換
-   上下文管理器自動清理臨時文件

---

## 快取策略

### Redis 快取

-   **使用者統計資料**：快取 5 分鐘
-   **檢測結果**：快取 1 小時（使用圖片 hash 作為鍵）
-   **登入嘗試次數**：快取 5 分鐘（防止暴力破解）

### 快取鍵格式

-   `user_stats:{user_id}`: 使用者統計資料
-   `integrated_detection:{image_hash}:{user_id}`: 整合檢測結果
-   `detection_result:{image_hash}:{user_id}`: 檢測結果
-   `login_attempts:{email}`: 登入嘗試次數

---

## 日誌系統

### 日誌類型

1. **活動日誌** (`activity_logs`):

    - 使用者操作記錄
    - 登入、登出、上傳、檢測等

2. **錯誤日誌** (`error_logs`):

    - 系統錯誤記錄
    - 包含錯誤堆疊和上下文資訊

3. **審計日誌** (`audit_logs`):

    - 管理員操作記錄
    - 角色分配、帳戶停用等

4. **API 日誌** (`api_logs`):

    - API 請求記錄
    - 包含執行時間、狀態碼、錯誤訊息

5. **性能日誌** (`performance_logs`):
    - 性能指標記錄
    - 執行時間、記憶體使用、CPU 使用率

### 日誌記錄方式

-   所有日誌都通過 `DatabaseManager` 記錄到 PostgreSQL
-   同時輸出到控制台（開發環境）
-   使用結構化日誌格式

---

## 測試工具

### test_model_loading.py

用於診斷整合檢測服務載入問題的測試腳本。

**功能**：

-   測試模型路徑配置
-   測試 CNN 模型載入
-   測試 YOLO 模型載入
-   測試整合檢測服務載入

**使用方法**：

```bash
python backend/test_model_loading.py
```

---

## 錯誤處理

### 錯誤處理策略

1. **資料庫錯誤**：

    - 自動回滾事務
    - 記錄詳細錯誤日誌
    - 返回友好的錯誤訊息

2. **模型載入錯誤**：

    - 記錄錯誤日誌
    - 返回 None（服務降級）
    - 在健康檢查中報告

3. **圖片處理錯誤**：

    - 驗證失敗返回 400 錯誤
    - 處理失敗記錄錯誤日誌
    - 返回友好的錯誤訊息

4. **API 錯誤**：
    - 記錄 API 日誌
    - 返回適當的 HTTP 狀態碼
    - 開發環境返回詳細錯誤，生產環境返回簡化錯誤

---

## 安全措施

### 認證與授權

-   Session 認證（Flask session）
-   密碼加密（Werkzeug security）
-   登入嘗試次數限制（防止暴力破解）
-   會話過期時間（預設 24 小時）

### 資料驗證

-   郵箱格式驗證
-   密碼複雜度驗證（至少 8 個字符，包含大小寫字母和數字）
-   圖片格式和大小驗證
-   SQL 注入防護（參數化查詢）

### 資料保護

-   密碼不記錄在日誌中
-   敏感資訊不過度暴露
-   錯誤訊息在生產環境中簡化

---

## 性能優化

### 快取策略

-   Redis 快取常用資料
-   檢測結果快取（避免重複計算）
-   使用者統計資料快取

### 資料庫優化

-   使用連接池（減少連接開銷）
-   參數化查詢（提高查詢效率）
-   索引優化（在資料庫層面）

### 圖片處理優化

-   圖片 resize 到標準尺寸（減少模型輸入大小）
-   臨時文件自動清理（節省磁碟空間）
-   Cloudinary CDN（加速圖片訪問）

---

## 部署說明

### 開發環境

1. 安裝依賴：

```bash
pip install -r requirements.txt
```

2. 配置環境變數：

```bash
cp .env.example .env
# 編輯 .env 檔案
```

3. 初始化資料庫：

```bash
python database/database_manager.py init
```

4. 啟動服務：

```bash
python backend/app.py
```

### 生產環境

#### Railway 部署（推薦）

專案已配置 Railway 部署支援：

1. **部署配置**：
   - `railway.json` - Railway 部署配置
   - `build.sh` - 自動構建腳本（構建前端、安裝依賴）
   - `railway-init.sh` - 資料庫自動初始化腳本
   - `Procfile` - Gunicorn 啟動配置

2. **環境配置**：
   - 使用 `config/production.py` 生產環境配置
   - 通過 Railway 環境變數配置所有設定
   - 自動支援 HTTPS（Railway 提供）

3. **啟動流程**：
   - 構建階段：執行 `build.sh` 構建前端和安裝依賴
   - 啟動階段：執行 `railway-init.sh` 初始化資料庫，然後啟動 Gunicorn

4. **詳細文檔**：
   - 快速指南：`RAILWAY_DEPLOYMENT.md`
   - 完整文檔：`docs/railway_deployment.md`

#### 傳統部署方式

1. 使用 Gunicorn 或 uWSGI 部署
2. 配置 Nginx 反向代理
3. 使用環境變數配置（不提交 .env 檔案）
4. 啟用 HTTPS
5. 配置日誌輪轉
6. 監控服務健康狀態

---

## 版本資訊

-   **版本**：2.1.0
-   **作者**：szweijin
-   **許可證**：MIT

---

## 相關文檔

-   `database/database.md`: 資料庫架構文檔
-   `README.md`: 專案總體說明
-   `modules/SR_README.md`: 超解析度模組說明

---

## 更新日誌

### v2.1.0

-   ✅ Railway 部署支援（railway.json, build.sh, railway-init.sh）
-   ✅ 生產環境配置（config/production.py）
-   ✅ 前端靜態文件服務（生產環境 SPA 路由）
-   ✅ Gunicorn WSGI 服務器配置
-   ✅ 自動資料庫初始化
-   ✅ 環境變數自動選擇配置（開發/生產）

### v2.0.0

-   整合 CNN + YOLO 檢測流程
-   支援超解析度預處理
-   支援 Cloudinary 雲端儲存
-   統一的圖片管理器
-   完整的日誌系統
-   性能優化和錯誤處理改進
