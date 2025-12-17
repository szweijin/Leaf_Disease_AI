# Leaf Disease AI - Sequence Diagrams

本文檔使用 Mermaid 格式描述系統的主要流程序列圖。

## 角色說明

-   **User**: 使用者
-   **Frontend**: React 前端應用
-   **Backend**: Flask 後端服務
-   **ImageManager**: 圖片管理服務（處理圖片解碼、處理、臨時文件、Cloudinary 上傳）
-   **Database**: PostgreSQL 資料庫
-   **Cloudinary**: 雲端圖片存儲服務（可選，如果啟用）
-   **SR Model**: 超解析度模型（EDSR，可選，用於圖片預處理）
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
    participant SR Model
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

            Note over Backend,SR Model: 階段 0: 超解析度預處理（可選）
            alt 啟用超解析度
                Backend->>SR Model: 執行超解析度預處理<br/>preprocess_with_sr(image_path, scale=2x)
                SR Model-->>Backend: 返回增強後圖片路徑
                Note over Backend: 使用增強後圖片進行後續處理
            end

            Note over Backend,CNN Model: 階段 1: CNN 分類
            Backend->>CNN Model: 執行 CNN 分類<br/>cnn_service.predict(image_path)
            CNN Model-->>Backend: 返回分類結果<br/>{best_class, best_score, mean_score, all_scores}

            Note over Backend: 清理臨時超解析度圖片（如果創建）

            Note over Backend,YOLO Model: 階段 2: 分流邏輯
            Backend->>Backend: 判斷分流邏輯<br/>根據 best_class 決定流程

            alt best_class in ['pepper_bell', 'potato', 'tomato']<br/>（需要執行 YOLO）
                Note over Backend,YOLO Model: 階段 2A: YOLO 檢測流程
                Backend->>YOLO Model: 執行 YOLO 檢測<br/>yolo_detect(model, image_path)
                YOLO Model-->>Backend: 返回檢測結果<br/>{detected, detections: [{class, confidence, bbox}]}

                Note over Backend,Database: 階段 3: 儲存到資料庫
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(id, cnn_result, yolo_result,<br/>final_status: "yolo_detected", ...)
                Database-->>Backend: 返回 prediction_id

                Backend->>Database: 保存檢測記錄<br/>INSERT INTO detection_records<br/>(prediction_log_id, disease, confidence, ...)
                Database-->>Backend: 返回 record_id

                Note over Backend,Cloudinary: 階段 4: 上傳圖片到 Cloudinary
                alt Cloudinary 啟用
                    Backend->>ImageManager: 上傳原始圖片<br/>upload_to_cloudinary(origin/{prediction_id})
                    ImageManager->>Cloudinary: 上傳圖片
                    Cloudinary-->>ImageManager: 返回 secure_url
                    ImageManager-->>Backend: 返回 secure_url

                    Backend->>Database: 更新圖片 URL<br/>UPDATE prediction_log<br/>SET image_path = secure_url,<br/>original_image_url = secure_url
                    Backend->>Database: 更新檢測記錄圖片 URL<br/>UPDATE detection_records<br/>SET original_image_url = secure_url

                    Backend->>YOLO Model: 生成帶檢測框圖片<br/>model.predict().plot(labels=False)
                    YOLO Model-->>Backend: 返回帶框圖片（numpy array）

                    Backend->>ImageManager: 上傳帶框圖片<br/>upload_to_cloudinary(predictions/{prediction_id})
                    ImageManager->>Cloudinary: 上傳帶框圖片
                    Cloudinary-->>ImageManager: 返回 predict_img_url
                    ImageManager-->>Backend: 返回 predict_img_url

                    Backend->>Database: 更新帶框圖片 URL<br/>UPDATE prediction_log<br/>SET predict_img_url = predict_img_url
                    Backend->>Database: 更新檢測記錄帶框圖片 URL<br/>UPDATE detection_records<br/>SET annotated_image_url = predict_img_url
                end

                Backend->>Database: 查詢病害資訊<br/>SELECT * FROM disease_library<br/>WHERE disease_name = ?
                Database-->>Backend: 返回病害詳細資訊

                Backend->>ImageManager: 清理臨時文件<br/>（上下文管理器自動清理）
                ImageManager->>ImageManager: 刪除暫存文件

                Backend->>Redis: 快取檢測結果（1小時）<br/>set(integrated_detection:hash:user_id, result, expire=3600)
                Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
                Backend->>Database: 記錄性能日誌<br/>INSERT INTO performance_logs
                Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs

                Backend-->>Frontend: 200 {cnn_result, yolo_result,<br/>final_status: "yolo_detected",<br/>disease_info, original_image_url,<br/>predict_img_url, processing_time_ms, ...}
                Frontend-->>User: 顯示檢測結果（CNN + YOLO）

            else best_class == 'whole_plant'<br/>（需要裁切）
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, final_status: "need_crop")
                Database-->>Backend: 返回 prediction_id

                Backend->>ImageManager: 清理臨時文件<br/>（上下文管理器自動清理）

                Backend-->>Frontend: 200 {cnn_result,<br/>final_status: "need_crop",<br/>prediction_id, message: "請裁切..."}
                Frontend-->>User: 顯示裁切介面

            else best_class == 'others'<br/>（非植物影像）
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, final_status: "not_plant")
                Backend->>Database: 保存檢測記錄<br/>INSERT INTO detection_records<br/>(disease: "others", ...)
                Database-->>Backend: 返回 prediction_id, record_id

                Backend->>ImageManager: 清理臨時文件<br/>（上下文管理器自動清理）

                Backend-->>Frontend: 200 {cnn_result,<br/>final_status: "not_plant",<br/>error: "非植物影像..."}
                Frontend-->>User: 顯示錯誤訊息
            end
        end
    end
```

---

## 4.1. 裁切後重新檢測流程 (Predict with Crop)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant ImageManager
    participant Database
    participant Cloudinary
    participant SR Model
    participant CNN Model
    participant YOLO Model

    User->>Frontend: 裁切圖片（第 crop_count 次）
    Frontend->>Backend: POST /api/predict-crop<br/>{prediction_id, crop_coordinates,<br/>cropped_image, crop_count}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
    else 已登入
        Backend->>ImageManager: 處理裁切圖片<br/>process_cropped_image(cropped_base64)
        ImageManager-->>Backend: 返回處理後位元組和 image_hash

        Backend->>ImageManager: 創建臨時文件（上下文管理器）<br/>create_temp_file(processed_bytes)
        ImageManager-->>Backend: 返回臨時文件路徑

        Backend->>Database: 更新 prediction_log<br/>UPDATE prediction_log<br/>SET image_path = ?, crop_coordinates = ?<br/>WHERE id = ?
        Database-->>Backend: 更新成功

        Note over Backend,SR Model: 階段 0: 超解析度預處理（可選）
        alt 啟用超解析度
            Backend->>SR Model: 執行超解析度預處理（裁切後圖片）
            SR Model-->>Backend: 返回增強後圖片路徑
        end

        Note over Backend,CNN Model: 階段 1: CNN 分類（裁切後圖片）
        Backend->>CNN Model: 執行 CNN 分類<br/>cnn_service.predict(cropped_image_path)
        CNN Model-->>Backend: 返回分類結果

        Backend->>Backend: 檢查 crop 次數限制<br/>if crop_count >= 3 and best_class == 'whole_plant'

        alt crop_count >= 3 且仍為 'whole_plant'
            Backend->>Backend: 強制設置為 'others'<br/>best_class = 'others', final_status = 'not_plant'
            Backend->>Database: 更新 prediction_log<br/>UPDATE prediction_log<br/>SET cnn_best_class = 'others',<br/>final_status = 'not_plant'
            Backend-->>Frontend: 200 {final_status: "not_plant",<br/>error: "已達到最大裁切次數..."}
            Frontend-->>User: 顯示錯誤訊息
        else best_class == 'whole_plant' 且 crop_count < 3
            Backend-->>Frontend: 200 {final_status: "need_crop",<br/>crop_count, max_crop_count: 3,<br/>message: "請重新裁切..."}
            Frontend-->>User: 顯示裁切介面（提示繼續裁切）
        else best_class in ['pepper_bell', 'potato', 'tomato']
            Note over Backend,YOLO Model: 階段 2: YOLO 檢測
            Backend->>YOLO Model: 執行 YOLO 檢測<br/>yolo_detect(model, cropped_image_path)
            YOLO Model-->>Backend: 返回檢測結果

            Backend->>Database: 更新/創建檢測記錄<br/>UPDATE detection_records<br/>SET disease_name = ?, confidence = ?, ...<br/>WHERE prediction_log_id = ?
            Database-->>Backend: 更新成功

            alt Cloudinary 啟用
                Backend->>ImageManager: 上傳裁切後原始圖片<br/>upload_to_cloudinary(origin/{prediction_id})
                ImageManager->>Cloudinary: 上傳圖片
                Cloudinary-->>Backend: 返回 secure_url

                Backend->>YOLO Model: 生成帶檢測框圖片
                YOLO Model-->>Backend: 返回帶框圖片

                Backend->>ImageManager: 上傳帶框圖片<br/>upload_to_cloudinary(predictions/{prediction_id})
                ImageManager->>Cloudinary: 上傳帶框圖片
                Cloudinary-->>Backend: 返回 predict_img_url

                Backend->>Database: 更新圖片 URL<br/>UPDATE prediction_log<br/>SET original_image_url = secure_url,<br/>predict_img_url = predict_img_url
                Backend->>Database: 更新檢測記錄圖片 URL<br/>UPDATE detection_records<br/>SET original_image_url = secure_url,<br/>annotated_image_url = predict_img_url
            end

            Backend->>Database: 查詢病害資訊
            Database-->>Backend: 返回病害詳細資訊

            Backend->>ImageManager: 清理臨時文件<br/>（上下文管理器自動清理）

            Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs

            Backend-->>Frontend: 200 {cnn_result, yolo_result,<br/>final_status: "yolo_detected",<br/>disease_info, crop_count, ...}
            Frontend-->>User: 顯示檢測結果
        else best_class == 'others'
            Backend->>Database: 更新檢測記錄<br/>UPDATE detection_records<br/>SET disease_name = 'others', ...
            Backend-->>Frontend: 200 {final_status: "not_plant",<br/>error: "非植物影像..."}
            Frontend-->>User: 顯示錯誤訊息
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

    User->>Frontend: 點擊查看歷史記錄<br/>（可選擇分頁、排序、過濾）
    Frontend->>Backend: GET /history<br/>?page=1&per_page=20&order_by=created_at<br/>&order_dir=DESC&disease=Leaf_Spot<br/>&min_confidence=0.8

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤，導向登入頁
    else 已登入
        Backend->>Database: 查詢總記錄數（支持過濾）<br/>SELECT COUNT(*) FROM detection_records<br/>WHERE user_id = ?<br/>AND disease_name ILIKE ?<br/>AND confidence >= ?
        Database-->>Backend: 返回總數

        Backend->>Database: 查詢檢測記錄（支持分頁、排序、過濾）<br/>SELECT id, disease_name, severity, confidence,<br/>image_path, original_image_url, annotated_image_url,<br/>created_at, status, processing_time_ms<br/>FROM detection_records<br/>WHERE user_id = ?<br/>AND disease_name ILIKE ?<br/>AND confidence >= ?<br/>ORDER BY created_at DESC<br/>LIMIT ? OFFSET ?
        Database-->>Backend: 返回記錄列表

        alt 無記錄
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
            Backend-->>Frontend: 200 {records: [], pagination: {...}}
            Frontend-->>User: 顯示"尚無檢測記錄"
        else 有記錄
            loop 對每筆記錄
                alt disease_name 不是 'others' 或 'whole_plant'
                    Backend->>Database: 查詢病害資訊<br/>SELECT * FROM disease_library<br/>WHERE disease_name = ?
                    Database-->>Backend: 返回病害詳細資訊
                    Note over Backend: 使用中文名稱作為顯示名稱
                end
                Backend->>Backend: 格式化記錄<br/>處理圖片 URL（Cloudinary URL）<br/>處理時間戳格式<br/>處理病害顯示名稱
            end

            Backend->>Backend: 計算分頁資訊<br/>total_pages, has_next, has_prev

            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
            Backend-->>Frontend: 200 {records: [{id, disease, disease_name,<br/>severity, confidence, image_path,<br/>original_image_url, annotated_image_url,<br/>disease_info, timestamp, created_at, ...}, ...],<br/>pagination: {page, per_page, total,<br/>total_pages, has_next, has_prev}}
            Frontend-->>User: 顯示歷史記錄列表<br/>（支持分頁、排序、過濾、病害資訊）
        end
    end
```

---

## 5.1. 刪除檢測記錄 (Delete History Record)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 點擊刪除記錄
    Frontend->>Backend: DELETE /history/delete<br/>{record_id: 123}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
    else 已登入
        Backend->>Database: 檢查記錄是否存在且屬於該使用者<br/>SELECT id FROM detection_records<br/>WHERE id = ? AND user_id = ?
        Database-->>Backend: 返回記錄或空

        alt 記錄不存在或無權限
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs (status_code: 400)
            Backend-->>Frontend: 400 {error: "記錄不存在或無權限刪除"}
            Frontend-->>User: 顯示錯誤訊息
        else 記錄存在且屬於該使用者
            Backend->>Database: 刪除記錄<br/>DELETE FROM detection_records<br/>WHERE id = ? AND user_id = ?
            Database-->>Backend: 刪除成功

            Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs<br/>(action_type: 'delete_detection')
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs (status_code: 200)
            Backend-->>Frontend: 200 {status: "記錄已刪除"}
            Frontend-->>User: 顯示成功訊息，更新列表
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
            alt image_path 是 Cloudinary URL<br/>（http:// 或 https://）
                Backend->>Backend: 檢查 URL 格式<br/>image_path.startswith('http')
                Backend-->>Frontend: 302 Redirect<br/>Location: Cloudinary URL
                Frontend->>Cloudinary: 請求圖片（CDN 加速）
                Cloudinary-->>Frontend: 200 image/jpeg<br/>(圖片二進位資料)
                Frontend-->>User: 顯示圖片
            else image_path 是資料庫 URL<br/>（/image/xxx，向後兼容）
                Backend->>Backend: 檢查路徑格式<br/>image_path.startswith('/image/')
                Note over Backend: 圖片應在 Cloudinary，<br/>資料庫 URL 僅用於向後兼容
                Backend-->>Frontend: 404 {error: "圖片未找到，請檢查 Cloudinary 配置"}
                Frontend-->>User: 顯示錯誤或佔位圖
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

## 8. 修改密碼 (Change Password)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 輸入舊密碼和新密碼
    Frontend->>Backend: POST /user/change-password<br/>{old_password, new_password}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
    else 已登入
        Backend->>Database: 查詢使用者密碼<br/>SELECT password_hash FROM users<br/>WHERE id = ?
        Database-->>Backend: 返回 password_hash

        Backend->>Backend: 驗證舊密碼<br/>check_password_hash(password_hash, old_password)

        alt 舊密碼錯誤
            Backend->>Database: 記錄錯誤日誌<br/>INSERT INTO error_logs<br/>(error_type: 'AuthenticationError')
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs (status_code: 400)
            Backend-->>Frontend: 400 {error: "舊密碼不正確"}
            Frontend-->>User: 顯示錯誤訊息
        else 舊密碼正確
            Backend->>Backend: 驗證新密碼複雜度<br/>validate_password(new_password)

            alt 新密碼不符合要求
                Backend-->>Frontend: 400 {error: "密碼不符合要求"}
                Frontend-->>User: 顯示錯誤訊息
            else 新密碼符合要求
                Backend->>Backend: 確認新密碼與舊密碼不同
                alt 新密碼與舊密碼相同
                    Backend-->>Frontend: 400 {error: "新密碼不能與舊密碼相同"}
                    Frontend-->>User: 顯示錯誤訊息
                else 新密碼不同
                    Backend->>Backend: 加密新密碼<br/>generate_password_hash(new_password)
                    Backend->>Database: 更新密碼<br/>UPDATE users<br/>SET password_hash = ?, updated_at = NOW()<br/>WHERE id = ?
                    Database-->>Backend: 更新成功

                    Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs<br/>(action_type: 'password_change')
                    Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs (status_code: 200)
                    Backend-->>Frontend: 200 {status: "密碼已成功更新"}
                    Frontend-->>User: 顯示成功訊息
                end
            end
        end
    end
```

---

## 9. 更新個人資料 (Update Profile)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database

    User->>Frontend: 輸入新的使用者名稱
    Frontend->>Backend: POST /user/update-profile<br/>{username: "newusername"}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
    else 已登入
        Backend->>Database: 檢查使用者名稱是否已被使用<br/>SELECT id FROM users<br/>WHERE username = ? AND id != ?
        Database-->>Backend: 返回記錄或空

        alt 使用者名稱已被使用
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs (status_code: 400)
            Backend-->>Frontend: 400 {error: "該使用者名稱已被使用"}
            Frontend-->>User: 顯示錯誤訊息
        else 使用者名稱可用
            Backend->>Database: 更新使用者資訊<br/>UPDATE users<br/>SET username = ?, updated_at = NOW()<br/>WHERE id = ?
            Database-->>Backend: 更新成功

            Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs<br/>(action_type: 'profile_update')
            Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs (status_code: 200)
            Backend-->>Frontend: 200 {status: "個人資訊已更新"}
            Frontend-->>User: 顯示成功訊息，更新顯示
        end
    end
```

---

## 10. 獲取使用者統計 (User Stats)

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

-   **圖片處理流程**：
    -   使用 `ImageManager` 統一管理圖片處理流程
    -   解碼 Base64 圖片資料
    -   驗證圖片格式和大小（最大 5MB）
    -   Resize 到標準尺寸（640x640）
    -   計算 SHA256 hash（用於檢測重複和快取）
-   **臨時文件管理**：
    -   使用上下文管理器 (`create_temp_file()`) 自動管理臨時文件
    -   臨時文件存儲在 `uploads/` 目錄
    -   檢測完成後自動清理（無需手動刪除）
    -   支持自動清理過期暫存文件（預設 24 小時）
-   **Cloudinary 儲存**（如果啟用）：
    -   原始圖片：`leaf_disease_ai/origin/{prediction_id}.jpg`
    -   帶檢測框圖片：`leaf_disease_ai/predictions/{prediction_id}.jpg`
    -   使用 Cloudinary CDN 加速圖片訪問
-   **資料庫儲存**：
    -   資料庫中只存儲圖片 URL（`original_image_url`, `predict_img_url`, `annotated_image_url`）
    -   不存儲圖片二進位資料（節省資料庫空間）
-   **圖片訪問**：
    -   `/image/{record_id}` - 獲取 detection_records 圖片
    -   `/image/prediction/{prediction_id}` - 獲取 prediction_log 圖片
    -   如果是 Cloudinary URL（http:// 或 https://），會重定向到 Cloudinary
    -   如果是資料庫 URL（/image/xxx），會返回錯誤（圖片應在 Cloudinary）

### AI Model 整合

-   CNN、YOLOv11 和超解析度模型在後端啟動時載入
-   **超解析度預處理**（可選）：
    -   如果啟用，在 CNN 分類前先執行超解析度預處理
    -   使用 EDSR 模型，支持 2x、4x、8x 放大
    -   增強圖片解析度以提高檢測準確度
-   **CNN 分類流程**：
    -   先執行 CNN 分類，獲取圖片類別（pepper_bell, potato, tomato, whole_plant, others）
    -   根據分類結果決定是否執行 YOLO 檢測
-   **YOLO 檢測流程**（僅在特定類別時執行）：
    -   調用 `yolo_detect(model, image_path)` 進行檢測
    -   使用 `model.predict().plot(labels=False)` 生成帶檢測框的圖片（不包含文字標籤）
    -   預測結果包含：病害名稱、置信度、邊界框等資訊
-   **整合檢測服務** (`IntegratedDetectionService`) 統一管理整個流程
-   **裁切流程**：
    -   如果 CNN 分類為 `whole_plant`，提示使用者裁切
    -   支持最多 3 次裁切嘗試
    -   第 3 次裁切後仍為 `whole_plant` 時，強制設置為 `others`

### Cloudinary 圖片存儲

-   **配置**：
    -   通過環境變數 `USE_CLOUDINARY` 控制是否啟用
    -   需要配置 `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
-   **上傳流程**：
    -   原始圖片在檢測完成後上傳到 `leaf_disease_ai/origin/{prediction_id}.jpg`
    -   帶檢測框圖片在 YOLO 檢測完成後上傳到 `leaf_disease_ai/predictions/{prediction_id}.jpg`
    -   上傳失敗不會中斷檢測流程（記錄警告日誌）
-   **圖片組織結構**：
    -   `leaf_disease_ai/origin/{prediction_id}.jpg` - 原始圖片
    -   `leaf_disease_ai/predictions/{prediction_id}.jpg` - 帶檢測框的圖片
-   **資料庫儲存**：
    -   資料庫中只存儲 Cloudinary URL，不存儲圖片二進位資料
    -   `image_path`, `original_image_url`, `predict_img_url`, `annotated_image_url` 欄位存儲 Cloudinary URL
-   **圖片訪問**：
    -   通過 Cloudinary URL 直接訪問（CDN 加速）
    -   後端會重定向（302）到 Cloudinary URL
    -   如果 Cloudinary 未啟用，則使用本地文件系統（向後兼容，但建議啟用 Cloudinary）

### 歷史記錄查詢功能

-   **分頁支持**：
    -   使用 `page` 和 `per_page` 參數控制分頁
    -   每頁最多 100 筆記錄
    -   返回總記錄數和總頁數
-   **排序支持**：
    -   使用 `order_by` 參數指定排序欄位（created_at, confidence, disease_name, severity）
    -   使用 `order_dir` 參數指定排序方向（ASC, DESC）
-   **過濾支持**：
    -   使用 `disease` 參數過濾病害名稱（不區分大小寫，支持部分匹配）
    -   使用 `min_confidence` 參數過濾最小置信度
-   **病害資訊查詢**：
    -   對每筆記錄自動查詢 `disease_library` 表獲取病害詳細資訊
    -   如果找到中文名稱，使用中文名稱作為顯示名稱
    -   返回完整的病害資訊（包含病因、症狀、防治措施等）
