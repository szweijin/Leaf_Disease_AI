# Leaf Disease AI - 本地端開發環境

葉片病害檢測 AI 系統（本地端專用版本）

## 功能特色

-   🤖 AI 病害檢測：使用 YOLOv11 模型進行葉片病害檢測
-   📊 統計分析：使用者檢測歷史與統計資料
-   🔐 使用者認證：註冊、登入、個人資料管理
-   ⚡ Redis 快取：提升 API 響應速度
-   📚 Swagger API 文檔：完整的 API 文檔與測試介面
-   ☁️ Cloudinary 圖片儲存：可選的雲端圖片儲存服務（支援自動優化）
    -   原始圖片存儲在 `leaf_disease_ai/origin` 資料夾
    -   帶檢測框的圖片存儲在 `leaf_disease_ai/predictions` 資料夾
-   🖼️ 雙圖片顯示：前端同時顯示原始圖片和帶檢測框的結果圖片
-   🎨 現代化 UI：使用 Tailwind CSS 3.x 和 shadcn/ui 構建的響應式前端介面
-   🎭 組件庫：使用 shadcn/ui 官方組件，採用灰階配色方案
-   📱 響應式設計：支援手機、平板、桌面三種裝置佈局
-   🛣️ 路由管理：使用 React Router 實現 URL 路由和瀏覽器導航

## 系統需求

-   Python 3.8+
-   PostgreSQL 12+
-   Redis 6.0+（可選，未安裝時會自動降級）
-   Node.js 16+（前端開發）
-   npm 或 yarn（前端套件管理）

## 快速開始

### 1. 安裝依賴

**後端依賴：**

```bash
pip install -r requirements.txt
```

**前端依賴：**

```bash
cd frontend
npm install
```

前端使用 **React 19**、**Vite 7**、**Tailwind CSS 3.x**、**shadcn/ui** 和 **React Router** 作為核心框架，所有依賴已包含在 `package.json` 中：

-   React 19.2.0
-   React Router DOM 7.10.1（路由管理）
-   Vite 7.2.7（建置工具）
-   @vitejs/plugin-react 5.1.1
-   Tailwind CSS 3.4.19
-   shadcn/ui 組件庫（基於 Radix UI）
-   PostCSS 8.5.6
-   Autoprefixer 10.4.22
-   ESLint 9.39.1（代碼檢查）
-   lucide-react（圖標庫）

**注意**：

-   `package.json` 中包含 `"type": "module"`，確保所有配置使用 ES 模組語法
-   所有頁面組件已完全使用 shadcn/ui 組件重構，採用灰階配色方案
-   前端同時支援 TypeScript（`tsconfig.json`）和 JavaScript（`jsconfig.json`）配置
-   詳細的 shadcn/ui 使用指南請參考 `frontend/SHADCN_UI_GUIDE.md`

### 2. 設定環境變數

創建 `.env` 檔案（在專案根目錄）：

```bash
# 資料庫設定
DB_HOST=localhost
DB_PORT=5432
DB_NAME=leaf_disease_ai
DB_USER=postgres
DB_PASSWORD=your_password

# Redis 設定（可選）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Cloudinary 圖片儲存設定（強烈建議啟用）
# 圖片現在完全儲存在 Cloudinary，不再儲存在資料庫 BLOB
USE_CLOUDINARY=true
CLOUDINARY_CLOUD_NAME=dcqts6ryi
CLOUDINARY_API_KEY=398648383382972
CLOUDINARY_API_SECRET=your_api_secret_here  # 請替換為您的 API Secret
CLOUDINARY_SECURE=true
CLOUDINARY_FOLDER=leaf_disease_ai

# 應用設定
# SECRET_KEY 必須設定為一個強隨機字串（至少 32 字元）
# 可以使用以下命令生成：openssl rand -hex 32
SECRET_KEY=your-secret-key-here  # ⚠️ 請替換為實際的隨機字串

# AI 模型路徑設定（可選，使用預設值時可省略）
# CNN_MODEL_PATH_RELATIVE=model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth
# YOLO_MODEL_PATH_RELATIVE=model/yolov11/best_v1_50.pt
```

**生成 SECRET_KEY**：

可以使用以下命令生成一個安全的隨機 SECRET_KEY：

```bash
# 方法一：使用 openssl（推薦）
openssl rand -hex 32

# 方法二：使用 Python
python -c "import secrets; print(secrets.token_hex(32))"
```

將生成的結果複製到 `.env` 檔案中的 `SECRET_KEY=` 後面。

⚠️ **重要**：不要使用預設值 `your-secret-key-here`，這會導致應用程式無法啟動。

### 3. 初始化資料庫

**方式一：使用資料庫管理腳本（推薦）**

初始化資料庫（如果不存在則創建）：

```bash
python database/database_manager.py init
```

或直接執行（預設為 init 模式）：

```bash
python database/database_manager.py
```

腳本會自動執行：

1. 創建資料庫（如果不存在）
2. 執行完整資料庫初始化（`database/init_database.sql`）
    - 包含：表結構、視圖、函數、觸發器、圖片存儲功能、prediction_log 表、病害資訊資料

**方式二：重置資料庫（刪除並重新創建）**

```bash
python database/database_manager.py reset
```

⚠️ **警告**：此操作將刪除所有現有資料！
腳本會自動執行：

1. 刪除現有資料庫
2. 創建新資料庫
3. 執行完整資料庫初始化（`database/init_database.sql`）
    - 包含：表結構、視圖、函數、觸發器、圖片存儲功能、prediction_log 表、病害資訊資料

**方式三：手動執行 SQL**

```bash
# 先創建資料庫
createdb -U postgres -p 5433 leaf_disease_ai

# 執行完整資料庫初始化（包含所有內容）
psql -U postgres -d leaf_disease_ai -p 5433 -f database/init_database.sql
```

**注意**：如果使用非預設端口（如 5433），請在 `.env` 中設定 `DB_PORT=5433`

### 4. 啟動 Redis（可選但建議）

**macOS:**

```bash
brew install redis
brew services start redis
```

**Linux:**

```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
下載並安裝 Redis for Windows，或使用 Docker：

```bash
docker run -d -p 6379:6379 redis:latest
```

### 5. 啟動服務

**方式一：使用啟動腳本**

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

**方式二：手動啟動**

後端：

```bash
cd backend
python app.py
```

前端：

```bash
cd frontend
npm run dev
```

**前端快速啟動（如果遇到啟動緩慢問題）**：

如果前端啟動緩慢或遇到依賴問題，可以嘗試以下方法：

1. **清理並重新安裝依賴**：

```bash
cd frontend

# 停止正在運行的 Vite 進程
pkill -f vite

# 刪除依賴和緩存
rm -rf node_modules package-lock.json .vite

# 重新安裝依賴
npm install

# 啟動開發服務器
npm run dev
```

2. **使用快速啟動命令**：

```bash
cd frontend
npm run dev:fast  # 強制重新構建依賴緩存
```

**前端啟動優化**：

項目已配置以下優化以加快啟動速度：

-   ✅ **依賴預優化**：常用依賴（react、react-dom、framer-motion 等）已預配置優化
-   ✅ **TypeScript 編譯優化**：開發時禁用部分檢查以加快編譯
-   ✅ **HMR 優化**：禁用錯誤覆蓋層以加快啟動
-   ✅ **ESBuild 優化**：減少不必要的日誌輸出

如果首次啟動仍然較慢，這是正常的（需要構建依賴緩存），後續啟動會更快。

## API 文檔

啟動後端服務後，訪問 Swagger API 文檔：

-   **Swagger UI**: http://localhost:5000/api-docs
-   **API Spec JSON**: http://localhost:5000/apispec.json

## 目錄結構

```
Leaf_Disease_AI_local/
├── backend/                    # Flask 後端
│   ├── app.py                  # 主應用程式（路由定義）
│   ├── modules/                # AI 模型模組
│   │   ├── cnn_*.py            # CNN 相關模組
│   │   ├── yolo_*.py           # YOLO 相關模組
│   │   └── yolo_postprocess.py # YOLO 後處理（包含帶框圖片生成功能）
│   └── src/
│       ├── core/               # 核心模組
│       │   ├── __init__.py
│       │   ├── core_app_config.py    # 應用程式配置和初始化
│       │   ├── core_db_manager.py    # 資料庫管理
│       │   ├── core_helpers.py       # 核心輔助函數（認證、日誌）
│       │   ├── core_redis_manager.py # Redis 快取管理
│       │   └── core_user_manager.py  # 使用者管理
│       └── services/           # 業務服務
│           ├── __init__.py
│           ├── service_auth.py              # 認證服務
│           ├── service_cnn.py                # CNN 分類服務
│           ├── service_cloudinary.py         # Cloudinary 儲存服務
│           ├── service_image.py              # 圖片處理服務
│           ├── service_image_manager.py      # 圖片管理器
│           ├── service_integrated.py         # 整合檢測服務
│           ├── service_integrated_api.py     # 整合檢測 API 服務
│           ├── service_user.py               # 使用者服務
│           ├── service_yolo.py               # YOLO 檢測服務
│           └── service_yolo_api.py           # YOLO 檢測 API 服務
├── config/                     # 配置檔案
│   ├── __init__.py
│   ├── base.py                 # 基礎配置
│   ├── development.py           # 開發環境配置
│   └── production.py           # 生產環境配置
├── database/                   # 資料庫腳本和工具
│   ├── init_database.sql       # 完整資料庫初始化
│   ├── database_manager.py     # 資料庫管理腳本（init/reset）
│   ├── README.md               # 資料庫說明
│   └── SQL_REFERENCE.md        # SQL 語句參考文檔
├── docs/                       # 文檔
│   ├── complete_documentation.md # 完整系統文檔
│   └── sequences_diagram.md    # 系統序列圖
├── frontend/                   # React 前端（React 19 + Vite 7 + Tailwind CSS 3.x）
│   ├── src/
│   │   ├── api.js              # API 調用封裝
│   │   ├── App.jsx             # 主應用組件
│   │   ├── App.css             # 應用樣式
│   │   ├── main.jsx            # 入口文件
│   │   ├── index.css           # Tailwind CSS 入口文件（@tailwind 指令）
│   │   ├── pages/              # 頁面組件（一個檔案一個頁面）
│   │   │   ├── LoginPage.jsx    # 登入頁面
│   │   │   ├── HomePage.jsx     # HOME 頁面（檢測功能）
│   │   │   ├── HistoryPage.jsx  # HISTORY 頁面（檢測歷史）
│   │   │   └── AccountPage.jsx  # ACCOUNT 頁面（帳號設定）
│   │   ├── components/         # 共用組件
│   │   │   ├── ProtectedRoute.jsx      # 路由守衛（保護需要登入的路由）
│   │   │   ├── ResponsiveNavbar.jsx   # 響應式導覽列
│   │   │   ├── AppLayout.jsx           # 應用佈局（包含路由）
│   │   │   ├── ImageCropper.jsx        # 圖片裁切組件
│   │   │   ├── CameraView.jsx          # 相機視圖組件
│   │   │   ├── LeafDetectionView.jsx   # 葉片檢測視圖（同時顯示原始和帶框圖片）
│   │   │   └── ui/                      # shadcn/ui 組件
│   │   │       ├── button.jsx          # 按鈕組件
│   │   │       ├── card.jsx            # 卡片組件
│   │   │       ├── input.jsx           # 輸入框組件
│   │   │       ├── label.jsx           # 標籤組件
│   │   │       ├── select.jsx          # 下拉選單組件
│   │   │       ├── badge.jsx           # 徽章組件
│   │   │       ├── alert.jsx           # 警告提示組件
│   │   │       ├── dialog.jsx          # 對話框組件
│   │   │       ├── sheet.jsx           # 側邊欄組件
│   │   │       └── separator.jsx        # 分隔線組件
│   │   └── lib/                # 工具函數
│   │       └── utils.js        # 通用工具函數
│   ├── tailwind.config.js      # Tailwind 主題配置（ES 模組）
│   ├── postcss.config.js       # PostCSS 配置（ES 模組）
│   ├── vite.config.js          # Vite 配置（ES 模組）
│   ├── eslint.config.js        # ESLint 配置（ES 模組）
│   ├── components.json         # shadcn/ui 配置文件
│   ├── jsconfig.json           # JavaScript 路徑別名配置
│   ├── tsconfig.json           # TypeScript 配置（支援 JavaScript）
│   ├── package.json            # 包含 "type": "module"
│   └── SHADCN_UI_GUIDE.md     # shadcn/ui 使用指南（如果存在）
├── model/                      # AI 模型
│   ├── CNN/                    # CNN 模型
│   │   ├── CNN_v1.0_20251204/   # CNN v1.0 模型
│   │   │   └── best_mobilenetv3_large.pth
│   │   └── CNN_v1.1_20251210/   # CNN v1.1 模型
│   │       └── best_mobilenetv3_large.pth
│   └── yolov11/                # YOLO 模型
│       ├── best_v1_50.pt       # 預設 YOLO 模型（可通過環境變數配置）
│       └── YOLOv11_v1_20251212/ # YOLO v1 訓練結果
│           └── weights/
│               └── best.pt
├── scripts/                    # 腳本文件
│   └── start.sh                # 啟動腳本
├── tests/                      # 測試文件（預留）
│   ├── __init__.py
│   └── README.md
├── uploads/                    # 上傳圖片暫存（自動創建）
├── .env.example                # 環境變數範例
├── .gitignore                  # Git 忽略文件
├── requirements.txt            # Python 依賴
└── README.md                   # 專案說明文檔
```

## 主要功能說明

### 圖片處理與儲存

系統支援完整的圖片處理流程：

-   **原始圖片儲存**：上傳到 Cloudinary 的 `leaf_disease_ai/origin` 資料夾
-   **帶框圖片生成**：當 YOLO 檢測到病害時，自動生成帶檢測框的圖片
    -   只顯示檢測框，不顯示文字標籤
    -   框線寬度為 2 像素（不會太粗）
    -   框線顏色為綠色 (RGB: 0, 255, 0)
-   **帶框圖片儲存**：上傳到 Cloudinary 的 `leaf_disease_ai/predictions` 資料夾
-   **資料庫記錄**：
    -   `prediction_log.image_path`：存儲原始圖片的 Cloudinary URL
    -   `prediction_log.predict_img_url`：存儲帶框圖片的 Cloudinary URL
-   **前端顯示**：檢測結果頁面會同時顯示兩張圖片（桌面版並排，手機版上下排列）

### Redis 快取

系統使用 Redis 進行以下快取：

-   **使用者統計資料**：快取 5 分鐘
-   **檢測結果**：快取 1 小時（基於圖片 hash）
-   **登入嘗試限制**：防止暴力破解

如果 Redis 未安裝或無法連接，系統會自動降級，不影響基本功能。

### Swagger API 文檔

所有 API 端點都有完整的 Swagger 文檔，包括：

-   請求參數說明
-   回應格式範例
-   錯誤碼說明
-   線上測試功能

### API 端點

#### 認證相關

-   `POST /register` - 使用者註冊
-   `POST /login` - 使用者登入
-   `GET/POST /logout` - 使用者登出
-   `GET /check-auth` - 檢查登入狀態

#### 使用者相關

-   `GET /user/profile` - 獲取個人資料
-   `POST /user/change-password` - 修改密碼
-   `GET /user/stats` - 獲取統計資料（快取）

#### 檢測相關

-   `POST /api/predict` - 整合檢測（CNN + YOLO，快取）
    -   返回結果包含 `image_path`（原始圖片 URL）和 `predict_img_url`（帶框圖片 URL）
    -   原始圖片上傳到 Cloudinary 的 `leaf_disease_ai/origin` 資料夾
    -   帶框圖片上傳到 Cloudinary 的 `leaf_disease_ai/predictions` 資料夾
-   `POST /api/predict-crop` - 裁切後重新檢測
    -   同樣返回原始圖片和帶框圖片的 URL
-   `POST /predict` - 舊版檢測端點（向後兼容）
-   `GET /history` - 獲取檢測歷史

## 開發說明

-   **後端配置**：使用 `config.development.DevelopmentConfig`
-   **資料庫**：PostgreSQL，連接資訊在 `.env` 中設定
-   **快取**：Redis（可選），配置在 `.env` 中設定
-   **前端**：Vite 7.2.7 dev server + React 19.2.0 + React Router + Tailwind CSS 3.x，自動 proxy 到後端
-   **前端路由**：使用 React Router DOM 7.10.1 實現 URL 路由，支援瀏覽器導航和路由守衛
-   **前端樣式**：使用 Tailwind CSS 3.4.19 + PostCSS 8.5.6，主題配置在 `frontend/tailwind.config.js`
-   **前端配置**：
    -   `tsconfig.json`：TypeScript 配置（支援 JavaScript，`allowJs: true`）
    -   `jsconfig.json`：JavaScript 路徑別名配置
    -   `eslint.config.js`：ESLint 代碼檢查配置
    -   `vite.config.js`：Vite 建置配置（ES 模組）
-   **響應式設計**：支援手機（底部導覽列）、平板、桌面（頂部導覽列）三種佈局
-   **頁面結構**：使用 `pages/` 目錄組織頁面組件，`components/` 目錄存放共用組件
-   **模組系統**：使用 ES 模組（`"type": "module"`），所有配置檔案使用 ES 模組語法

## 注意事項

1. 此專案僅用於本地端開發，不適合直接部署到生產環境
2. 確保 PostgreSQL 和 Redis 服務已啟動
3. 模型檔案需要存在：
    - YOLO 模型：預設 `model/yolov11/best_v1_50.pt`（可通過環境變數 `YOLO_MODEL_PATH_RELATIVE` 配置）
    - CNN 模型：預設 `model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth`（可通過環境變數 `CNN_MODEL_PATH_RELATIVE` 配置）
4. 圖片儲存：
    - **Cloudinary（推薦）**：圖片現在完全儲存在 Cloudinary 雲端，不再儲存在資料庫 BLOB
    - 預設啟用 Cloudinary，需要在 `.env` 中設定 `CLOUDINARY_API_SECRET`
    - 如果未設定 Cloudinary，系統會使用本地文件儲存（`uploads/` 目錄）
    - 資料庫優化已包含在 `init_database.sql` 中，無需單獨執行
    - **圖片分類儲存**：
        - 原始圖片：存儲在 `leaf_disease_ai/origin` 資料夾，URL 保存在 `prediction_log.image_path`
        - 帶框圖片：存儲在 `leaf_disease_ai/predictions` 資料夾，URL 保存在 `prediction_log.predict_img_url`
    - **前端顯示**：檢測結果頁面會同時顯示原始圖片和帶檢測框的圖片（並排顯示）

## 故障排除

### 資料庫不存在錯誤

如果看到 "database 'leaf_disease_ai' does not exist" 錯誤：

1. **使用資料庫管理腳本（推薦）**：

    ```bash
    python database/database_manager.py init
    ```

    或直接執行：

    ```bash
    python database/database_manager.py
    ```

2. **或手動創建資料庫**：

    ```bash
    # 創建資料庫
    createdb -U postgres -p 5433 leaf_disease_ai

    # 執行完整資料庫初始化（包含所有內容）
    psql -U postgres -d leaf_disease_ai -p 5433 -f database/init_database.sql
    ```

### 資料庫連接失敗

-   檢查 PostgreSQL 服務是否運行：`pg_isready -p 5433`
-   確認 `.env` 中的資料庫設定正確（特別是 `DB_PORT`）
-   確認資料庫使用者有創建資料庫的權限

### SECRET_KEY 未設定錯誤

如果看到 "SECRET_KEY 未設定或使用預設值" 的錯誤：

1. **使用啟動腳本（推薦）**：

    - 啟動腳本會自動生成一個臨時的 SECRET_KEY
    - 但建議手動設定到 `.env` 檔案中

2. **手動生成並設定**：

    ```bash
    # 生成 SECRET_KEY
    openssl rand -hex 32

    # 將結果添加到 .env 檔案
    # SECRET_KEY=<生成的結果>
    ```

3. **確認 .env 檔案存在**：
    - 確認專案根目錄有 `.env` 檔案
    - 確認 `SECRET_KEY` 行沒有被註釋（不是以 `#` 開頭）
    - 確認 `SECRET_KEY` 不是預設值 `your-secret-key-here`

### Redis 連接失敗

如果看到 "⚠️ Redis 連接失敗" 的警告，系統仍可正常運行，只是不會使用快取功能。確保 Redis 服務已啟動：

```bash
redis-cli ping  # 應該返回 PONG
```

### 模型載入失敗

確保模型檔案路徑正確：

-   YOLO 模型：預設 `model/yolov11/best_v1_50.pt`（可通過環境變數 `YOLO_MODEL_PATH_RELATIVE` 配置）
-   CNN 模型：預設 `model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth`（可通過環境變數 `CNN_MODEL_PATH_RELATIVE` 配置）

如果使用不同的模型路徑，請在 `.env` 檔案中設定：

```bash
YOLO_MODEL_PATH_RELATIVE=model/yolov11/YOLOv11_v1_20251212/weights/best.pt
CNN_MODEL_PATH_RELATIVE=model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
```

### 帶框圖片未顯示

如果檢測結果頁面只顯示原始圖片，沒有顯示帶框圖片：

1. **檢查 YOLO 檢測是否成功**：

    - 查看後端日誌，確認是否有 "✅ 已生成帶檢測框的圖片" 的訊息
    - 確認 YOLO 檢測到了病害（`yolo_result.detected === true`）

2. **檢查 Cloudinary 上傳**：

    - 查看後端日誌，確認是否有 "✅ 帶框圖片已上傳到 Cloudinary" 的訊息
    - 確認 `.env` 中的 Cloudinary 配置正確
    - 檢查 Cloudinary 控制台，確認圖片已上傳到 `leaf_disease_ai/predictions` 資料夾

3. **檢查資料庫**：

    - 確認 `prediction_log` 表中的 `predict_img_url` 欄位有值
    - 可以使用以下 SQL 查詢檢查：
        ```sql
        SELECT id, image_path, predict_img_url FROM prediction_log ORDER BY created_at DESC LIMIT 5;
        ```

4. **檢查前端**：
    - 打開瀏覽器開發者工具（F12），查看 Network 標籤
    - 確認 API 回應中包含 `predict_img_url` 欄位
    - 檢查 Console 是否有圖片載入錯誤

### 前端啟動緩慢或卡住

如果前端啟動緩慢或卡住：

1. **清理並重新安裝依賴（推薦）**：

```bash
cd frontend

# 停止正在運行的 Vite 進程
pkill -f vite

# 刪除依賴和緩存
rm -rf node_modules package-lock.json .vite

# 重新安裝依賴
npm install

# 啟動開發服務器
npm run dev
```

2. **使用快速啟動命令**：

```bash
cd frontend
npm run dev:fast  # 強制重新構建依賴緩存
```

3. **檢查 Node.js 版本**：

確保使用 Node.js 18+ 版本：

```bash
node --version  # 應該顯示 v18.x.x 或更高
```

4. **檢查端口占用**：

如果端口 5173 被占用，Vite 會自動使用下一個可用端口，或手動指定：

```bash
npm run dev -- --port 3000
```

### 前端樣式問題

如果前端樣式顯示異常（http://localhost:5173 無法正確顯示）：

1. **執行修復腳本（推薦）**：

    ```bash
    cd frontend
    ./fix-tailwind.sh
    ```

2. **手動修復步驟**：

    ```bash
    cd frontend

    # 清除並重新安裝
    rm -rf node_modules package-lock.json
    npm install

    # 確認 Tailwind CSS 已安裝
    npm install -D tailwindcss@^3.4.19 postcss@^8.5.6 autoprefixer@^10.4.22

    # 重新啟動開發伺服器
    npm run dev
    ```

3. **檢查配置檔案**：

    - 確認 `tailwind.config.js` 存在且 `content` 路徑正確
    - 確認 `postcss.config.js` 存在且包含 `tailwindcss` 和 `autoprefixer`
    - 確認 `src/index.css` 包含 `@tailwind` 指令
    - 確認 `src/main.jsx` 導入 `./index.css`
    - 確認 `tsconfig.json` 和 `jsconfig.json` 配置正確

4. **檢查瀏覽器控制台**：

    - 打開開發者工具（F12）
    - 檢查 Console 是否有錯誤
    - 檢查 Network 標籤，確認 CSS 檔案是否載入
    - 檢查 Elements 標籤，確認 `<head>` 中是否有樣式

5. **檢查路由問題**：

    - 確認 `react-router-dom` 已正確安裝
    - 確認所有頁面組件都在 `pages/` 目錄中
    - 確認 `App.tsx` 中的路由配置正確
    - 確認 `ProtectedRoute` 組件正確處理嵌套路由
    - 確認 `AppLayout` 組件使用 `<Outlet />` 渲染子路由

    **如果遇到路由無法跳轉的問題**：

    1. **檢查嵌套路由結構**：

        - 確認 `ProtectedRoute` 組件正確使用 `Outlet` 渲染子路由
        - 確認 `AppLayout` 組件包含 `<Outlet />` 來渲染嵌套路由
        - 確認路由配置中父路由使用 `element` 屬性包裹 `ProtectedRoute` 和 `AppLayout`

    2. **檢查 React Hooks 使用**：

        - 確認 `ProtectedRoute` 中的 `useEffect` 不在條件語句之後調用
        - 確認所有 Hooks 都在組件頂部調用

    3. **檢查動畫配置**：

        - 確認 `AppLayout` 中的 `AnimatePresence` 不會阻塞路由跳轉
        - 如果動畫時間過長，可能會影響路由跳轉體驗

    4. **檢查登入後導航**：
        - 確認 `LoginPage` 在登入成功後使用 `useNavigate` 進行導航
        - 確認狀態更新和導航的時序正確

6. **如果問題仍然存在**：

    檢查 `package.json` 中的腳本是否使用 `npx vite`（如果 vite 未正確安裝）

## 前端技術棧

### React Router

前端使用 **React Router DOM 7.10.1** 進行路由管理：

-   **路由列表**：

    -   `/` - 根據登入狀態重定向到 `/home` 或 `/login`
    -   `/login` - 登入/註冊頁面
    -   `/home` - HOME 頁面（檢測功能及單次檢測結果）
    -   `/history` - HISTORY 頁面（檢測歷史記錄）
    -   `/account` - ACCOUNT 頁面（帳號設定）

-   **路由守衛**：`ProtectedRoute` 組件自動保護需要登入的路由

    -   正確處理嵌套路由結構
    -   支援 `Outlet` 渲染子路由
    -   優化認證狀態檢查和重定向邏輯

-   **瀏覽器導航**：支援前進/後退按鈕和直接 URL 訪問
    -   登入成功後自動導航到首頁
    -   未登入時自動重定向到登入頁
    -   優化動畫配置，避免阻塞路由跳轉

#### 前端技術棧

前端使用 **React 19.2.0** + **Vite 7.2.7** + **Tailwind CSS 3.4.19** 作為核心技術棧：

-   **React 19.2.0**：最新版本的 React 框架
-   **Vite 7.2.7**：快速的前端建置工具，提供 HMR（熱模組替換）
-   **React Router DOM 7.10.1**：路由管理，支援瀏覽器導航

#### Tailwind CSS 3.x

前端使用 **Tailwind CSS 3.4.19** 作為樣式框架：

-   **配置方式**：

    -   使用 PostCSS 處理（`postcss.config.js`）
    -   使用傳統的 `@tailwind` 指令（`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`）
    -   主題配置在 `tailwind.config.js`（ES 模組格式）

-   **主題配置**：`frontend/tailwind.config.js`

    -   集中管理顏色、字體、間距等設計系統
    -   支援深色模式（class 模式）
    -   自定義斷點和工具類別

-   **響應式設計**：

    -   手機版（< 768px）：底部固定導覽列
    -   平板版（768px - 1024px）：桌面佈局，調整尺寸
    -   桌面版（≥ 1024px）：頂部導覽列，支援漢堡選單

-   **shadcn/ui 組件庫**：

    -   所有頁面組件已完全使用 shadcn/ui 組件重構
    -   採用灰階配色方案，統一視覺風格
    -   組件配置在 `components.json` 中
    -   詳細使用指南請參考 `frontend/SHADCN_UI_GUIDE.md`（如果存在）

-   **配置檔案**：

    -   `tsconfig.json`：TypeScript 配置（支援 JavaScript，`allowJs: true`, `checkJs: false`）
    -   `jsconfig.json`：JavaScript 路徑別名配置（`@/*` 對應 `./src/*`）
    -   `eslint.config.js`：ESLint 代碼檢查配置（ES 模組格式）
    -   `vite.config.js`：Vite 建置配置（ES 模組格式）
    -   `package.json`：包含 `"type": "module"`，所有配置檔案使用 ES 模組語法

### 建置前端

**開發模式**：

```bash
cd frontend
npm run dev
```

開發服務器會自動使用 `npx vite` 啟動，即使 vite 未安裝在本地也會自動下載。

**生產建置**：

```bash
cd frontend
npm run build
```

建置後的檔案會在 `frontend/dist/` 目錄中。

**注意**：生產環境部署時，需要配置服務器支援 SPA 路由（所有路由都返回 `index.html`）。

## 版本資訊

-   **版本**: 2.4.1
-   **模式**: 本地端開發
-   **前端框架**: React 19.2.0 + React Router DOM 7.10.1 + Vite 7.2.7 + Tailwind CSS 3.4.19 + shadcn/ui + PostCSS 8.5.6
-   **前端工具**: ESLint 9.39.1 + TypeScript 支援（tsconfig.json）
-   **UI 組件庫**: shadcn/ui（灰階配色方案）
-   **後端框架**: Flask + PostgreSQL + Redis（可選）
-   **AI 模型**:
    -   CNN: MobileNetV3-Large（預設：CNN_v1.0_20251204）
    -   YOLO: YOLOv11（預設：best_v1_50.pt，可通過環境變數配置）
-   **新功能**:
    -   ✅ 帶檢測框的圖片生成（只顯示框，不顯示文字標籤）
    -   ✅ 原始圖片和帶框圖片分別存儲在 Cloudinary 的不同資料夾
    -   ✅ 前端同時顯示原始圖片和帶框圖片
    -   ✅ 資料庫新增 `predict_img_url` 欄位存儲帶框圖片 URL
    -   ✅ 修復前端路由跳轉問題（嵌套路由、狀態更新時序、動畫阻塞）
-   **最後更新**: 2024-12-13
