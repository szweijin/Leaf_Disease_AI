# 資料庫檔案說明

本目錄包含所有資料庫相關的 SQL 腳本和文檔。

## 📁 檔案結構

### 核心初始化腳本

1. **`init_database.sql`** - 完整資料庫初始化腳本（**主要腳本**）
   - 創建所有表結構
   - 創建索引
   - 創建外鍵約束
   - **已包含圖片存儲欄位**（image_data, image_data_size, image_compressed）
   - **已包含視圖**（user_statistics, error_statistics, api_performance_stats）
   - **已包含函數**（has_permission, log_activity, update_timestamp）
   - **已包含觸發器**（自動更新時間戳）
   - 適用於：全新安裝（**只需執行此一個腳本即可**）


### 文檔

2. **`SQL_REFERENCE.md`** - SQL 語句參考文檔
   - 記錄所有 SQL 語句的使用場景
   - 按模組分類

3. **`README.md`** - 本檔案
   - 資料庫檔案說明和使用指南

## 🚀 使用方式

### 全新安裝

```bash
# 方式一：使用 Python 腳本（推薦）
python scripts/init_database.py

# 方式二：手動執行（只需一個腳本）
psql -U postgres -d leaf_disease_ai -f database/init_database.sql
```

**注意**：`init_database.sql` 已包含所有內容（表結構、視圖、函數、觸發器、圖片存儲功能），無需執行其他腳本。

### 重置資料庫

```bash
# 刪除並重新創建資料庫
python scripts/reset_database.py
```

### 升級現有資料庫

如果需要升級現有資料庫，建議：
1. 備份現有資料庫
2. 執行 `init_database.sql`（會自動處理已存在的對象）
3. 或手動執行需要的 SQL 語句（參考 `SQL_REFERENCE.md`）

**注意**：新安裝的資料庫已包含所有功能，無需執行額外的遷移腳本。

## 📊 資料庫表結構

### 核心表

- **users** - 用戶表
- **detection_records** - 檢測記錄表（包含圖片存儲欄位）
- **disease_library** - 病害資料庫
- **sessions** - 會話表
- **roles** - 角色表

### 日誌表

- **activity_logs** - 活動日誌
- **error_logs** - 錯誤日誌
- **api_logs** - API 日誌
- **performance_logs** - 性能日誌
- **audit_logs** - 審計日誌

### 視圖

- **user_statistics** - 用戶統計視圖
- **error_statistics** - 錯誤統計視圖
- **api_performance_stats** - API 性能統計視圖

## 🔍 detection_records 表欄位說明

### 基本欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | INTEGER | 主鍵 |
| user_id | INTEGER | 用戶 ID（外鍵） |
| disease_name | VARCHAR(255) | 病害名稱 |
| severity | VARCHAR(50) | 嚴重程度 |
| confidence | NUMERIC(5,4) | 置信度 (0-1) |
| image_path | VARCHAR(500) | 圖片文件路徑 |
| image_hash | VARCHAR(64) | 圖片 SHA256 hash |
| image_size | INTEGER | 圖片大小（位元組） |
| image_source | VARCHAR(20) | 圖片來源（upload/camera/gallery） |
| image_resized | BOOLEAN | 是否已 resize |
| raw_model_output | JSONB | 原始模型輸出 |
| notes | TEXT | 備註 |
| status | VARCHAR(20) | 狀態（completed/processing/failed/duplicate/unrecognized） |
| processing_time_ms | INTEGER | 處理時間（毫秒） |
| created_at | TIMESTAMP | 創建時間 |
| updated_at | TIMESTAMP | 更新時間 |

### 圖片存儲欄位（新增）

| 欄位 | 類型 | 說明 |
|------|------|------|
| image_data | BYTEA | 壓縮後的圖片二進位資料（JPEG 格式，品質 75） |
| image_data_size | INTEGER | 壓縮後圖片的大小（位元組） |
| image_compressed | BOOLEAN | 是否已將圖片壓縮存儲在資料庫中 |

## 📝 注意事項

1. **執行順序**：
   - **新安裝**：只需執行 `init_database.sql`（已包含所有內容）
   - **升級現有資料庫**：執行 `init_database.sql`（會自動處理已存在的對象）

2. **圖片存儲**：
   - 新安裝的資料庫已包含圖片存儲欄位
   - 現有資料庫可以執行 `init_database.sql` 來添加缺失的功能

3. **備份**：
   - 執行任何 SQL 腳本前，建議先備份資料庫
   - 重置資料庫會刪除所有資料

4. **環境變數**：
   - 確保 `.env` 檔案中配置了正確的資料庫連接資訊
   - 包括：DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

## 🔧 維護

### 檢查資料庫結構

```bash
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv()
import psycopg2

conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT')),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)
cursor = conn.cursor()
cursor.execute(\"\"\"
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'detection_records'
    ORDER BY ordinal_position
\"\"\")
for col in cursor.fetchall():
    print(f'{col[0]}: {col[1]}')
"
```

### 驗證圖片存儲欄位

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'detection_records' 
AND column_name IN ('image_data', 'image_data_size', 'image_compressed');
```

## 📚 相關文檔

- [SQL_REFERENCE.md](./SQL_REFERENCE.md) - SQL 語句參考
- [../README.md](../README.md) - 專案主文檔
- [../scripts/init_database.py](../scripts/init_database.py) - 初始化腳本
- [../scripts/reset_database.py](../scripts/reset_database.py) - 重置腳本

