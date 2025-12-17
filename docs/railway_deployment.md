# Railway 部署指南

本文件詳細說明如何在 Railway 平台上部署 Leaf Disease AI 專案。

## 目錄

-   [前置需求](#前置需求)
-   [部署步驟](#部署步驟)
-   [環境變數配置](#環境變數配置)
-   [資料庫設置](#資料庫設置)
-   [Redis 設置](#redis-設置)
-   [模型文件部署](#模型文件部署)
-   [故障排除](#故障排除)

## 前置需求

1. **Railway 帳號**：前往 [Railway](https://railway.app) 註冊帳號
2. **GitHub 帳號**：將專案推送到 GitHub（Railway 支援從 GitHub 部署）
3. **Cloudinary 帳號**：用於圖片儲存（可選，但強烈建議）

## 部署步驟

### 1. 準備專案

確保專案已推送到 GitHub：

```bash
git add .
git commit -m "準備 Railway 部署"
git push origin main
```

### 2. 在 Railway 創建新專案

1. 登入 [Railway Dashboard](https://railway.app/dashboard)
2. 點擊 **"New Project"**
3. 選擇 **"Deploy from GitHub repo"**
4. 選擇您的專案倉庫
5. Railway 會自動檢測專案類型並開始部署

### 3. 添加資料庫服務

1. 在專案中點擊 **"+ New"**
2. 選擇 **"Database"** → **"Add PostgreSQL"**
3. Railway 會自動創建 PostgreSQL 資料庫並提供連接資訊

### 4. 添加 Redis 服務（可選）

1. 在專案中點擊 **"+ New"**
2. 選擇 **"Database"** → **"Add Redis"**
3. Railway 會自動創建 Redis 實例並提供連接資訊

### 5. 配置環境變數

在 Railway 專案設置中，進入 **"Variables"** 標籤，添加以下環境變數：

#### 必要環境變數

```bash
# 應用環境
FLASK_ENV=production
ENVIRONMENT=production

# 應用配置
SECRET_KEY=<生成一個強隨機字串，至少 32 字元>
DEBUG=false

# 資料庫配置（Railway 會自動提供，但需要手動添加）
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}

# Redis 配置（如果添加了 Redis 服務）
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
REDIS_DB=0

# Cloudinary 配置（強烈建議）
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_SECURE=true
CLOUDINARY_FOLDER=leaf_disease_ai

# CORS 配置（生產環境）
CORS_ORIGINS=https://your-domain.railway.app,https://www.your-domain.com
```

#### 可選環境變數

```bash
# AI 模型路徑（預設路徑，如需更改請確保模型文件存在於映像中）
CNN_MODEL_PATH_RELATIVE=model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
YOLO_MODEL_PATH_RELATIVE=model/yolov11/YOLOv11_v1_20251212/weights/best.pt
SR_MODEL_PATH_RELATIVE=model/SR/model_pytorch/EDSR_x2.pt
SR_MODEL_TYPE=edsr
SR_SCALE=2
ENABLE_SR=true

# 上傳配置
MAX_CONTENT_LENGTH=5242880  # 5MB
UPLOAD_FOLDER_RELATIVE=uploads

# 會話配置
PERMANENT_SESSION_LIFETIME_HOURS=24
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax

# Swagger 配置
SWAGGER_TITLE=Leaf Disease AI API
SWAGGER_DESCRIPTION=葉片病害檢測 AI 系統 API 文檔
SWAGGER_VERSION=2.0.0
SWAGGER_SCHEMES=https
```

### 6. 生成 SECRET_KEY

在本地終端執行：

```bash
# 方法一：使用 openssl（推薦）
openssl rand -hex 32

# 方法二：使用 Python
python -c "import secrets; print(secrets.token_hex(32))"
```

將生成的結果複製到 Railway 環境變數中的 `SECRET_KEY`。

### 7. 初始化資料庫

部署完成後，需要初始化資料庫：

1. 在 Railway 專案中，點擊 PostgreSQL 服務
2. 進入 **"Connect"** 標籤
3. 複製連接字串
4. 使用 Railway CLI 或本地 psql 連接資料庫
5. 執行初始化腳本：

```bash
# 使用 Railway CLI
railway connect postgres

# 或使用本地 psql（需要先安裝 Railway CLI）
psql $DATABASE_URL -f database/init_database.sql
```

或者，您可以在 Railway 的 PostgreSQL 服務中添加一個初始化腳本，在首次部署時自動執行。

### 8. 部署模型文件

模型文件很大（通常數百 MB），有幾種處理方式：

#### 方式一：使用 Railway 持久化存儲（推薦）

1. 在 Railway 專案中添加 **"Volume"** 服務
2. 將模型文件上傳到 Volume
3. 在環境變數中配置模型路徑指向 Volume

#### 方式二：使用外部存儲（推薦）

1. 將模型文件上傳到雲端存儲（如 AWS S3、Google Cloud Storage）
2. 在應用啟動時下載模型文件
3. 或使用環境變數配置模型 URL

#### 方式三：包含在 Git 倉庫（不推薦）

如果模型文件較小，可以直接包含在 Git 倉庫中，但這會增加倉庫大小。

**注意**：確保 `.railwayignore` 文件中沒有排除 `model/` 目錄（如果需要包含模型文件）。

### 9. 設置自定義域名（可選）

1. 在 Railway 專案設置中，進入 **"Settings"** → **"Networking"**
2. 點擊 **"Generate Domain"** 生成 Railway 域名
3. 或添加自定義域名：
    - 點擊 **"Custom Domain"**
    - 輸入您的域名
    - 按照指示配置 DNS 記錄

### 10. 監控和日誌

Railway 提供內建的監控和日誌功能：

1. 在專案中點擊服務
2. 查看 **"Metrics"** 標籤了解資源使用情況
3. 查看 **"Logs"** 標籤查看應用日誌

## 環境變數配置

### Railway 環境變數引用

Railway 支援使用 `${{Service.Variable}}` 語法引用其他服務的環境變數：

-   `${{Postgres.PGHOST}}` - PostgreSQL 主機
-   `${{Postgres.PGPORT}}` - PostgreSQL 端口
-   `${{Postgres.PGDATABASE}}` - 資料庫名稱
-   `${{Postgres.PGUSER}}` - 資料庫用戶
-   `${{Postgres.PGPASSWORD}}` - 資料庫密碼
-   `${{Redis.REDIS_HOST}}` - Redis 主機
-   `${{Redis.REDIS_PORT}}` - Redis 端口
-   `${{Redis.REDIS_PASSWORD}}` - Redis 密碼

### 環境變數優先級

Railway 環境變數會覆蓋 `.env` 文件中的設定，這確保了生產環境配置的正確性。

## 資料庫設置

### 自動初始化（推薦）

創建一個初始化腳本，在首次部署時自動執行：

1. 專案已包含 `railway-init.sh`（包含錯誤處理和狀態檢查）：

```bash
#!/bin/bash
# Railway 資料庫初始化腳本

set +e  # 不因錯誤而退出，允許繼續執行

echo "🔍 檢查資料庫連接..."

# 等待資料庫就緒
sleep 5

# 檢查 DATABASE_URL 是否存在
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  警告: DATABASE_URL 未設置，跳過資料庫初始化"
    exit 0
fi

# 檢查 psql 是否可用
if ! command -v psql &> /dev/null; then
    echo "⚠️  警告: psql 命令不可用，跳過資料庫初始化"
    exit 0
fi

# 檢查資料庫是否已初始化（檢查 users 表是否存在）
TABLE_EXISTS=$(psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');" 2>/dev/null)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ 資料庫已初始化，跳過初始化步驟"
    exit 0
fi

# 執行初始化 SQL
echo "📦 正在初始化資料庫..."
if psql $DATABASE_URL -f database/init_database.sql; then
    echo "✅ 資料庫初始化完成！"
else
    echo "⚠️  資料庫初始化失敗，但繼續啟動應用程式"
fi
```

2. 在 `railway.json` 中配置（已包含在專案中）：

```json
{
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
        "builder": "DOCKERFILE",
        "dockerfilePath": "Dockerfile"
    },
    "deploy": {
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
    }
}
```

**注意**：

-   專案使用 **Dockerfile** 進行多階段構建，確保同時安裝 Node.js 和 Python
-   `Dockerfile` 會自動構建前端、安裝 Python 依賴，並優化映像大小
-   `start.sh` 啟動腳本會自動執行資料庫初始化並啟動 Gunicorn
-   `railway-init.sh` 會自動檢查資料庫狀態，避免重複初始化
-   Gunicorn 配置了日誌輸出到標準輸出（Railway 會自動捕獲）

### 手動初始化

如果自動初始化失敗，可以手動執行：

1. 使用 Railway CLI：

```bash
railway connect postgres
psql -f database/init_database.sql
```

2. 或使用本地 psql（需要先獲取連接字串）：

```bash
psql $DATABASE_URL -f database/init_database.sql
```

## Redis 設置

Redis 是可選的，但強烈建議使用以提升性能：

1. 添加 Redis 服務後，Railway 會自動提供連接資訊
2. 在環境變數中使用 `${{Redis.REDIS_HOST}}` 等引用
3. 如果 Redis 不可用，應用會自動降級到記憶體快取

## 模型文件部署

### 推薦方式：使用 Railway Volume

1. 在 Railway 專案中添加 **"Volume"** 服務
2. 將模型文件上傳到 Volume：

```bash
# 使用 Railway CLI
railway volume create model-storage
railway volume mount model-storage /app/model
```

3. 在環境變數中配置模型路徑：

```bash
CNN_MODEL_PATH_RELATIVE=/app/model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
YOLO_MODEL_PATH_RELATIVE=/app/model/yolov11/YOLOv11_v1_20251212/weights/best.pt
```

**注意**：Dockerfile 已包含預設模型文件，如果使用 Volume 或外部存儲，請確保路徑正確。

### 替代方式：使用外部存儲

1. 將模型文件上傳到雲端存儲（AWS S3、Google Cloud Storage 等）
2. 在應用啟動時下載模型文件
3. 或使用環境變數配置模型 URL

## Dockerfile 構建說明

專案使用 **Dockerfile** 進行多階段構建，優化構建速度和映像大小：

### 構建階段

1. **前端構建階段**：

    - 使用 Node.js 20 Alpine 構建前端
    - 安裝依賴並構建 React 應用
    - 清理構建時不需要的文件

2. **後端構建階段**：
    - 使用 Python 3.11 Slim 基礎映像
    - 分階段安裝 Python 依賴（利用構建緩存）
    - 使用 CPU 版本的 PyTorch（更小更快）
    - 只複製必要的模型文件

### 構建優化

-   ✅ **多階段構建**：減少最終映像大小
-   ✅ **CPU 版 PyTorch**：使用 `--index-url https://download.pytorch.org/whl/cpu`
-   ✅ **分階段安裝**：先安裝輕量級依賴，再安裝重依賴
-   ✅ **模型文件優化**：只包含預設使用的模型文件
-   ✅ **構建緩存**：優化 Docker 層緩存以加快構建速度

### 啟動流程

1. `start.sh` 啟動腳本執行
2. `railway-init.sh` 初始化資料庫（如果尚未初始化）
3. 啟動 Gunicorn WSGI 服務器

## 故障排除

### 部署失敗

1. **檢查構建日誌**：

    - 在 Railway 專案中查看 **"Deployments"** 標籤
    - 點擊失敗的部署查看詳細日誌
    - 檢查 Dockerfile 構建是否超時（通常需要 2-3 分鐘）

2. **檢查環境變數**：

    - 確保所有必要的環境變數都已設置
    - 檢查環境變數名稱是否正確（區分大小寫）
    - 確認模型路徑環境變數與 Dockerfile 中複製的模型文件一致

3. **檢查依賴**：
    - 確保 `requirements.txt` 包含所有必要的依賴
    - 檢查 Python 版本是否兼容（Python 3.11）
    - 確認 PyTorch CPU 版本安裝成功

### 應用無法啟動

1. **檢查日誌**：

    - 在 Railway 專案中查看 **"Logs"** 標籤
    - 查找錯誤訊息
    - 確認 `start.sh` 腳本是否正確執行

2. **檢查資料庫連接**：

    - 確認資料庫服務已啟動
    - 檢查資料庫環境變數是否正確
    - 查看 `railway-init.sh` 的執行日誌

3. **檢查模型文件**：

    - 確認模型文件路徑正確（預設：CNN v1.1 和 YOLO v1）
    - 確認模型文件存在於映像中
    - 檢查環境變數 `CNN_MODEL_PATH_RELATIVE` 和 `YOLO_MODEL_PATH_RELATIVE` 是否正確

4. **檢查容器啟動**：
    - 確認 `start.sh` 腳本有執行權限
    - 檢查 Gunicorn 是否正常啟動
    - 查看端口是否正確綁定

### 資料庫連接失敗

1. **檢查環境變數**：

    - 確認 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD` 都已設置
    - 確認使用了正確的 Railway 環境變數引用語法

2. **檢查資料庫服務**：

    - 確認 PostgreSQL 服務已啟動
    - 檢查資料庫服務的狀態

3. **檢查防火牆**：
    - Railway 會自動處理網路配置，但確認沒有額外的防火牆規則

### 前端無法訪問

1. **檢查 CORS 配置**：

    - 確認 `CORS_ORIGINS` 環境變數包含正確的域名
    - 確認前端構建成功

2. **檢查路由配置**：
    - 確認後端正確服務前端靜態文件
    - 檢查 SPA 路由是否正確配置

### 性能問題

1. **檢查資源使用**：

    - 在 Railway 專案中查看 **"Metrics"** 標籤
    - 考慮升級服務計劃

2. **優化配置**：
    - 調整 Gunicorn workers 數量
    - 啟用 Redis 快取
    - 優化模型載入

## 最佳實踐

1. **使用環境變數**：不要在代碼中硬編碼配置
2. **使用 Railway 環境變數引用**：自動獲取資料庫和 Redis 連接資訊
3. **啟用 Cloudinary**：使用雲端圖片儲存，避免本地存儲問題
4. **監控資源使用**：定期檢查 Railway Metrics
5. **設置備份**：定期備份資料庫
6. **使用自定義域名**：提供更好的用戶體驗
7. **啟用 HTTPS**：Railway 自動提供 HTTPS 證書

## 相關資源

-   [Railway 文檔](https://docs.railway.app)
-   [Railway CLI](https://docs.railway.app/develop/cli)
-   [Gunicorn 文檔](https://gunicorn.org/)
-   [Flask 部署指南](https://flask.palletsprojects.com/en/latest/deploying/)

## 支援

如果遇到問題，請：

1. 查看 Railway 日誌
2. 檢查環境變數配置
3. 參考本文檔的故障排除部分
4. 查看專案 GitHub Issues
