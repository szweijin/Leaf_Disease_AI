# Railway 部署快速指南

這是 Railway 部署的快速參考指南。詳細文檔請查看 `docs/railway_deployment.md`。

## 快速開始

### 1. 準備專案

```bash
# 確保所有更改已提交
git add .
git commit -m "準備 Railway 部署"
git push origin main
```

### 2. 在 Railway 創建專案

1. 前往 [Railway Dashboard](https://railway.app/dashboard)
2. 點擊 **"New Project"** → **"Deploy from GitHub repo"**
3. 選擇您的專案倉庫

### 3. 添加服務

1. **PostgreSQL 資料庫**：
   - 點擊 **"+ New"** → **"Database"** → **"Add PostgreSQL"**

2. **Redis（可選）**：
   - 點擊 **"+ New"** → **"Database"** → **"Add Redis"**

### 4. 配置環境變數

在 Railway 專案設置中，進入 **"Variables"** 標籤，添加以下環境變數：

#### 必要環境變數

```bash
FLASK_ENV=production
ENVIRONMENT=production
SECRET_KEY=<使用 openssl rand -hex 32 生成>
DEBUG=false

# 資料庫（使用 Railway 自動提供的變數）
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}

# Redis（如果添加了 Redis 服務）
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
REDIS_DB=0

# Cloudinary（強烈建議）
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_SECURE=true
CLOUDINARY_FOLDER=leaf_disease_ai

# CORS（生產環境）
CORS_ORIGINS=https://your-app.railway.app
```

### 5. 初始化資料庫

部署完成後，使用 Railway CLI 初始化資料庫：

```bash
# 安裝 Railway CLI
npm i -g @railway/cli

# 登入
railway login

# 連接資料庫
railway connect postgres

# 執行初始化腳本
psql -f database/init_database.sql
```

或使用 Railway Web 界面：

1. 點擊 PostgreSQL 服務
2. 進入 **"Connect"** 標籤
3. 使用提供的連接資訊連接資料庫
4. 執行 `database/init_database.sql` 中的 SQL

### 6. 部署模型文件

模型文件很大，建議使用 Railway Volume：

1. 在專案中添加 **"Volume"** 服務
2. 將模型文件上傳到 Volume
3. 配置模型路徑環境變數指向 Volume

### 7. 設置域名

1. 在 Railway 專案設置中，進入 **"Settings"** → **"Networking"**
2. 點擊 **"Generate Domain"** 生成 Railway 域名
3. 或添加自定義域名

## 重要提示

1. **SECRET_KEY**：必須使用強隨機字串，至少 32 字元
2. **資料庫初始化**：首次部署後必須初始化資料庫
3. **模型文件**：模型文件很大，建議使用 Volume 或外部存儲
4. **Cloudinary**：強烈建議啟用 Cloudinary 用於圖片儲存
5. **監控**：定期檢查 Railway Metrics 和 Logs

## 故障排除

### 部署失敗

- 檢查構建日誌
- 確認所有環境變數已設置
- 檢查 `requirements.txt` 是否包含所有依賴

### 應用無法啟動

- 查看 Railway Logs
- 檢查資料庫連接
- 確認模型文件路徑正確

### 資料庫連接失敗

- 確認使用了正確的 Railway 環境變數引用
- 檢查 PostgreSQL 服務狀態

## 詳細文檔

完整的部署文檔請查看：`docs/railway_deployment.md`

## 支援

如有問題，請：
1. 查看 Railway 日誌
2. 檢查環境變數配置
3. 參考詳細部署文檔
4. 查看專案 GitHub Issues

