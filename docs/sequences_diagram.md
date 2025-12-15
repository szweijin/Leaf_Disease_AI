# Leaf Disease AI - Sequence Diagrams

本文檔使用 Mermaid 格式描述系統的主要流程序列圖。

## 角色說明

-   **User**: 使用者
-   **Frontend**: React 前端應用
-   **Backend**: Flask 後端服務
-   **ImageManager**: 圖片管理服務（處理圖片解碼、處理、臨時文件、Cloudinary 上傳）
-   **Database**: PostgreSQL 資料庫
-   **Cloudinary**: 雲端圖片存儲服務（可選，如果啟用）
-   **CNN Model**: CNN 分類模型（MobileNetV3）
-   **YOLO Model**: YOLOv11 病害檢測模型
-   **Redis**: Redis 快取服務（用於登入嘗試限制和檢測結果快取）
-   **Cache**: Flask-Caching（用於使用者統計快取）

---

## 1. 使用者註冊 (Register)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 輸入 email 和 password
    Frontend->>Backend: POST /register<br/>{email, password}

    Backend->>Backend: 驗證請求格式<br/>檢查 JSON 格式和必要欄位

    alt 請求格式錯誤
        Backend-->>Frontend: 400 {error: "請求格式錯誤"}
        Frontend-->>User: 顯示錯誤訊息
    else 請求格式正確
        Backend->>Backend: 驗證 email 格式<br/>validate_email()

        alt Email 格式錯誤
            Backend-->>Frontend: 400 {error: "郵箱格式不正確"}
            Frontend-->>User: 顯示錯誤訊息
        else Email 格式正確
            Backend->>Backend: 驗證密碼複雜度<br/>validate_password()<br/>（至少 8 碼、大小寫、數字）

            alt 密碼不符合要求
                Backend-->>Frontend: 400 {error: "密碼不符合要求"}
                Frontend-->>User: 顯示錯誤訊息
            else 密碼符合要求
                Backend->>Database: 檢查 email 是否已存在<br/>SELECT id FROM users WHERE email = ?

                alt Email 已存在
                    Database-->>Backend: 返回已存在記錄
                    Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
                    Backend-->>Frontend: 400 {error: "該郵箱已被註冊"}
                    Frontend-->>User: 顯示錯誤訊息
                else Email 不存在
                    Database-->>Backend: 返回空結果
                    Backend->>Backend: 使用 generate_password_hash 加密密碼
                    Backend->>Database: INSERT INTO users<br/>(email, password_hash, role_id, ...)
                    Database-->>Backend: 返回新用戶 ID
                    Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs<br/>(action_type: 'register_success')
                    Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
                    Backend-->>Frontend: 200 {status: "註冊成功"}
                    Frontend-->>User: 顯示成功訊息，切換到登入頁面
                end
            end
        end
    end
```

---

## 2. 使用者登入 (Login)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Redis
    participant Database

    User->>Frontend: 輸入 email 和 password
    Frontend->>Backend: POST /login<br/>{email, password}

    Backend->>Redis: 檢查登入嘗試次數<br/>get(login_attempts:email)

    alt 嘗試次數 >= 5
        Redis-->>Backend: 返回嘗試次數 >= 5
        Backend-->>Frontend: 429 {error: "登入嘗試次數過多"}
        Frontend-->>User: 顯示錯誤訊息
    else 嘗試次數 < 5
        Redis-->>Backend: 返回嘗試次數
        Backend->>Database: 查詢用戶<br/>SELECT * FROM users WHERE email = ?

        alt 用戶不存在或帳戶停用
            Database-->>Backend: 返回空或 is_active = FALSE
            Backend->>Redis: 增加失敗嘗試次數<br/>set(login_attempts:email, attempts+1, expire=300)
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs<br/>(status_code: 401)
            Backend-->>Frontend: 401 {error: "Email 或密碼錯誤"}
            Frontend-->>User: 顯示錯誤訊息
        else 用戶存在且啟用
            Database-->>Backend: 返回用戶資料（含 password_hash）
            Backend->>Backend: 驗證密碼<br/>check_password_hash(password_hash, password)

            alt 密碼錯誤
                Backend->>Redis: 增加失敗嘗試次數<br/>set(login_attempts:email, attempts+1, expire=300)
                Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs<br/>(status_code: 401)
                Backend-->>Frontend: 401 {error: "Email 或密碼錯誤"}
                Frontend-->>User: 顯示錯誤訊息
            else 密碼正確
                Backend->>Database: 更新登入資訊<br/>UPDATE users SET last_login = NOW(),<br/>login_count = login_count + 1
                Backend->>Backend: 生成 session_token<br/>secrets.token_urlsafe(32)
                Backend->>Database: 創建 session<br/>INSERT INTO sessions<br/>(user_id, session_token, ip_address,<br/>user_agent, expires_at, ...)
                Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs<br/>(action_type: 'login')
                Backend->>Redis: 清除登入嘗試記錄<br/>delete(login_attempts:email)
                Backend->>Backend: 設置 Flask session<br/>session["user_id"] = user_id<br/>session["email"] = email
                Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs<br/>(status_code: 200)
                Backend-->>Frontend: 200 {status: "logged_in", email}
                Frontend-->>User: 登入成功，顯示主頁面
            end
        end
    end
```

---

## 3. 檢查認證狀態 (Check Auth)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 訪問頁面
    Frontend->>Backend: GET /check-auth

    Backend->>Backend: 檢查 Flask session<br/>get_user_id_from_session()

    alt Session 無效
        Backend-->>Frontend: 200 {authenticated: false}
        Frontend-->>User: 顯示登入頁面
    else Session 有效
        Backend->>Database: 查詢用戶資訊<br/>SELECT * FROM users WHERE id = ?
        Database-->>Backend: 返回用戶資料
        Backend-->>Frontend: 200 {authenticated: true, email}
        Frontend-->>User: 顯示主頁面
    end
```

---

## 4. 整合檢測流程 (CNN + YOLO)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant ImageManager
    participant Redis
    participant Database
    participant Cloudinary
    participant CNN Model
    participant YOLO Model

    User->>Frontend: 上傳圖片（Base64）或拍攝
    Frontend->>Backend: POST /api/predict<br/>{image: base64, source: "upload"}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤，導向登入頁
    else 已登入
        Backend->>ImageManager: 解碼 Base64 圖片<br/>decode_base64_image()
        ImageManager-->>Backend: 返回圖片位元組

        Backend->>ImageManager: 處理圖片（驗證、調整大小、計算 hash）<br/>process_uploaded_image()
        ImageManager-->>Backend: 返回處理後位元組和 image_hash

        Backend->>Redis: 檢查快取<br/>get(integrated_detection:hash:user_id)

        alt 快取命中
            Redis-->>Backend: 返回快取結果
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
            Backend-->>Frontend: 200 {cnn_result, yolo_result, final_status, ...}
            Frontend-->>User: 顯示檢測結果（從快取）
        else 快取未命中
            Redis-->>Backend: 返回 null

            Backend->>ImageManager: 創建臨時文件（上下文管理器）<br/>create_temp_file(processed_bytes)
            ImageManager->>ImageManager: 寫入暫存文件<br/>uploads/tmp{uuid}.jpg
            ImageManager-->>Backend: 返回臨時文件路徑

            Backend->>CNN Model: 執行 CNN 分類<br/>cnn_service.predict(image_path)
            CNN Model-->>Backend: 返回分類結果<br/>{best_class, best_score, mean_score, all_scores}

            Backend->>Backend: 判斷分流邏輯<br/>根據 best_class 決定流程

            alt best_class in ['pepper_bell', 'potato', 'tomato']
                Backend->>YOLO Model: 執行 YOLO 檢測<br/>yolo_detect(model, image_path)
                YOLO Model-->>Backend: 返回檢測結果<br/>{detected, detections: [{class, confidence, bbox}]}

                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(id, cnn_result, yolo_result, final_status, image_path)
                Database-->>Backend: 返回 prediction_id

                Backend->>Database: 保存檢測記錄<br/>INSERT INTO detection_records<br/>(prediction_log_id, disease, confidence, ...)
                Database-->>Backend: 返回 record_id

                Backend->>Cloudinary: 上傳原始圖片<br/>upload_to_cloudinary(origin/{prediction_id})
                Cloudinary-->>Backend: 返回 secure_url

                Backend->>Database: 更新圖片 URL<br/>UPDATE prediction_log<br/>SET original_image_url = secure_url
                Backend->>Database: 更新檢測記錄圖片 URL<br/>UPDATE detection_records<br/>SET original_image_url = secure_url

                Backend->>YOLO Model: 生成帶檢測框圖片<br/>model.predict().plot()
                YOLO Model-->>Backend: 返回帶框圖片（numpy array）

                Backend->>Cloudinary: 上傳帶框圖片<br/>upload_to_cloudinary(predictions/{prediction_id})
                Cloudinary-->>Backend: 返回 predict_img_url

                Backend->>Database: 更新帶框圖片 URL<br/>UPDATE prediction_log<br/>SET predict_img_url = predict_img_url
                Backend->>Database: 更新檢測記錄帶框圖片 URL<br/>UPDATE detection_records<br/>SET annotated_image_url = predict_img_url

                Backend->>Database: 查詢病害資訊<br/>SELECT * FROM disease_library<br/>WHERE disease_name = ?
                Database-->>Backend: 返回病害詳細資訊

                Backend->>ImageManager: 清理臨時文件<br/>cleanup_temp_file()（自動）
                ImageManager->>ImageManager: 刪除暫存文件

                Backend->>Redis: 快取檢測結果（1小時）<br/>set(integrated_detection:hash:user_id, result, expire=3600)
                Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
                Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs

                Backend-->>Frontend: 200 {cnn_result, yolo_result,<br/>final_status: "yolo_detected",<br/>disease_info, original_image_url,<br/>predict_img_url, ...}
                Frontend-->>User: 顯示檢測結果（CNN + YOLO）

            else best_class == 'whole_plant'
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, final_status: "need_crop")
                Database-->>Backend: 返回 prediction_id

                Backend->>ImageManager: 清理臨時文件<br/>cleanup_temp_file()（自動）

                Backend-->>Frontend: 200 {cnn_result,<br/>final_status: "need_crop",<br/>prediction_id, message: "請裁切..."}
                Frontend-->>User: 顯示裁切介面

                User->>Frontend: 裁切圖片
                Frontend->>Backend: POST /api/predict-crop<br/>{prediction_id, crop_coordinates, cropped_image}
                Backend->>Backend: 使用裁切圖片重新執行流程
                Note over Backend: 重新執行 CNN + YOLO 流程<br/>（類似上述流程）

            else best_class == 'others'
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, final_status: "not_plant")
                Backend->>Database: 保存檢測記錄<br/>INSERT INTO detection_records<br/>(disease: "others", ...)
                Database-->>Backend: 返回 prediction_id, record_id

                Backend->>ImageManager: 清理臨時文件<br/>cleanup_temp_file()（自動）

                Backend-->>Frontend: 200 {cnn_result,<br/>final_status: "not_plant",<br/>error: "非植物影像..."}
                Frontend-->>User: 顯示錯誤訊息
            end
        end
    end
```

---

## 5. 獲取檢測歷史 (History)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 點擊查看歷史記錄
    Frontend->>Backend: GET /history<br/>?page=1&per_page=20&order_by=created_at&order_dir=DESC

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤，導向登入頁
    else 已登入
        Backend->>Database: 查詢檢測記錄（支持分頁、排序、過濾）<br/>SELECT id, disease_name, severity, confidence,<br/>image_path, original_image_url, annotated_image_url,<br/>created_at, status, processing_time_ms<br/>FROM detection_records<br/>WHERE user_id = ?<br/>ORDER BY created_at DESC<br/>LIMIT ? OFFSET ?
        Database-->>Backend: 返回記錄列表

        Backend->>Database: 查詢總記錄數<br/>SELECT COUNT(*) FROM detection_records<br/>WHERE user_id = ?
        Database-->>Backend: 返回總數

        alt 無記錄
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
            Backend-->>Frontend: 200 []
            Frontend-->>User: 顯示"尚無檢測記錄"
        else 有記錄
            Backend->>Backend: 格式化記錄<br/>處理圖片 URL（Cloudinary URL 或本地路徑）<br/>處理時間戳格式
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
            Backend-->>Frontend: 200 [{id, disease, severity,<br/>confidence, image_path,<br/>original_image_url, annotated_image_url,<br/>timestamp, created_at, ...}, ...]
            Frontend-->>User: 顯示歷史記錄列表<br/>（支持分頁、排序、過濾）
        end
    end
```

---

## 6. 獲取圖片 (Get Image)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    participant Cloudinary

    User->>Frontend: 查看歷史記錄中的圖片
    Frontend->>Backend: GET /image/{record_id}<br/>或 GET /image/prediction/{prediction_id}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤
    else 已登入
        alt 請求 detection_records 圖片
            Backend->>Database: 查詢記錄<br/>SELECT image_path, original_image_url,<br/>annotated_image_url, user_id<br/>FROM detection_records<br/>WHERE id = ? AND user_id = ?
            Database-->>Backend: 返回記錄
        else 請求 prediction_log 圖片
            Backend->>Database: 查詢記錄<br/>SELECT image_path, original_image_url,<br/>predict_img_url, user_id<br/>FROM prediction_log<br/>WHERE id = ? AND user_id = ?
            Database-->>Backend: 返回記錄
        end

        alt 記錄不存在或無權限
            Backend-->>Frontend: 404 {error: "記錄不存在或無權限"}
            Frontend-->>User: 顯示錯誤或佔位圖
        else 記錄存在
            alt image_path 是 Cloudinary URL
                Backend->>Backend: 檢查 URL 格式<br/>image_path.startswith('https://')
                Backend-->>Frontend: 302 Redirect<br/>Location: Cloudinary URL
                Frontend->>Cloudinary: 請求圖片
                Cloudinary-->>Frontend: 200 image/jpeg<br/>(圖片二進位資料)
                Frontend-->>User: 顯示圖片
            else image_path 是本地路徑
                Backend->>Backend: 檢查路徑格式<br/>image_path.startswith('/image/')
                Backend->>Database: 查詢圖片資料（向後兼容）<br/>SELECT image_data<br/>FROM detection_records<br/>WHERE id = ?
                Database-->>Backend: 返回圖片資料（BYTEA）或 NULL

                alt 圖片資料存在
                    Backend->>Backend: 返回圖片二進位資料
                    Backend-->>Frontend: 200 image/jpeg<br/>(圖片二進位資料)
                    Frontend-->>User: 顯示圖片
                else 圖片資料不存在
                    Backend-->>Frontend: 404 {error: "圖片不存在"}
                    Frontend-->>User: 顯示錯誤或佔位圖
                end
            end
        end
    end
```

---

## 7. 使用者登出 (Logout)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 點擊登出按鈕
    Frontend->>Backend: GET/POST /logout

    Backend->>Backend: 獲取 user_id<br/>get_user_id_from_session()

    alt 已登入
        Backend->>Database: 更新 session 狀態<br/>UPDATE sessions<br/>SET is_active = FALSE<br/>WHERE user_id = ?
        Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
        Backend->>Backend: 清除 Flask session<br/>session.clear()
        Backend-->>Frontend: 200 {status: "logged_out"}
        Frontend-->>User: 顯示登入頁面
    else 未登入
        Backend-->>Frontend: 200 {status: "logged_out"}
        Frontend-->>User: 顯示登入頁面
    end
```

---

## 8. 獲取使用者統計 (User Stats)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Cache
    participant Database

    User->>Frontend: 查看個人統計
    Frontend->>Backend: GET /user/stats

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤
    else 已登入
        Backend->>Cache: 檢查快取（Flask-Caching）<br/>@cache.cached(timeout=300, key_prefix='user_stats')

        alt 快取命中
            Cache-->>Backend: 返回快取統計資料
            Backend-->>Frontend: 200 {total_detections,<br/>disease_stats, severity_stats, ...}
            Frontend-->>User: 顯示統計資料（從快取）
        else 快取未命中
            Cache-->>Backend: 返回 null
            Backend->>Database: 查詢統計資料<br/>SELECT COUNT(*), disease_name, severity,<br/>AVG(confidence), ...<br/>FROM detection_records<br/>WHERE user_id = ?<br/>GROUP BY disease_name, severity
            Database-->>Backend: 返回統計結果

            Backend->>Backend: 計算統計資料<br/>聚合 disease_stats, severity_stats
            Backend->>Cache: 快取統計資料（5分鐘）<br/>Flask-Caching 自動處理
            Backend-->>Frontend: 200 {total_detections,<br/>disease_stats, severity_stats, ...}
            Frontend-->>User: 顯示統計資料
        end
    end
```

---

## 注意事項

### Redis 快取策略

1. **登入嘗試限制**: `login_attempts:{email}` - 5 分鐘過期
2. **檢測結果快取**: `integrated_detection:{image_hash}:{user_id}` - 1 小時過期
3. **使用者統計快取**: Flask-Caching (`@cache.cached`) - 5 分鐘過期

### 錯誤處理

-   所有 API 請求都會記錄到 `api_logs` 表
-   認證錯誤會記錄到 `error_logs` 表
-   使用者活動會記錄到 `activity_logs` 表

### 圖片存儲

-   上傳的圖片會先暫存到 `uploads/` 目錄（使用臨時文件）
-   檢測完成後，圖片會上傳到 Cloudinary（如果啟用）：
    -   原始圖片：`leaf_disease_ai/origin/{prediction_id}.jpg`
    -   帶檢測框圖片：`leaf_disease_ai/predictions/{prediction_id}.jpg`
-   資料庫中只存儲圖片 URL（`original_image_url`, `predict_img_url`, `annotated_image_url`）
-   臨時文件會在檢測完成後自動清理（使用上下文管理器）
-   圖片可通過以下端點獲取：
    -   `/image/{record_id}` - 獲取 detection_records 圖片
    -   `/image/prediction/{prediction_id}` - 獲取 prediction_log 圖片
    -   如果是 Cloudinary URL，會重定向到 Cloudinary
    -   如果是本地路徑，會從資料庫讀取（向後兼容）

### AI Model 整合

-   CNN 和 YOLOv11 模型在後端啟動時載入
-   CNN 分類流程：
    -   先執行 CNN 分類，獲取圖片類別（pepper_bell, potato, tomato, whole_plant, others）
    -   根據分類結果決定是否執行 YOLO 檢測
-   YOLO 檢測流程（僅在特定類別時執行）：
    -   調用 `yolo_detect(model, image_path)` 進行檢測
    -   使用 `model.predict().plot()` 生成帶檢測框的圖片
    -   預測結果包含：病害名稱、置信度、邊界框等資訊
-   整合檢測服務 (`IntegratedDetectionService`) 統一管理整個流程

### Cloudinary 圖片存儲

-   如果啟用 Cloudinary，所有圖片都會上傳到 Cloudinary 雲端存儲
-   圖片組織結構：
    -   `leaf_disease_ai/origin/{prediction_id}.jpg` - 原始圖片
    -   `leaf_disease_ai/predictions/{prediction_id}.jpg` - 帶檢測框的圖片
-   資料庫中只存儲 Cloudinary URL，不存儲圖片二進位資料
-   圖片訪問：
    -   通過 Cloudinary URL 直接訪問（CDN 加速）
    -   如果 Cloudinary 未啟用，則使用本地文件系統或資料庫存儲（向後兼容）
