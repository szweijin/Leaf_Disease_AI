# SQL 語句參考文檔

本文檔記錄專案中所有使用的 SQL 語句，作為開發和維護的參考。

## 目錄
1. [使用者相關 SQL](#使用者相關-sql)
2. [檢測記錄相關 SQL](#檢測記錄相關-sql)
3. [日誌相關 SQL](#日誌相關-sql)
4. [病害資訊相關 SQL](#病害資訊相關-sql)

---

## 使用者相關 SQL

### 查詢使用者
```sql
-- 檢查郵箱是否存在
SELECT id FROM users WHERE email = %s;

-- 登入時查詢使用者
SELECT id, password_hash, is_active, role_id FROM users WHERE email = %s;

-- 獲取使用者資訊
SELECT u.id, u.email, u.full_name, u.username, r.role_name,
       u.created_at, u.last_login, u.login_count, u.is_active
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.id = %s;

-- 查詢使用者角色
SELECT role_id FROM users WHERE id = %s;
```

### 插入使用者
```sql
-- 註冊新使用者
INSERT INTO users (email, password_hash, full_name, role_id, created_at)
VALUES (%s, %s, %s, 1, NOW())
RETURNING id;
```

### 更新使用者
```sql
-- 更新最後登入時間
UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = %s;

-- 更新密碼
UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s;

-- 更新使用者資訊
UPDATE users SET {fields}, updated_at = NOW() WHERE id = %s;

-- 更新使用者角色
UPDATE users SET role_id = %s, updated_at = NOW() WHERE id = %s;

-- 停用使用者
UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = %s;
```

---

## 檢測記錄相關 SQL

### 查詢檢測記錄
```sql
-- 檢查重複圖片
SELECT id, disease_name, confidence 
FROM detection_records 
WHERE image_hash = %s AND user_id = %s;

-- 獲取使用者檢測歷史
SELECT id, disease_name, severity, confidence, image_path,
       created_at, status, processing_time_ms, image_compressed
FROM detection_records
WHERE user_id = %s
ORDER BY created_at DESC
LIMIT %s;

-- 獲取病害統計
SELECT disease_name, COUNT(*) as count
FROM detection_records
WHERE user_id = %s
GROUP BY disease_name
ORDER BY count DESC;

-- 獲取嚴重程度分佈
SELECT severity, COUNT(*) as count
FROM detection_records
WHERE user_id = %s
GROUP BY severity;
```

### 插入檢測記錄
```sql
-- 儲存檢測記錄（基本版本，不含圖片存儲）
INSERT INTO detection_records
(user_id, disease_name, severity, confidence, image_path, image_hash,
 image_size, image_source, image_resized, raw_model_output, status,
 processing_time_ms, image_data, image_data_size, image_compressed, created_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
RETURNING id;

-- 儲存檢測記錄（含壓縮圖片）
INSERT INTO detection_records
(user_id, disease_name, severity, confidence, image_path, image_hash,
 image_size, image_source, image_resized, raw_model_output, status,
 processing_time_ms, image_data, image_data_size, image_compressed, created_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, NOW())
RETURNING id;

-- 從資料庫獲取圖片
SELECT image_data, image_compressed 
FROM detection_records 
WHERE id = %s AND user_id = %s AND image_compressed = TRUE;
```

---

## 日誌相關 SQL

### 活動日誌
```sql
-- 記錄使用者活動
INSERT INTO activity_logs 
(user_id, action_type, resource_type, resource_id, action_details, ip_address, user_agent, created_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, NOW());

-- 查詢活動日誌
SELECT al.id, u.email, al.action_type, al.resource_type,
       al.action_details, al.ip_address, al.created_at
FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.created_at >= NOW() - INTERVAL '%s days'
ORDER BY al.created_at DESC;
```

### 錯誤日誌
```sql
-- 記錄錯誤
INSERT INTO error_logs 
(user_id, error_type, error_message, error_code, severity, context, error_traceback, endpoint, created_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW());

-- 查詢錯誤日誌
SELECT id, error_type, error_message, severity, endpoint,
       created_at, error_traceback
FROM error_logs
ORDER BY created_at DESC
LIMIT %s;
```

### API 日誌
```sql
-- 記錄 API 請求
INSERT INTO api_logs 
(user_id, endpoint, method, status_code, execution_time_ms, ip_address, user_agent, 
 error_message, request_body_size, response_body_size, created_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW());
```

### 性能日誌
```sql
-- 記錄性能指標
INSERT INTO performance_logs 
(operation_name, execution_time_ms, memory_used_mb, cpu_percentage, status, details, created_at)
VALUES (%s, %s, %s, %s, %s, %s, NOW());
```

---

## 病害資訊相關 SQL

### 查詢病害資訊
```sql
-- 從病害庫獲取資訊
SELECT chinese_name, causes, features, pesticides, management_measures
FROM disease_library
WHERE disease_name = %s AND is_active = TRUE;
```

---

## 會話相關 SQL

### 會話管理
```sql
-- 創建會話
INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at, is_active)
VALUES (%s, %s, %s, %s, %s, TRUE);

-- 登出（停用會話）
UPDATE sessions SET is_active = FALSE WHERE user_id = %s AND session_token = %s;

-- 停用使用者所有會話
UPDATE sessions SET is_active = FALSE WHERE user_id = %s;
```

---

## 圖片存儲相關 SQL

### 圖片存儲欄位說明
`detection_records` 表包含以下圖片存儲欄位：
- `image_data` (BYTEA): 壓縮後的圖片二進位資料（JPEG 格式，品質 75）
- `image_data_size` (INTEGER): 壓縮後圖片的大小（位元組）
- `image_compressed` (BOOLEAN): 是否已將圖片壓縮存儲在資料庫中

### 查詢圖片
```sql
-- 從資料庫獲取壓縮存儲的圖片
SELECT image_data, image_data_size, image_compressed
FROM detection_records
WHERE id = %s AND user_id = %s AND image_compressed = TRUE;

-- 檢查是否有壓縮存儲的圖片
SELECT id, image_path, image_compressed
FROM detection_records
WHERE user_id = %s AND image_compressed = TRUE;
```

### 更新圖片存儲狀態
```sql
-- 標記圖片已壓縮存儲
UPDATE detection_records
SET image_compressed = TRUE, image_data_size = %s
WHERE id = %s;
```

---

## 注意事項

1. **所有 SQL 語句都使用參數化查詢**，避免 SQL 注入攻擊
2. **表結構定義**請參考 `init_database.sql`（已包含圖片存儲欄位）
3. **外鍵約束**：
   - `users.role_id` → `roles.id`
   - `detection_records.user_id` → `users.id`
   - `sessions.user_id` → `users.id`
   - `activity_logs.user_id` → `users.id`
4. **索引**：主要查詢欄位都已建立索引，包括 `idx_records_compressed`
5. **錯誤處理**：所有資料庫操作都應該有適當的錯誤處理和日誌記錄
6. **圖片存儲**：
   - 新安裝的資料庫已包含圖片存儲欄位
   - 現有資料庫可以執行 `init_database.sql` 來添加缺失的功能

---

## 資料庫初始化

執行以下命令初始化資料庫：
```bash
python database/database_manager.py init
```

或手動執行 SQL：
```bash
psql -U postgres -d leaf_disease_ai -f database/init_database.sql
```

