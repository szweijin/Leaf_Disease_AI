# Leaf Disease AI - Sequence Diagrams

本文檔使用 Mermaid 格式描述系統的主要流程序列圖。

## 角色說明

-   **User**: 使用者
-   **Frontend**: React 前端應用
-   **Backend**: Flask 後端服務
-   **Database**: PostgreSQL 資料庫
-   **AI Model**: YOLOv11 病害檢測模型
-   **Redis**: Redis 快取服務（可選）

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

    Backend->>Database: 檢查 email 是否已存在<br/>SELECT * FROM users WHERE email = ?

    alt Email 已存在
        Database-->>Backend: 返回已存在記錄
        Backend-->>Frontend: 400 {error: "Email 已被註冊"}
        Frontend-->>User: 顯示錯誤訊息
    else Email 不存在
        Database-->>Backend: 返回空結果
        Backend->>Backend: 使用 generate_password_hash 加密密碼
        Backend->>Database: INSERT INTO users<br/>(email, password_hash, ...)
        Database-->>Backend: 返回新用戶 ID
        Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
        Backend->>Backend: 記錄 API 請求日誌
        Backend-->>Frontend: 200 {status: "註冊成功"}
        Frontend-->>User: 顯示成功訊息，切換到登入頁面
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
            Backend->>Database: 記錄錯誤日誌<br/>INSERT INTO error_logs
            Backend-->>Frontend: 401 {error: "帳號或密碼錯誤"}
            Frontend-->>User: 顯示錯誤訊息
        else 用戶存在且啟用
            Database-->>Backend: 返回用戶資料（含 password_hash）
            Backend->>Backend: 驗證密碼<br/>check_password_hash(password_hash, password)

            alt 密碼錯誤
                Backend->>Redis: 增加失敗嘗試次數<br/>set(login_attempts:email, attempts+1, expire=300)
                Backend->>Database: 記錄錯誤日誌<br/>INSERT INTO error_logs
                Backend-->>Frontend: 401 {error: "帳號或密碼錯誤"}
                Frontend-->>User: 顯示錯誤訊息
            else 密碼正確
                Backend->>Database: 更新登入資訊<br/>UPDATE users SET last_login = NOW(),<br/>login_count = login_count + 1
                Backend->>Backend: 生成 session_token<br/>secrets.token_urlsafe(32)
                Backend->>Database: 創建 session<br/>INSERT INTO sessions<br/>(user_id, session_token, ip_address, ...)
                Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
                Backend->>Redis: 清除登入嘗試記錄<br/>delete(login_attempt_key)
                Backend->>Backend: 設置 Flask session<br/>session["user_id"] = user_id<br/>session["email"] = email
                Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
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
    participant Redis
    participant Database
    participant CNN Model
    participant YOLO Model

    User->>Frontend: 上傳圖片（Base64）或拍攝
    Frontend->>Backend: POST /api/predict<br/>{image: base64, source: "upload"}

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤，導向登入頁
    else 已登入
        Backend->>Backend: Base64 解碼圖片<br/>base64.b64decode(encoded)
        Backend->>Backend: 處理圖片（調整大小、計算 hash）<br/>ImageService.process_image()

        Backend->>Redis: 檢查快取<br/>get(integrated_detection:hash:user_id)

        alt 快取命中
            Redis-->>Backend: 返回快取結果
            Backend->>Database: 記錄 API 請求日誌
            Backend-->>Frontend: 200 {cnn_result, yolo_result, final_status, ...}
            Frontend-->>User: 顯示檢測結果（從快取）
        else 快取未命中
            Redis-->>Backend: 返回 null
            Backend->>Backend: 保存圖片到暫存<br/>ImageService.save_image()<br/>uploads/{uuid}.jpg

            Backend->>CNN Model: 執行 CNN 分類<br/>cnn_model(image_path)
            CNN Model-->>Backend: 返回分類結果<br/>{best_class, best_score, mean_score, all_scores}

            Backend->>Backend: 判斷分流邏輯<br/>根據 best_class 決定流程

            alt best_class in ['pepper_bell', 'potato', 'tomato']
                Backend->>YOLO Model: 執行 YOLO 檢測<br/>yolo_model(image_path)
                YOLO Model-->>Backend: 返回檢測結果<br/>{boxes, classes, confidences}
                
                Backend->>Backend: 處理 YOLO 結果<br/>收集所有檢測到的病害
                Backend->>Database: 查詢病害資訊<br/>SELECT * FROM disease_library
                Database-->>Backend: 返回病害詳細資訊
                
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, yolo_result, final_status)
                Backend->>Database: 保存檢測記錄<br/>INSERT INTO detection_records<br/>(prediction_log_id, ...)
                Database-->>Backend: 返回 prediction_id, record_id
                
                Backend->>Redis: 快取檢測結果（1小時）<br/>set(integrated_detection:hash:user_id, result, expire=3600)
                Backend->>Database: 記錄活動日誌<br/>INSERT INTO activity_logs
                Backend->>Database: 記錄 API 請求日誌<br/>INSERT INTO api_logs
                
                Backend-->>Frontend: 200 {cnn_result, yolo_result,<br/>final_status: "yolo_detected", ...}
                Frontend-->>User: 顯示檢測結果（CNN + YOLO）
                
            else best_class == 'whole_plant'
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, final_status: "need_crop")
                Database-->>Backend: 返回 prediction_id
                
                Backend-->>Frontend: 200 {cnn_result,<br/>final_status: "need_crop",<br/>message: "請裁切..."}
                Frontend-->>User: 顯示裁切介面
                
                User->>Frontend: 裁切圖片
                Frontend->>Backend: POST /api/predict-crop<br/>{prediction_id, crop_coordinates, cropped_image}
                Backend->>Backend: 使用裁切圖片重新執行流程
                Note over Backend: 重新執行 CNN + YOLO 流程
                
            else best_class == 'others'
                Backend->>Database: 保存預測記錄<br/>INSERT INTO prediction_log<br/>(cnn_result, final_status: "not_plant")
                Database-->>Backend: 返回 prediction_id
                
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
    Frontend->>Backend: GET /history

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤，導向登入頁
    else 已登入
        Backend->>Database: 查詢檢測記錄<br/>SELECT * FROM detection_records<br/>WHERE user_id = ?<br/>ORDER BY created_at DESC<br/>LIMIT 100
        Database-->>Backend: 返回記錄列表

        alt 無記錄
            Backend->>Database: 記錄 API 請求日誌
            Backend-->>Frontend: 200 []
            Frontend-->>User: 顯示"尚無檢測記錄"
        else 有記錄
            Backend->>Backend: 格式化記錄<br/>處理圖片路徑（/image/{id} 或 /uploads/...）
            Backend->>Database: 記錄 API 請求日誌
            Backend-->>Frontend: 200 [{id, disease, severity,<br/>confidence, image_path,<br/>timestamp, ...}, ...]
            Frontend-->>User: 顯示歷史記錄列表
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

    User->>Frontend: 查看歷史記錄中的圖片
    Frontend->>Backend: GET /image/{record_id}

    Backend->>Database: 查詢圖片資料<br/>SELECT image_data, image_compressed<br/>FROM detection_records<br/>WHERE id = ?
    Database-->>Backend: 返回圖片資料（BYTEA）

    alt 圖片存在
        Backend->>Backend: Base64 編碼圖片<br/>base64.b64encode(image_data)
        Backend-->>Frontend: 200 image/jpeg<br/>(圖片二進位資料)
        Frontend-->>User: 顯示圖片
    else 圖片不存在
        Backend-->>Frontend: 404 {error: "圖片不存在"}
        Frontend-->>User: 顯示錯誤或佔位圖
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
    participant Redis
    participant Database

    User->>Frontend: 查看個人統計
    Frontend->>Backend: GET /user/stats

    Backend->>Backend: 檢查 session<br/>get_user_id_from_session()

    alt 未登入
        Backend-->>Frontend: 401 {error: "請先登入"}
        Frontend-->>User: 顯示錯誤
    else 已登入
        Backend->>Redis: 檢查快取<br/>get(user_stats:{user_id})

        alt 快取命中
            Redis-->>Backend: 返回快取統計資料
            Backend-->>Frontend: 200 {total_detections, ...}
            Frontend-->>User: 顯示統計資料（從快取）
        else 快取未命中
            Redis-->>Backend: 返回 null
            Backend->>Database: 查詢統計資料<br/>SELECT COUNT(*), ...<br/>FROM detection_records<br/>WHERE user_id = ?
            Database-->>Backend: 返回統計結果

            Backend->>Redis: 快取統計資料（5分鐘）<br/>set(user_stats:{user_id}, stats, expire=300)
            Backend-->>Frontend: 200 {total_detections, ...}
            Frontend-->>User: 顯示統計資料
        end
    end
```

---

## 注意事項

### Redis 快取策略

1. **登入嘗試限制**: `login_attempts:{email}` - 5 分鐘過期
2. **檢測結果快取**: `detection_result:{image_hash}:{user_id}` - 1 小時過期
3. **使用者統計快取**: `user_stats:{user_id}` - 5 分鐘過期

### 錯誤處理

-   所有 API 請求都會記錄到 `api_logs` 表
-   認證錯誤會記錄到 `error_logs` 表
-   使用者活動會記錄到 `activity_logs` 表

### 圖片存儲

-   上傳的圖片會先暫存到 `uploads/` 目錄
-   檢測完成後，壓縮圖片會存儲到資料庫的 `detection_records.image_data` (BYTEA)
-   原始暫存檔案會在成功存儲後自動刪除
-   圖片可通過 `/image/{record_id}` 端點從資料庫讀取

### AI Model 整合

-   YOLOv11 模型在後端啟動時載入
-   每次檢測都會調用 `model(image_path)` 進行預測
-   預測結果包含：病害名稱、置信度、邊界框等資訊
