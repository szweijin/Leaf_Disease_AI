# Leaf Disease AI - 資料庫架構文檔

## 目錄

1. [概述](#概述)
2. [資料庫規格](#資料庫規格)
3. [表結構](#表結構)
4. [表關係圖](#表關係圖)
5. [視圖 (Views)](#視圖-views)
6. [函數 (Functions)](#函數-functions)
7. [觸發器 (Triggers)](#觸發器-triggers)
8. [索引 (Indexes)](#索引-indexes)
9. [初始資料](#初始資料)
10. [圖片存儲策略](#圖片存儲策略)

---

## 概述

Leaf Disease AI 資料庫是一個基於 PostgreSQL 的完整系統，用於管理葉片病害檢測 AI 應用的所有資料。系統支援：

-   **使用者管理**：角色權限系統、會話管理
-   **病害檢測**：CNN + YOLO 完整預測流程記錄
-   **病害資訊庫**：病害詳細資訊、防治措施
-   **日誌系統**：活動日誌、錯誤日誌、審計日誌、API 日誌、性能日誌
-   **圖片存儲**：使用 Cloudinary 外部存儲，資料庫僅儲存 URL

---

## 資料庫規格

-   **資料庫系統**：PostgreSQL 13+
-   **資料庫名稱**：`leaf_disease_ai`
-   **字符編碼**：UTF-8
-   **時區**：系統預設時區

---

## 表結構

### 1. 角色與權限系統

#### `roles` - 角色表

| 欄位          | 類型        | 約束                      | 說明     |
| ------------- | ----------- | ------------------------- | -------- |
| `id`          | SERIAL      | PRIMARY KEY               | 角色 ID  |
| `role_name`   | VARCHAR(50) | UNIQUE, NOT NULL          | 角色名稱 |
| `description` | TEXT        |                           | 角色描述 |
| `created_at`  | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP | 建立時間 |

**預設角色**：

-   `user` (id=1)：普通使用者 - 可進行檢測、查看自己的紀錄
-   `admin` (id=2)：管理員 - 完整系統管理權限
-   `developer` (id=3)：開發者 - 可查看日誌、系統指標、執行維護操作

#### `permissions` - 權限表

| 欄位              | 類型         | 約束                      | 說明     |
| ----------------- | ------------ | ------------------------- | -------- |
| `id`              | SERIAL       | PRIMARY KEY               | 權限 ID  |
| `permission_name` | VARCHAR(100) | UNIQUE, NOT NULL          | 權限名稱 |
| `description`     | TEXT         |                           | 權限描述 |
| `created_at`      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 建立時間 |

**預設權限**：

-   `upload_image`：上傳圖像
-   `view_own_records`：查看自己的檢測記錄
-   `view_all_records`：查看所有使用者記錄
-   `manage_users`：管理使用者帳戶
-   `manage_diseases`：編輯病害資訊
-   `view_logs`：查看系統日誌
-   `view_analytics`：查看分析儀表板
-   `export_data`：匯出資料
-   `system_maintenance`：系統維護

#### `role_permissions` - 角色權限關聯表

| 欄位            | 類型    | 約束                             | 說明    |
| --------------- | ------- | -------------------------------- | ------- |
| `role_id`       | INTEGER | PRIMARY KEY, FK → roles.id       | 角色 ID |
| `permission_id` | INTEGER | PRIMARY KEY, FK → permissions.id | 權限 ID |

**權限分配**：

-   **User 角色**：`upload_image`, `view_own_records`
-   **Admin 角色**：所有權限
-   **Developer 角色**：`view_logs`, `view_analytics`, `system_maintenance`

---

### 2. 使用者管理

#### `users` - 使用者表

| 欄位            | 類型         | 約束                               | 說明                   |
| --------------- | ------------ | ---------------------------------- | ---------------------- |
| `id`            | SERIAL       | PRIMARY KEY                        | 使用者 ID              |
| `email`         | VARCHAR(255) | UNIQUE, NOT NULL                   | 電子郵件（含格式檢查） |
| `password_hash` | VARCHAR(255) | NOT NULL                           | 密碼雜湊值             |
| `username`      | VARCHAR(100) | UNIQUE                             | 使用者名稱             |
| `full_name`     | VARCHAR(255) |                                    | 全名                   |
| `role_id`       | INTEGER      | NOT NULL, DEFAULT 1, FK → roles.id | 角色 ID                |
| `is_active`     | BOOLEAN      | DEFAULT TRUE                       | 是否啟用               |
| `created_at`    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP          | 建立時間               |
| `updated_at`    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP          | 更新時間（自動更新）   |
| `last_login`    | TIMESTAMP    |                                    | 最後登入時間           |
| `login_count`   | INTEGER      | DEFAULT 0                          | 登入次數               |
| `profile_data`  | JSONB        | DEFAULT '{}'                       | 個人資料（JSON）       |

**約束**：

-   `chk_email`：電子郵件格式驗證（正則表達式）

#### `sessions` - 會話表

| 欄位                 | 類型         | 約束                      | 說明         |
| -------------------- | ------------ | ------------------------- | ------------ |
| `id`                 | SERIAL       | PRIMARY KEY               | 會話 ID      |
| `user_id`            | INTEGER      | NOT NULL, FK → users.id   | 使用者 ID    |
| `session_token`      | VARCHAR(255) | UNIQUE, NOT NULL          | 會話令牌     |
| `ip_address`         | INET         |                           | IP 地址      |
| `user_agent`         | TEXT         |                           | 使用者代理   |
| `last_activity`      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 最後活動時間 |
| `expires_at`         | TIMESTAMP    | NOT NULL                  | 過期時間     |
| `is_active`          | BOOLEAN      | DEFAULT TRUE              | 是否啟用     |
| `login_failed_count` | INTEGER      | DEFAULT 0                 | 登入失敗次數 |

---

### 3. 病害資訊

#### `disease_library` - 病害資訊庫

| 欄位                  | 類型         | 約束                      | 說明                           |
| --------------------- | ------------ | ------------------------- | ------------------------------ |
| `id`                  | SERIAL       | PRIMARY KEY               | 病害 ID                        |
| `disease_name`        | VARCHAR(255) | UNIQUE, NOT NULL          | 病害名稱（英文，用於模型識別） |
| `chinese_name`        | VARCHAR(255) | NOT NULL                  | 中文名稱                       |
| `english_name`        | VARCHAR(255) |                           | 英文名稱                       |
| `causes`              | TEXT         | NOT NULL                  | 病因                           |
| `features`            | TEXT         | NOT NULL                  | 特徵描述                       |
| `symptoms`            | JSONB        |                           | 症狀（JSON 陣列）              |
| `pesticides`          | JSONB        | NOT NULL                  | 農藥資訊（JSON 陣列）          |
| `management_measures` | JSONB        | NOT NULL                  | 管理措施（JSON 陣列）          |
| `target_crops`        | VARCHAR(255) |                           | 目標作物                       |
| `severity_levels`     | VARCHAR(255) |                           | 嚴重程度等級                   |
| `prevention_tips`     | JSONB        |                           | 預防建議（JSON）               |
| `reference_links`     | JSONB        |                           | 參考連結（JSON）               |
| `created_at`          | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 建立時間                       |
| `updated_at`          | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 更新時間（自動更新）           |
| `is_active`           | BOOLEAN      | DEFAULT TRUE              | 是否啟用                       |

**預設資料**：6 種病害

-   番茄早疫病 (Tomato\_\_early_blight)
-   番茄晚疫病 (Tomato\_\_late_blight)
-   番茄細菌性斑點病 (Tomato\_\_bacterial_spot)
-   馬鈴薯早疫病 (Potato\_\_early_blight)
-   馬鈴薯晚疫病 (Potato\_\_late_blight)
-   甜椒細菌性斑點病 (Bell_pepper\_\_bacterial_spot)

---

### 4. 預測與檢測記錄

#### `prediction_log` - 預測流程記錄表（CNN + YOLO）

此表記錄完整的 CNN + YOLO 預測流程。

| 欄位                 | 類型        | 約束                                   | 說明                                                  |
| -------------------- | ----------- | -------------------------------------- | ----------------------------------------------------- |
| `id`                 | UUID        | PRIMARY KEY, DEFAULT gen_random_uuid() | 預測記錄 ID                                           |
| `user_id`            | INTEGER     | NOT NULL, FK → users.id                | 使用者 ID                                             |
| **圖片資訊**         |             |                                        |                                                       |
| `image_path`         | TEXT        | NOT NULL                               | 圖片路徑/URL（Cloudinary 或本地）                     |
| `image_hash`         | VARCHAR(64) |                                        | 圖片雜湊值                                            |
| `image_size`         | INTEGER     |                                        | 圖片大小（位元組）                                    |
| `image_source`       | VARCHAR(20) | DEFAULT 'upload'                       | 圖片來源                                              |
| `image_data`         | BYTEA       |                                        | ⚠️ 已棄用：保留以維持向後兼容                         |
| `image_data_size`    | INTEGER     |                                        | ⚠️ 已棄用：保留以維持向後兼容                         |
| `image_compressed`   | BOOLEAN     | DEFAULT FALSE                          | ⚠️ 已棄用：保留以維持向後兼容                         |
| **CNN 分類結果**     |             |                                        |                                                       |
| `cnn_mean_score`     | FLOAT       |                                        | CNN 平均分數（所有類別的平均）                        |
| `cnn_best_class`     | VARCHAR(50) |                                        | CNN 最佳分類類別                                      |
| `cnn_best_score`     | FLOAT       |                                        | CNN 最佳分類分數                                      |
| `cnn_all_scores`     | JSONB       |                                        | CNN 所有類別的分數（JSONB）                           |
| **YOLO 檢測結果**    |             |                                        |                                                       |
| `yolo_result`        | JSONB       |                                        | YOLO 檢測結果列表（JSONB）                            |
| `yolo_detected`      | BOOLEAN     | DEFAULT FALSE                          | 是否檢測到病害                                        |
| **流程狀態**         |             |                                        |                                                       |
| `final_status`       | VARCHAR(50) | NOT NULL                               | 最終狀態：`yolo_detected`, `need_crop`, `not_plant`   |
| `workflow_step`      | VARCHAR(50) |                                        | 工作流程步驟：`cnn_only`, `cnn_yolo`, `crop_required` |
| **裁切相關**         |             |                                        |                                                       |
| `crop_coordinates`   | JSONB       |                                        | 裁切座標（如需要）                                    |
| `cropped_image_path` | TEXT        |                                        | 裁切後圖片路徑                                        |
| **圖片 URL**         |             |                                        |                                                       |
| `original_image_url` | TEXT        |                                        | 原始圖片 URL（Cloudinary）                            |
| `predict_img_url`    | TEXT        |                                        | 帶檢測框的預測結果圖片 URL（Cloudinary）              |
| **時間戳**           |             |                                        |                                                       |
| `created_at`         | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP              | 建立時間                                              |
| `updated_at`         | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP              | 更新時間                                              |

**狀態說明**：

-   `final_status`：

    -   `yolo_detected`：YOLO 檢測到病害
    -   `need_crop`：需要裁切
    -   `not_plant`：非植物圖片

-   `workflow_step`：
    -   `cnn_only`：僅執行 CNN 分類
    -   `cnn_yolo`：執行 CNN + YOLO 流程
    -   `crop_required`：需要裁切處理

#### `detection_records` - 檢測記錄表

| 欄位                  | 類型          | 約束                      | 說明                                                                   |
| --------------------- | ------------- | ------------------------- | ---------------------------------------------------------------------- |
| `id`                  | SERIAL        | PRIMARY KEY               | 檢測記錄 ID                                                            |
| `user_id`             | INTEGER       | NOT NULL, FK → users.id   | 使用者 ID                                                              |
| `disease_name`        | VARCHAR(255)  | NOT NULL                  | 病害名稱                                                               |
| `severity`            | VARCHAR(50)   | NOT NULL                  | 嚴重程度：`Mild`, `Moderate`, `Severe`, `Healthy`, `Unknown`           |
| `confidence`          | NUMERIC(5, 4) | NOT NULL, CHECK (0-1)     | 信心度（0-1）                                                          |
| `image_path`          | VARCHAR(500)  | NOT NULL                  | 圖片路徑/URL（Cloudinary 或本地）                                      |
| `image_hash`          | VARCHAR(64)   | UNIQUE                    | 圖片雜湊值                                                             |
| `image_size`          | INTEGER       |                           | 圖片大小（位元組）                                                     |
| `image_source`        | VARCHAR(20)   | DEFAULT 'upload'          | 圖片來源：`camera`, `gallery`, `upload`                                |
| `image_resized`       | BOOLEAN       | DEFAULT FALSE             | 是否已調整大小                                                         |
| `raw_model_output`    | JSONB         |                           | 原始模型輸出（JSON）                                                   |
| `notes`               | TEXT          |                           | 備註                                                                   |
| `status`              | VARCHAR(20)   | DEFAULT 'completed'       | 狀態：`completed`, `processing`, `failed`, `duplicate`, `unrecognized` |
| `processing_time_ms`  | INTEGER       |                           | 處理時間（毫秒）                                                       |
| `created_at`          | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP | 建立時間                                                               |
| `updated_at`          | TIMESTAMP     | DEFAULT CURRENT_TIMESTAMP | 更新時間（自動更新）                                                   |
| `image_data`          | BYTEA         |                           | ⚠️ 已棄用：保留以維持向後兼容                                          |
| `image_data_size`     | INTEGER       |                           | ⚠️ 已棄用：保留以維持向後兼容                                          |
| `image_compressed`    | BOOLEAN       | DEFAULT FALSE             | ⚠️ 已棄用：保留以維持向後兼容                                          |
| `prediction_log_id`   | UUID          | FK → prediction_log.id    | 關聯的預測記錄 ID                                                      |
| `original_image_url`  | TEXT          |                           | 原始圖片 URL（用於歷史記錄顯示）                                       |
| `annotated_image_url` | TEXT          |                           | 帶檢測框的圖片 URL（用於歷史記錄顯示）                                 |

**約束**：

-   `chk_severity`：嚴重程度必須為指定值
-   `chk_status`：狀態必須為指定值
-   `chk_image_source`：圖片來源必須為指定值
-   `chk_image_path_format`：`image_path` 必須為 URL（http/https）或本地路徑（/image/...）

---

### 5. 日誌系統

#### `activity_logs` - 活動日誌表

| 欄位             | 類型         | 約束                      | 說明                   |
| ---------------- | ------------ | ------------------------- | ---------------------- |
| `id`             | SERIAL       | PRIMARY KEY               | 日誌 ID                |
| `user_id`        | INTEGER      | FK → users.id             | 使用者 ID（可為 NULL） |
| `action_type`    | VARCHAR(100) | NOT NULL                  | 操作類型               |
| `resource_type`  | VARCHAR(100) |                           | 資源類型               |
| `resource_id`    | INTEGER      |                           | 資源 ID                |
| `action_details` | JSONB        |                           | 操作詳情（JSON）       |
| `ip_address`     | INET         |                           | IP 地址                |
| `user_agent`     | TEXT         |                           | 使用者代理             |
| `created_at`     | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 建立時間               |

**操作類型** (`action_type`)：

-   `login`, `logout`, `upload`, `download`, `view`, `edit`, `delete`
-   `password_change`, `profile_update`, `permission_change`, `user_created`, `system_event`
-   `register_failed`, `register_success`, `login_failed`, `upload_failed`, `predict_failed`, `prediction`

#### `error_logs` - 錯誤日誌表

| 欄位              | 類型         | 約束                      | 說明                                             |
| ----------------- | ------------ | ------------------------- | ------------------------------------------------ |
| `id`              | SERIAL       | PRIMARY KEY               | 錯誤日誌 ID                                      |
| `user_id`         | INTEGER      | FK → users.id             | 使用者 ID（可為 NULL）                           |
| `error_code`      | VARCHAR(50)  |                           | 錯誤代碼                                         |
| `error_type`      | VARCHAR(100) |                           | 錯誤類型                                         |
| `error_message`   | TEXT         | NOT NULL                  | 錯誤訊息                                         |
| `error_traceback` | TEXT         |                           | 錯誤堆疊追蹤                                     |
| `context`         | JSONB        |                           | 錯誤上下文（JSON）                               |
| `severity`        | VARCHAR(20)  |                           | 嚴重程度：`critical`, `error`, `warning`, `info` |
| `endpoint`        | VARCHAR(255) |                           | API 端點                                         |
| `request_method`  | VARCHAR(10)  |                           | HTTP 方法                                        |
| `created_at`      | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 建立時間                                         |
| `is_resolved`     | BOOLEAN      | DEFAULT FALSE             | 是否已解決                                       |
| `resolved_at`     | TIMESTAMP    |                           | 解決時間                                         |
| `resolution_note` | TEXT         |                           | 解決說明                                         |

**錯誤類型** (`error_type`)：

-   `ValidationError`, `DatabaseError`, `ProcessingError`, `AuthenticationError`
-   `AuthorizationError`, `FileError`, `NetworkError`, `SystemError`, `UnknownError`, `IntegratedPredictionError`

#### `audit_logs` - 審計日誌表

| 欄位             | 類型         | 約束                      | 說明         |
| ---------------- | ------------ | ------------------------- | ------------ |
| `id`             | SERIAL       | PRIMARY KEY               | 審計日誌 ID  |
| `admin_id`       | INTEGER      | FK → users.id             | 管理員 ID    |
| `operation_type` | VARCHAR(100) | NOT NULL                  | 操作類型     |
| `target_table`   | VARCHAR(100) |                           | 目標表名     |
| `target_id`      | INTEGER      |                           | 目標記錄 ID  |
| `old_values`     | JSONB        |                           | 舊值（JSON） |
| `new_values`     | JSONB        |                           | 新值（JSON） |
| `change_summary` | TEXT         |                           | 變更摘要     |
| `ip_address`     | INET         |                           | IP 地址      |
| `created_at`     | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 建立時間     |

**操作類型** (`operation_type`)：

-   `user_created`, `user_updated`, `user_deleted`, `user_activated`, `user_deactivated`
-   `role_assigned`, `permission_granted`, `permission_revoked`
-   `disease_created`, `disease_updated`, `disease_deleted`
-   `database_backup`, `database_restore`, `settings_changed`

#### `api_logs` - API 日誌表

| 欄位                 | 類型         | 約束                      | 說明                                                                  |
| -------------------- | ------------ | ------------------------- | --------------------------------------------------------------------- |
| `id`                 | SERIAL       | PRIMARY KEY               | API 日誌 ID                                                           |
| `user_id`            | INTEGER      | FK → users.id             | 使用者 ID（可為 NULL）                                                |
| `endpoint`           | VARCHAR(255) | NOT NULL                  | API 端點                                                              |
| `method`             | VARCHAR(10)  | NOT NULL                  | HTTP 方法：`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS` |
| `status_code`        | INTEGER      |                           | HTTP 狀態碼                                                           |
| `request_body_size`  | INTEGER      |                           | 請求體大小（位元組）                                                  |
| `response_body_size` | INTEGER      |                           | 響應體大小（位元組）                                                  |
| `execution_time_ms`  | INTEGER      |                           | 執行時間（毫秒）                                                      |
| `ip_address`         | INET         |                           | IP 地址                                                               |
| `user_agent`         | TEXT         |                           | 使用者代理                                                            |
| `error_message`      | TEXT         |                           | 錯誤訊息                                                              |
| `created_at`         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | 建立時間                                                              |

#### `performance_logs` - 性能日誌表

| 欄位                | 類型           | 約束                      | 說明               |
| ------------------- | -------------- | ------------------------- | ------------------ |
| `id`                | SERIAL         | PRIMARY KEY               | 性能日誌 ID        |
| `operation_name`    | VARCHAR(255)   |                           | 操作名稱           |
| `execution_time_ms` | INTEGER        | NOT NULL                  | 執行時間（毫秒）   |
| `memory_used_mb`    | NUMERIC(10, 2) |                           | 記憶體使用量（MB） |
| `cpu_percentage`    | NUMERIC(5, 2)  |                           | CPU 使用率（%）    |
| `status`            | VARCHAR(20)    |                           | 狀態               |
| `details`           | JSONB          |                           | 詳情（JSON）       |
| `created_at`        | TIMESTAMP      | DEFAULT CURRENT_TIMESTAMP | 建立時間           |

---

## 表關係圖

```
┌─────────────┐
│   roles     │
│─────────────│
│ id (PK)     │
│ role_name   │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────┐      ┌──────────────────┐
│   users     │      │  role_permissions │
│─────────────│      │──────────────────│
│ id (PK)     │      │ role_id (PK, FK)  │
│ email       │      │ permission_id(PK) │
│ role_id(FK) │      └──────────────────┘
└──────┬──────┘              │
       │                     │
       │ 1:N                 │ N:1
       │                     │
┌──────▼──────┐      ┌──────▼──────────┐
│  sessions   │      │  permissions    │
│─────────────│      │─────────────────│
│ id (PK)     │      │ id (PK)         │
│ user_id(FK) │      │ permission_name │
└─────────────┘      └─────────────────┘

┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐      ┌──────────────────┐
│  prediction_log     │      │ detection_records │
│─────────────────────│      │──────────────────│
│ id (PK, UUID)       │◄─────┤ id (PK)          │
│ user_id (FK)        │      │ user_id (FK)      │
│ cnn_best_class      │      │ disease_name      │
│ yolo_result         │      │ prediction_log_id │
│ final_status        │      │ severity          │
└─────────────────────┘      │ confidence        │
                             └──────────────────┘

┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐
│  activity_logs       │
│─────────────────────│
│ id (PK)             │
│ user_id (FK)        │
│ action_type         │
└─────────────────────┘

┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐
│  error_logs         │
│─────────────────────│
│ id (PK)             │
│ user_id (FK)        │
│ error_type          │
│ severity            │
└─────────────────────┘

┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐
│  audit_logs         │
│─────────────────────│
│ id (PK)             │
│ admin_id (FK)       │
│ operation_type      │
└─────────────────────┘

┌─────────────┐
│   users     │
└──────┬──────┘
       │
       │ 1:N
       │
┌──────▼──────────────┐
│  api_logs           │
│─────────────────────│
│ id (PK)             │
│ user_id (FK)        │
│ endpoint            │
│ execution_time_ms   │
└─────────────────────┘

┌──────────────────┐
│ disease_library   │
│──────────────────│
│ id (PK)          │
│ disease_name      │
│ chinese_name      │
│ pesticides        │
│ management_measures│
└──────────────────┘
```

---

## 視圖 (Views)

### 1. `user_statistics` - 使用者統計視圖

提供每個使用者的統計資訊。

**欄位**：

-   `user_id`：使用者 ID
-   `email`：電子郵件
-   `full_name`：全名
-   `role_name`：角色名稱
-   `total_detections`：總檢測次數
-   `unique_diseases`：檢測到的不同病害數量
-   `last_detection_at`：最後檢測時間
-   `avg_confidence`：平均信心度
-   `login_count`：登入次數
-   `last_login`：最後登入時間
-   `created_at`：帳號建立時間

**查詢範例**：

```sql
SELECT * FROM user_statistics WHERE user_id = 1;
```

### 2. `error_statistics` - 錯誤統計視圖

按錯誤類型和嚴重程度統計錯誤。

**欄位**：

-   `error_type`：錯誤類型
-   `severity`：嚴重程度
-   `count`：總錯誤數
-   `unresolved_count`：未解決錯誤數
-   `last_error_at`：最後錯誤時間

**查詢範例**：

```sql
SELECT * FROM error_statistics WHERE severity = 'error';
```

### 3. `api_performance_stats` - API 性能統計視圖

統計過去 24 小時的 API 性能指標。

**欄位**：

-   `endpoint`：API 端點
-   `method`：HTTP 方法
-   `call_count`：呼叫次數
-   `avg_time_ms`：平均執行時間（毫秒）
-   `max_time_ms`：最大執行時間（毫秒）
-   `min_time_ms`：最小執行時間（毫秒）
-   `error_count`：錯誤次數
-   `error_rate`：錯誤率（%）

**查詢範例**：

```sql
SELECT * FROM api_performance_stats ORDER BY avg_time_ms DESC;
```

---

## 函數 (Functions)

### 1. `has_permission(p_user_id INTEGER, p_permission_name VARCHAR)`

檢查使用者是否具有指定權限。

**參數**：

-   `p_user_id`：使用者 ID
-   `p_permission_name`：權限名稱

**返回值**：`BOOLEAN`

**使用範例**：

```sql
SELECT has_permission(1, 'upload_image');
```

### 2. `log_activity(...)`

記錄活動日誌的便捷函數。

**參數**：

-   `p_user_id`：使用者 ID（可為 NULL）
-   `p_action_type`：操作類型
-   `p_resource_type`：資源類型（可選）
-   `p_resource_id`：資源 ID（可選）
-   `p_action_details`：操作詳情 JSONB（預設 '{}'）
-   `p_ip_address`：IP 地址（可選）
-   `p_user_agent`：使用者代理（可選）

**返回值**：`INTEGER`（新建立的日誌 ID）

**使用範例**：

```sql
SELECT log_activity(1, 'login', NULL, NULL, '{}', '192.168.1.1', 'Mozilla/5.0');
```

### 3. `update_timestamp()`

觸發器函數，自動更新 `updated_at` 欄位。

**使用**：由觸發器自動調用，無需手動執行。

---

## 觸發器 (Triggers)

### 1. `users_update_timestamp`

**表**：`users`  
**時機**：BEFORE UPDATE  
**功能**：自動更新 `updated_at` 欄位為當前時間

### 2. `detection_records_update_timestamp`

**表**：`detection_records`  
**時機**：BEFORE UPDATE  
**功能**：自動更新 `updated_at` 欄位為當前時間

### 3. `disease_library_update_timestamp`

**表**：`disease_library`  
**時機**：BEFORE UPDATE  
**功能**：自動更新 `updated_at` 欄位為當前時間

---

## 索引 (Indexes)

### 使用者相關索引

-   `idx_users_email`：`users(email)` - 快速查找使用者
-   `idx_users_role`：`users(role_id)` - 按角色查詢
-   `idx_users_created`：`users(created_at)` - 按建立時間排序
-   `idx_users_active`：`users(is_active)` - 過濾啟用使用者

### 會話相關索引

-   `idx_sessions_user`：`sessions(user_id)` - 查找使用者會話
-   `idx_sessions_token`：`sessions(session_token)` - 快速驗證會話令牌
-   `idx_sessions_expires`：`sessions(expires_at)` - 清理過期會話

### 病害資訊索引

-   `idx_disease_name`：`disease_library(disease_name)` - 按名稱查找
-   `idx_disease_chinese`：`disease_library(chinese_name)` - 按中文名稱查找
-   `idx_disease_active`：`disease_library(is_active)` - 過濾啟用病害
-   `idx_disease_fulltext`：GIN 全文搜索索引（`chinese_name` + `causes`）

### 預測記錄索引

-   `idx_prediction_user_id`：`prediction_log(user_id)` - 按使用者查詢
-   `idx_prediction_status`：`prediction_log(final_status)` - 按狀態過濾
-   `idx_prediction_created_at`：`prediction_log(created_at)` - 按時間排序
-   `idx_prediction_image_hash`：`prediction_log(image_hash)` - 查找重複圖片
-   `idx_prediction_workflow_step`：`prediction_log(workflow_step)` - 按工作流程步驟過濾
-   `idx_prediction_image_path`：`prediction_log(image_path)` - 快速查找圖片 URL
-   `idx_prediction_original_image_url`：部分索引（`original_image_url IS NOT NULL`）

### 檢測記錄索引

-   `idx_records_user`：`detection_records(user_id)` - 按使用者查詢
-   `idx_records_disease`：`detection_records(disease_name)` - 按病害查詢
-   `idx_records_created`：`detection_records(created_at DESC)` - 按時間排序
-   `idx_records_status`：`detection_records(status)` - 按狀態過濾
-   `idx_records_user_date`：複合索引 `(user_id, created_at DESC)` - 使用者歷史記錄
-   `idx_records_confidence`：`detection_records(confidence DESC)` - 按信心度排序
-   `idx_records_compressed`：`detection_records(image_compressed)` - 過濾壓縮圖片
-   `idx_detection_prediction_log_id`：`detection_records(prediction_log_id)` - 關聯預測記錄
-   `idx_detection_original_image_url`：部分索引（`original_image_url IS NOT NULL`）
-   `idx_detection_annotated_image_url`：部分索引（`annotated_image_url IS NOT NULL`）
-   `idx_records_image_path`：`detection_records(image_path)` - 快速查找圖片 URL

### 日誌相關索引

-   `idx_activity_user`：`activity_logs(user_id)`
-   `idx_activity_action`：`activity_logs(action_type)`
-   `idx_activity_created`：`activity_logs(created_at DESC)`
-   `idx_activity_user_date`：複合索引 `(user_id, created_at DESC)`
-   `idx_error_severity`：`error_logs(severity)`
-   `idx_error_type`：`error_logs(error_type)`
-   `idx_error_created`：`error_logs(created_at DESC)`
-   `idx_error_resolved`：`error_logs(is_resolved)`
-   `idx_error_user`：`error_logs(user_id)`
-   `idx_audit_admin`：`audit_logs(admin_id)`
-   `idx_audit_operation`：`audit_logs(operation_type)`
-   `idx_audit_target`：複合索引 `(target_table, target_id)`
-   `idx_audit_created`：`audit_logs(created_at DESC)`
-   `idx_api_user`：`api_logs(user_id)`
-   `idx_api_endpoint`：`api_logs(endpoint)`
-   `idx_api_method`：`api_logs(method)`
-   `idx_api_status`：`api_logs(status_code)`
-   `idx_api_created`：`api_logs(created_at DESC)`
-   `idx_api_perf`：`api_logs(execution_time_ms DESC)`
-   `idx_perf_operation`：`performance_logs(operation_name)`
-   `idx_perf_time`：`performance_logs(execution_time_ms DESC)`
-   `idx_perf_created`：`performance_logs(created_at DESC)`

---

## 初始資料

### 角色 (roles)

| ID  | 角色名稱  | 描述                                        |
| --- | --------- | ------------------------------------------- |
| 1   | user      | 普通使用者 - 可進行檢測、查看自己的紀錄     |
| 2   | admin     | 管理員 - 完整系統管理權限                   |
| 3   | developer | 開發者 - 可查看日誌、系統指標、執行維護操作 |

### 權限 (permissions)

| 權限名稱           | 描述               |
| ------------------ | ------------------ |
| upload_image       | 上傳圖像           |
| view_own_records   | 查看自己的檢測記錄 |
| view_all_records   | 查看所有使用者記錄 |
| manage_users       | 管理使用者帳戶     |
| manage_diseases    | 編輯病害資訊       |
| view_logs          | 查看系統日誌       |
| view_analytics     | 查看分析儀表板     |
| export_data        | 匯出資料           |
| system_maintenance | 系統維護           |

### 病害資訊 (disease_library)

系統預設包含 6 種病害的詳細資訊：

1. **番茄早疫病** (Tomato\_\_early_blight)
2. **番茄晚疫病** (Tomato\_\_late_blight)
3. **番茄細菌性斑點病** (Tomato\_\_bacterial_spot)
4. **馬鈴薯早疫病** (Potato\_\_early_blight)
5. **馬鈴薯晚疫病** (Potato\_\_late_blight)
6. **甜椒細菌性斑點病** (Bell_pepper\_\_bacterial_spot)

每種病害包含：

-   中文名稱、英文名稱
-   病因、特徵描述
-   農藥資訊（JSON 陣列）
-   管理措施（JSON 陣列）

---

## 圖片存儲策略

### Cloudinary 外部存儲

系統使用 **Cloudinary** 作為主要圖片存儲服務，資料庫僅儲存圖片 URL。

### 已棄用欄位

以下欄位已棄用，但保留在資料庫中以維持向後兼容：

-   `image_data` (BYTEA)：圖片二進位資料
-   `image_data_size` (INTEGER)：圖片大小
-   `image_compressed` (BOOLEAN)：是否壓縮

**注意**：這些欄位不再使用，新資料不應寫入這些欄位。

### 圖片 URL 欄位

#### `prediction_log` 表

-   `image_path`：圖片路徑/URL（Cloudinary URL 或本地路徑）
-   `original_image_url`：原始圖片 URL（Cloudinary）
-   `predict_img_url`：帶檢測框的預測結果圖片 URL（Cloudinary）

#### `detection_records` 表

-   `image_path`：圖片路徑/URL（Cloudinary URL 或本地路徑）
-   `original_image_url`：原始圖片 URL（用於歷史記錄顯示）
-   `annotated_image_url`：帶檢測框的圖片 URL（用於歷史記錄顯示）

### URL 格式驗證

`image_path` 欄位必須符合以下格式之一：

-   HTTP URL：`http://...`
-   HTTPS URL：`https://...`
-   本地路徑：`/image/...`

此驗證通過檢查約束 `chk_image_path_format` 和 `chk_prediction_image_path_format` 實現。

### 索引優化

為快速查找圖片 URL，已建立以下索引：

-   `idx_records_image_path`：`detection_records(image_path)`
-   `idx_prediction_image_path`：`prediction_log(image_path)`
-   `idx_detection_original_image_url`：部分索引（僅非 NULL 值）
-   `idx_prediction_original_image_url`：部分索引（僅非 NULL 值）

---

## 資料庫初始化

### 執行初始化腳本

```bash
psql -U postgres -d leaf_disease_ai -f init_database.sql
```

### 初始化內容

執行 `init_database.sql` 腳本將：

1. ✅ 建立所有表結構
2. ✅ 插入初始角色和權限資料
3. ✅ 建立角色權限關聯
4. ✅ 插入 6 種病害資訊
5. ✅ 建立所有視圖
6. ✅ 建立所有函數
7. ✅ 建立所有觸發器
8. ✅ 建立所有索引
9. ✅ 添加資料驗證約束

**注意**：此腳本會刪除並重建所有表，請在生產環境使用前備份資料！

---

## 維護建議

### 定期清理

1. **過期會話**：定期清理 `sessions` 表中 `expires_at < NOW()` 的記錄
2. **舊日誌**：根據需求保留日誌時間範圍，定期清理舊日誌
3. **重複圖片**：使用 `image_hash` 欄位識別並處理重複圖片

### 性能優化

1. **索引維護**：定期執行 `VACUUM ANALYZE` 更新統計資訊
2. **分區表**：考慮對大型日誌表（如 `api_logs`、`activity_logs`）進行分區
3. **歸檔策略**：將舊日誌移至歸檔表或外部存儲

### 備份策略

1. **定期備份**：使用 `pg_dump` 定期備份資料庫
2. **增量備份**：配置 WAL（Write-Ahead Logging）進行增量備份
3. **災難恢復**：制定災難恢復計劃並定期測試

---

## 版本資訊

-   **專案版本**：2.1.0
-   **資料庫版本**：PostgreSQL 13+
-   **文檔版本**：1.1
-   **最後更新**：2024-12

---

## 資料庫初始化

### Railway 自動初始化

專案已配置 Railway 自動資料庫初始化：

-   **自動初始化腳本**：`railway-init.sh`
-   **功能**：
    -   自動檢查資料庫是否已初始化
    -   如果未初始化，自動執行初始化 SQL
    -   如果已初始化，跳過初始化步驟
    -   包含錯誤處理，不會因初始化失敗而阻止應用啟動

詳細部署指南請參考：
-   **快速指南**：`RAILWAY_DEPLOYMENT.md`
-   **完整文檔**：`docs/railway_deployment.md`

### 本地手動初始化

執行初始化腳本：

```bash
psql -U postgres -d leaf_disease_ai -f database/init_database.sql
```

---

## 相關文檔

-   [資料庫初始化腳本](../database/init_database.sql)
-   [資料庫管理器](../database/database_manager.py)
-   [後端架構文檔](../docs/backend.md)
-   [前端架構文檔](../docs/frontend.md)
-   [Railway 部署文檔](../docs/railway_deployment.md)
