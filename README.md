# Leaf Disease AI - 本地端開發環境

葉片病害檢測 AI 系統（本地端專用版本）

## 功能特色

-   🤖 **整合 AI 病害檢測**：使用 CNN + YOLO 兩階段檢測流程
    -   CNN 分類：判斷圖片類型（pepper_bell, potato, tomato, whole_plant, others）
    -   YOLO 檢測：針對特定類別執行病害檢測
    -   超解析度預處理（可選）：使用 EDSR 模型增強圖片解析度
-   ✂️ **智能圖片裁切**：支援最多 3 次裁切嘗試，自動處理整株植物圖片
-   📊 **統計分析**：使用者檢測歷史與統計資料（支援分頁、排序、過濾）
-   🔐 **使用者認證**：註冊、登入、個人資料管理、密碼修改
-   ⚡ **Redis 快取**：提升 API 響應速度（檢測結果、使用者統計、登入限制）
-   📚 **Swagger API 文檔**：完整的 API 文檔與測試介面
-   ☁️ **Cloudinary 圖片儲存**：可選的雲端圖片儲存服務（支援自動優化）
    -   原始圖片存儲在 `leaf_disease_ai/origin` 資料夾
    -   帶檢測框的圖片存儲在 `leaf_disease_ai/predictions` 資料夾
-   🖼️ **雙圖片顯示**：前端同時顯示原始圖片和帶檢測框的結果圖片
-   📷 **多種上傳方式**：文件上傳、相機拍攝、圖片庫選擇
-   🎨 **現代化 UI**：使用 Tailwind CSS 4.x 和 shadcn/ui 構建的響應式前端介面
-   🎭 **組件庫**：使用 shadcn/ui 官方組件，採用灰階配色方案
-   📱 **響應式設計**：支援手機、平板、桌面三種裝置佈局
-   🛣️ **路由管理**：使用 React Router 實現 URL 路由和瀏覽器導航
-   🖨️ **列印功能**：支援列印檢測結果和 PDF 生成
-   📝 **完整日誌系統**：活動日誌、錯誤日誌、API 日誌、性能日誌

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

前端使用 **React 19**、**Vite 7**、**Tailwind CSS 4.x**、**shadcn/ui** 和 **React Router** 作為核心框架，所有依賴已包含在 `package.json` 中：

-   React 19.2.0
-   React Router DOM 7.10.1（路由管理）
-   Vite 7.2.4（建置工具）
-   @vitejs/plugin-react 5.1.1
-   Tailwind CSS 4.1.18
-   shadcn/ui 組件庫（基於 Radix UI）
-   PostCSS 8.5.6
-   Autoprefixer 10.4.22
-   ESLint 9.39.1（代碼檢查）
-   TypeScript 5.9.3
-   lucide-react（圖標庫）
-   react-to-print 3.2.0（列印功能）
-   react-cropper 2.1.3（圖片裁切）
-   cropperjs 1.6.2（圖片裁切庫）

**注意**：

-   `package.json` 中包含 `"type": "module"`，確保所有配置使用 ES 模組語法
-   所有頁面組件已完全使用 shadcn/ui 組件重構，採用灰階配色方案
-   前端使用 TypeScript（`tsconfig.json`、`tsconfig.app.json`、`tsconfig.node.json`）進行型別檢查
-   詳細的 shadcn/ui 使用指南請參考 `frontend/README.md`

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

# 超解析度模型設定（可選）
# ENABLE_SR=true                    # 是否啟用超解析度預處理
# SR_MODEL_PATH_RELATIVE=model/SR/model_pytorch/EDSR_x2.pt
# SR_MODEL_TYPE=edsr                # 模型類型：edsr, rcan 等
# SR_SCALE=2                        # 放大倍數：2, 4, 8
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

**後端啟動**：

```bash
cd backend
python app.py
```

**前端啟動**：

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

## 系統架構文檔

專案提供完整的架構文檔，詳細說明各模組的功能和實現：

-   **後端架構**：`docs/backend.md` - 後端完整架構、核心模組、服務層、模型模組說明
-   **前端架構**：`docs/frontend.md` - 前端完整架構、頁面組件、UI 組件、路由結構說明
-   **資料庫架構**：`docs/database.md` - 資料庫完整架構、表結構、視圖、函數說明
-   **序列圖**：`docs/sequences_diagram.md` - 系統主要流程的 Mermaid 序列圖

## 目錄結構

```
Leaf_Disease_AI_local/
├── backend/                    # Flask 後端
│   ├── app.py                  # 主應用程式（路由定義）
│   ├── test_model_loading.py  # 模型載入測試腳本
│   ├── modules/                # AI 模型模組
│   │   ├── cnn_load.py         # CNN 模型載入
│   │   ├── cnn_preprocess.py   # CNN 圖片預處理
│   │   ├── cnn_predict.py      # CNN 預測
│   │   ├── cnn_postprocess.py # CNN 結果後處理
│   │   ├── cnn_utils.py        # CNN 工具函數
│   │   ├── yolo_load.py        # YOLO 模型載入
│   │   ├── yolo_detect.py      # YOLO 檢測
│   │   ├── yolo_postprocess.py # YOLO 結果後處理（包含帶框圖片生成功能）
│   │   ├── yolo_utils.py       # YOLO 工具函數
│   │   ├── sr_load.py          # 超解析度模型載入
│   │   ├── sr_preprocess.py    # 超解析度預處理
│   │   ├── sr_utils.py         # 超解析度工具函數
│   │   └── SR_README.md       # 超解析度模組說明
│   └── src/
│       ├── core/               # 核心模組
│       │   ├── __init__.py
│       │   ├── core_app_config.py    # 應用程式配置和初始化
│       │   ├── core_db_manager.py    # 資料庫管理（連接池、日誌記錄）
│       │   ├── core_helpers.py       # 核心輔助函數（認證、日誌）
│       │   ├── core_redis_manager.py # Redis 快取管理
│       │   └── core_user_manager.py  # 使用者管理（註冊、登入、查詢）
│       └── services/           # 業務服務
│           ├── __init__.py
│           ├── service_auth.py              # 認證服務（註冊、登入、登出）
│           ├── service_cnn.py                # CNN 分類服務
│           ├── service_cloudinary.py         # Cloudinary 儲存服務
│           ├── service_image.py              # 圖片處理服務
│           ├── service_image_manager.py      # 圖片管理器（統一管理圖片流程）
│           ├── service_integrated.py         # 整合檢測服務（CNN + YOLO）
│           ├── service_integrated_api.py     # 整合檢測 API 服務
│           ├── service_user.py               # 使用者服務（個人資料、統計）
│           ├── service_yolo.py               # YOLO 檢測服務
│           └── service_yolo_api.py           # YOLO 檢測 API 服務（向後兼容）
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
│   ├── backend.md              # 後端架構文檔
│   ├── frontend.md             # 前端架構文檔
│   ├── database.md             # 資料庫架構文檔
│   └── sequences_diagram.md    # 系統序列圖
├── frontend/                   # React 前端（React 19 + Vite 7 + Tailwind CSS 4.x + TypeScript）
│   ├── src/
│   │   ├── App.tsx             # 主應用組件
│   │   ├── App.css             # 應用樣式
│   │   ├── main.tsx            # 入口文件
│   │   ├── index.css           # Tailwind CSS 入口文件（@tailwind 指令）
│   │   ├── pages/              # 頁面組件（一個檔案一個頁面）
│   │   │   ├── LoginPage.tsx    # 登入頁面
│   │   │   ├── HomePage.tsx     # HOME 頁面（檢測功能）
│   │   │   ├── HistoryPage.tsx  # HISTORY 頁面（檢測歷史）
│   │   │   ├── AccountPage.tsx  # ACCOUNT 頁面（帳號設定）
│   │   │   └── PredictPage.tsx  # 預測結果頁面
│   │   ├── components/         # 共用組件
│   │   │   ├── ProtectedRoute.tsx      # 路由守衛（保護需要登入的路由）
│   │   │   ├── ResponsiveNavbar.tsx   # 響應式導覽列
│   │   │   ├── AppLayout.tsx           # 應用佈局（包含路由）
│   │   │   ├── ImageCropper.tsx        # 圖片裁切組件
│   │   │   ├── CameraView.tsx          # 相機視圖組件
│   │   │   ├── LeafDetectionView.tsx   # 葉片檢測視圖（同時顯示原始和帶框圖片）
│   │   │   ├── PrintButton.tsx         # 列印按鈕組件
│   │   │   ├── Loading.tsx              # 載入中組件
│   │   │   ├── Navigation.tsx           # 導覽組件
│   │   │   ├── AccountSidebar.tsx        # 帳號側邊欄組件
│   │   │   └── ui/                      # shadcn/ui 組件
│   │   │       └── [28 個組件文件]     # shadcn/ui 組件庫
│   │   ├── lib/                # 工具函數
│   │   │   ├── api.ts          # API 調用封裝
│   │   │   └── utils.ts        # 通用工具函數
│   │   └── hooks/              # React Hooks
│   │       └── use-mobile.ts   # 行動裝置檢測 Hook
│   ├── tailwind.config.js      # Tailwind 主題配置（ES 模組）
│   ├── vite.config.ts          # Vite 配置（TypeScript）
│   ├── eslint.config.js        # ESLint 配置（ES 模組）
│   ├── components.json         # shadcn/ui 配置文件
│   ├── tsconfig.json           # TypeScript 配置
│   ├── tsconfig.app.json       # TypeScript 應用配置
│   ├── tsconfig.node.json      # TypeScript Node 配置
│   ├── package.json            # 包含 "type": "module"
│   └── README.md               # 前端說明文檔
├── model/                      # AI 模型
│   ├── CNN/                    # CNN 模型
│   │   ├── CNN_v1.0_20251204/   # CNN v1.0 模型
│   │   │   └── best_mobilenetv3_large.pth
│   │   └── CNN_v1.1_20251210/   # CNN v1.1 模型
│   │       └── best_mobilenetv3_large.pth
│   ├── SR/                     # 超解析度模型（可選）
│   │   └── model_pytorch/
│   │       ├── EDSR_x2.pt      # EDSR 2x 模型
│   │       ├── EDSR_x3.pt      # EDSR 3x 模型
│   │       ├── EDSR_x4.pt      # EDSR 4x 模型
│   │       └── MDSR.pt         # MDSR 模型
│   └── yolov11/                # YOLO 模型
│       ├── best_v1_50.pt       # 預設 YOLO 模型（可通過環境變數配置）
│       └── YOLOv11_v1_20251212/ # YOLO v1 訓練結果
│           └── weights/
│               └── best.pt
├── scripts/                    # 腳本文件（預留目錄）
├── tests/                      # 測試文件（預留）
│   ├── __init__.py
│   └── README.md
├── uploads/                    # 上傳圖片暫存（自動創建）
├── .env.example                # 環境變數範例
├── .gitignore                  # Git 忽略文件
├── .railwayignore              # Railway 部署忽略文件
├── .dockerignore               # Docker 構建忽略文件
├── requirements.txt            # Python 依賴
├── package.json                # 根目錄 package.json
├── Dockerfile                  # Docker 多階段構建配置
├── Procfile                    # Heroku/Railway 啟動配置
├── railway.json                # Railway 部署配置
├── start.sh                    # 應用啟動腳本（資料庫初始化 + Gunicorn）
├── railway-init.sh             # Railway 資料庫初始化腳本
├── RAILWAY_DEPLOYMENT.md       # Railway 部署快速指南
└── README.md                   # 專案說明文檔
```

## 主要功能說明

### 整合檢測流程（CNN + YOLO）

系統採用兩階段檢測流程：

1. **階段 0：超解析度預處理**（可選）

    - 使用 EDSR 模型增強圖片解析度（2x、4x、8x）
    - 提高檢測準確度

2. **階段 1：CNN 分類**

    - 使用 MobileNetV3-Large 模型進行圖片分類
    - 分類結果：`pepper_bell`, `potato`, `tomato`, `whole_plant`, `others`

3. **階段 2：分流邏輯**

    - **路徑 A**：如果是 `pepper_bell`, `potato`, `tomato` → 執行 YOLO 檢測
    - **路徑 B**：如果是 `whole_plant` → 提示使用者裁切（最多 3 次）
    - **路徑 C**：如果是 `others` → 返回非植物影像錯誤

4. **階段 3：YOLO 檢測**（僅在路徑 A 執行）

    - 使用 YOLOv11 模型進行病害檢測
    - 生成帶檢測框的圖片（不包含文字標籤）
    - 返回病害名稱、置信度、邊界框等資訊

5. **階段 4：結果儲存**
    - 儲存到 `prediction_log` 表（完整檢測流程記錄）
    - 儲存到 `detection_records` 表（使用者檢測歷史）
    - 上傳圖片到 Cloudinary（原始圖片和帶框圖片）

### 圖片處理與儲存

系統支援完整的圖片處理流程：

-   **圖片上傳方式**：

    -   文件選擇（拖放或點擊）
    -   相機拍攝（支援前後相機切換）
    -   圖片庫選擇

-   **圖片處理**：

    -   驗證圖片格式和大小（最大 5MB）
    -   Resize 到標準尺寸（640x640）
    -   計算 SHA256 hash（用於檢測重複和快取）

-   **原始圖片儲存**：上傳到 Cloudinary 的 `leaf_disease_ai/origin` 資料夾
-   **帶框圖片生成**：當 YOLO 檢測到病害時，自動生成帶檢測框的圖片
    -   只顯示檢測框，不顯示文字標籤
    -   框線寬度為 2 像素
    -   使用 YOLO 模型的 `predict().plot()` 方法生成
-   **帶框圖片儲存**：上傳到 Cloudinary 的 `leaf_disease_ai/predictions` 資料夾
-   **資料庫記錄**：
    -   `prediction_log.image_path`：存儲原始圖片的 Cloudinary URL
    -   `prediction_log.predict_img_url`：存儲帶框圖片的 Cloudinary URL
    -   `detection_records.original_image_url`：原始圖片 URL
    -   `detection_records.annotated_image_url`：帶框圖片 URL
-   **前端顯示**：檢測結果頁面會同時顯示兩張圖片（桌面版並排，手機版上下排列）

### 圖片裁切功能

-   **觸發條件**：CNN 分類結果為 `whole_plant`
-   **裁切流程**：
    1. 顯示裁切介面（使用 `react-cropper`）
    2. 使用者調整裁切區域（初始為圖片中心 80%）
    3. 確認裁切
    4. 發送裁切後的圖片到 `/api/predict-crop`
    5. 重新執行檢測流程
-   **裁切次數限制**：最多 3 次
    -   第 1 次：提示「檢測到整株植物圖片，請裁切出葉片區域進行檢測」
    -   第 2-3 次：提示「第 X/3 次裁切，請重新裁切葉片區域」
    -   第 3 次後仍為 `whole_plant`：強制設置為 `others`，顯示錯誤訊息

### Redis 快取

系統使用 Redis 進行以下快取：

-   **使用者統計資料**：快取 5 分鐘（使用 Flask-Caching）
-   **檢測結果**：快取 1 小時（基於圖片 hash 和使用者 ID）
-   **登入嘗試限制**：防止暴力破解（5 分鐘過期）

如果 Redis 未安裝或無法連接，系統會自動降級：

-   Flask-Caching 使用簡單記憶體快取
-   檢測結果快取失效（仍可正常檢測）
-   登入嘗試限制失效（仍可正常登入）

### Swagger API 文檔

所有 API 端點都有完整的 Swagger 文檔，包括：

-   請求參數說明
-   回應格式範例
-   錯誤碼說明
-   線上測試功能

### 日誌系統

系統提供完整的日誌記錄功能：

-   **活動日誌** (`activity_logs`)：使用者操作記錄（登入、登出、上傳、檢測等）
-   **錯誤日誌** (`error_logs`)：系統錯誤記錄（包含錯誤堆疊和上下文資訊）
-   **審計日誌** (`audit_logs`)：管理員操作記錄（角色分配、帳戶停用等）
-   **API 日誌** (`api_logs`)：API 請求記錄（執行時間、狀態碼、錯誤訊息）
-   **性能日誌** (`performance_logs`)：性能指標記錄（執行時間、記憶體使用、CPU 使用率）

### API 端點

#### 認證相關

-   `POST /register` - 使用者註冊
-   `POST /login` - 使用者登入
-   `GET/POST /logout` - 使用者登出
-   `GET /check-auth` - 檢查登入狀態

#### 使用者相關

-   `GET /user/profile` - 獲取個人資料
-   `POST /user/change-password` - 修改密碼
-   `POST /user/update-profile` - 更新個人資料（使用者名稱）
-   `GET /user/stats` - 獲取統計資料（快取 5 分鐘）

#### 檢測相關

-   `POST /api/predict` - 整合檢測（CNN + YOLO，快取）
    -   支援超解析度預處理（可選）
    -   返回結果包含 `image_path`（原始圖片 URL）和 `predict_img_url`（帶框圖片 URL）
    -   原始圖片上傳到 Cloudinary 的 `leaf_disease_ai/origin` 資料夾
    -   帶框圖片上傳到 Cloudinary 的 `leaf_disease_ai/predictions` 資料夾
    -   返回完整的檢測結果（CNN 結果、YOLO 結果、病害資訊等）
-   `POST /api/predict-crop` - 裁切後重新檢測
    -   支援 `crop_count` 參數（追蹤裁切次數，最多 3 次）
    -   同樣返回原始圖片和帶框圖片的 URL
    -   支援超解析度預處理（可選）
-   `POST /predict` - 舊版檢測端點（向後兼容，建議使用 `/api/predict`）
-   `GET /history` - 獲取檢測歷史（支援分頁、排序、過濾）
    -   支援分頁：`page`, `per_page`（每頁最多 100 筆）
    -   支援排序：`order_by`（created_at, confidence, disease_name, severity）, `order_dir`（ASC, DESC）
    -   支援過濾：`disease`（病害名稱，不區分大小寫），`min_confidence`（最小置信度）
    -   自動查詢病害詳細資訊（`disease_library` 表）
-   `DELETE /history/delete` - 刪除檢測記錄（單筆或批量）

## 開發說明

### 後端開發

-   **配置**：使用 `config.development.DevelopmentConfig`
-   **資料庫**：PostgreSQL，連接資訊在 `.env` 中設定
-   **快取**：Redis（可選），配置在 `.env` 中設定
-   **AI 模型**：
    -   CNN：MobileNetV3-Large（預設：`model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth`）
    -   YOLO：YOLOv11（預設：`model/yolov11/best_v1_50.pt`）
    -   超解析度：EDSR（可選，預設：`model/SR/model_pytorch/EDSR_x2.pt`）
-   **圖片儲存**：Cloudinary（推薦）或本地文件系統
-   **日誌系統**：活動日誌、錯誤日誌、API 日誌、性能日誌

### 前端開發

-   **框架**：Vite 7.2.4 dev server + React 19.2.0 + React Router + Tailwind CSS 4.x + TypeScript
-   **路由**：使用 React Router DOM 7.10.1 實現 URL 路由，支援瀏覽器導航和路由守衛
-   **樣式**：使用 Tailwind CSS 4.1.18 + PostCSS 8.5.6，主題配置在 `frontend/tailwind.config.js`
-   **UI 組件庫**：shadcn/ui（基於 Radix UI），採用灰階配色方案
-   **配置檔案**：
    -   `tsconfig.json`：TypeScript 主配置
    -   `tsconfig.app.json`：TypeScript 應用配置
    -   `tsconfig.node.json`：TypeScript Node 配置
    -   `eslint.config.js`：ESLint 代碼檢查配置
    -   `vite.config.ts`：Vite 建置配置（TypeScript）
-   **響應式設計**：支援手機（底部導覽列）、平板、桌面（頂部導覽列）三種佈局
-   **頁面結構**：使用 `pages/` 目錄組織頁面組件，`components/` 目錄存放共用組件
-   **模組系統**：使用 ES 模組（`"type": "module"`），所有配置檔案使用 ES 模組語法
-   **列印功能**：使用 `react-to-print` 實現 PDF 列印功能，支援 A4 格式、自動等待圖片載入、優化列印樣式（黑白列印、移除背景色、確保文字可見）
-   **圖片裁切**：使用 `react-cropper` 實現圖片裁切功能，支援最多 3 次裁切嘗試

## 注意事項

1. **本地開發**：確保 PostgreSQL 和 Redis 服務已啟動
2. **生產部署**：專案已配置 Railway 部署，支援生產環境運行
3. 模型檔案需要存在：
    - **CNN 模型**：預設 `model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth`（可通過環境變數 `CNN_MODEL_PATH_RELATIVE` 配置）
    - **YOLO 模型**：預設 `model/yolov11/best_v1_50.pt`（可通過環境變數 `YOLO_MODEL_PATH_RELATIVE` 配置）
    - **超解析度模型**（可選）：預設 `model/SR/model_pytorch/EDSR_x2.pt`（可通過環境變數 `SR_MODEL_PATH_RELATIVE` 配置）
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
CNN_MODEL_PATH_RELATIVE=model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
YOLO_MODEL_PATH_RELATIVE=model/yolov11/YOLOv11_v1_20251212/weights/best.pt
SR_MODEL_PATH_RELATIVE=model/SR/model_pytorch/EDSR_x4.pt
SR_SCALE=4  # 4x 放大
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
    - 確認 `src/main.tsx` 導入 `./index.css`
    - 確認 `tsconfig.json`、`tsconfig.app.json` 和 `tsconfig.node.json` 配置正確

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

前端使用 **React 19.2.0** + **Vite 7.2.4** + **Tailwind CSS 4.1.18** + **TypeScript 5.9.3** 作為核心技術棧：

-   **React 19.2.0**：最新版本的 React 框架
-   **Vite 7.2.4**：快速的前端建置工具，提供 HMR（熱模組替換）
-   **React Router DOM 7.10.1**：路由管理，支援瀏覽器導航
-   **TypeScript 5.9.3**：型別安全的 JavaScript 超集

#### Tailwind CSS 4.x

前端使用 **Tailwind CSS 4.1.18** 作為樣式框架：

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
    -   詳細使用指南請參考 `frontend/README.md`

-   **配置檔案**：

    -   `tsconfig.json`：TypeScript 主配置
    -   `tsconfig.app.json`：TypeScript 應用配置
    -   `tsconfig.node.json`：TypeScript Node 配置
    -   `eslint.config.js`：ESLint 代碼檢查配置（ES 模組格式）
    -   `vite.config.ts`：Vite 建置配置（TypeScript）
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

## 部署

### Railway 部署

專案已配置 Railway 部署支援，使用 Dockerfile 進行多階段構建：

-   **Dockerfile**：多階段構建配置（前端 + 後端）
-   **部署配置**：`railway.json` - Railway 部署配置（使用 Dockerfile）
-   **啟動腳本**：`start.sh` - 應用啟動腳本（資料庫初始化 + Gunicorn）
-   **初始化腳本**：`railway-init.sh` - 資料庫自動初始化
-   **生產配置**：`config/production.py` - 生產環境配置
-   **.dockerignore**：排除不必要的文件以減少構建時間

**部署流程**：

1. **構建階段**（Dockerfile 多階段構建）：
   - **階段 1 - 前端構建**：
     - 使用 Node.js 20 Alpine 構建前端
     - 安裝依賴並構建 React 應用
     - 清理構建時不需要的文件
   - **階段 2 - 後端構建**：
     - 使用 Python 3.11 Slim 基礎映像
     - 分階段安裝 Python 依賴（利用構建緩存）
     - 使用 CPU 版本的 PyTorch（更小更快）
     - 只複製必要的模型文件（CNN v1.1 和 YOLO v1）
     - 從前端構建階段複製構建產物

2. **部署階段**：
   - 執行 `start.sh` 啟動腳本
   - `railway-init.sh` 自動初始化資料庫（如果尚未初始化）
   - 啟動 Gunicorn WSGI 服務器

詳細部署指南請參考：
-   **快速指南**：`RAILWAY_DEPLOYMENT.md` - Railway 部署快速參考
-   **完整文檔**：`docs/railway_deployment.md` - Railway 部署詳細文檔

### 本地開發

此專案支援本地端開發和生產環境部署：

-   **開發環境**：使用 `config/development.py`，支援熱重載和調試
-   **生產環境**：使用 `config/production.py`，優化性能和安全性

## 文檔

專案提供完整的架構文檔：

-   **後端架構**：`docs/backend.md` - 後端完整架構與檔案功能說明
-   **前端架構**：`docs/frontend.md` - 前端完整架構與檔案功能說明
-   **資料庫架構**：`docs/database.md` - 資料庫完整架構與表結構說明
-   **序列圖**：`docs/sequences_diagram.md` - 系統主要流程的序列圖
-   **Railway 部署**：`docs/railway_deployment.md` - Railway 部署詳細指南

## 版本資訊

-   **版本**: 2.1.0
-   **模式**: 本地端開發 + Railway 生產部署
-   **前端框架**: React 19.2.0 + React Router DOM 7.10.1 + Vite 7.2.4 + Tailwind CSS 4.1.18 + shadcn/ui + TypeScript 5.9.3 + PostCSS 8.5.6
-   **前端工具**: ESLint 9.39.1 + TypeScript 5.9.3
-   **UI 組件庫**: shadcn/ui（灰階配色方案）
-   **後端框架**: Flask + PostgreSQL + Redis（可選）
-   **AI 模型**:
    -   **CNN**: MobileNetV3-Large（預設：`CNN_v1.0_20251204/best_mobilenetv3_large.pth`，可通過環境變數配置）
    -   **YOLO**: YOLOv11（預設：`best_v1_50.pt`，可通過環境變數配置）
    -   **超解析度**: EDSR（可選，預設：`EDSR_x2.pt`，可通過環境變數配置）
-   **主要功能**:
    -   ✅ 整合檢測流程（CNN + YOLO 兩階段檢測）
    -   ✅ 超解析度預處理（可選，使用 EDSR 模型）
    -   ✅ 智能圖片裁切（支援最多 3 次裁切嘗試）
    -   ✅ 帶檢測框的圖片生成（只顯示框，不顯示文字標籤）
    -   ✅ 原始圖片和帶框圖片分別存儲在 Cloudinary 的不同資料夾
    -   ✅ 前端同時顯示原始圖片和帶框圖片
    -   ✅ 完整的歷史記錄功能（分頁、排序、過濾、批量刪除）
    -   ✅ PDF 列印功能（使用 react-to-print，支援 A4 格式列印）
    -   ✅ 多種圖片上傳方式（文件上傳、相機拍攝、圖片庫選擇）
    -   ✅ 響應式設計（手機、平板、桌面三種佈局）
    -   ✅ TypeScript 完整支援
    -   ✅ 完整的日誌系統（活動、錯誤、API、性能日誌）
-   **部署支援**:
    -   ✅ Dockerfile 多階段構建（前端 + 後端）
    -   ✅ 構建優化（CPU 版 PyTorch、分階段安裝、映像大小優化）
    -   ✅ Railway 部署配置（railway.json, Dockerfile, start.sh, railway-init.sh）
    -   ✅ 生產環境配置（config/production.py）
    -   ✅ 前端靜態文件服務（生產環境 SPA 路由）
    -   ✅ Gunicorn WSGI 服務器配置
    -   ✅ 自動資料庫初始化
    -   ✅ 模型文件優化（只包含預設使用的模型：CNN v1.1 和 YOLO v1）
-   **最後更新**: 2025-12-17
-   **部署優化**: 
    -   使用 Dockerfile 替代 NIXPACKS，確保同時安裝 Node.js 和 Python
    -   優化構建速度和映像大小（CPU 版 PyTorch、分階段安裝）
    -   更新模型路徑為 CNN v1.1 和 YOLO v1
    -   創建啟動腳本 start.sh 確保容器正確啟動
