# Frontend 架構文檔

## 專案概述

Leaf Disease AI Frontend 是一個基於 React + TypeScript + Vite 的現代化前端應用程式，提供植物葉片病害檢測的使用者介面。

### 主要功能

-   **使用者認證**：登入、註冊、登出
-   **病害檢測**：上傳圖片、相機拍攝、圖片裁切、AI 檢測結果顯示
-   **歷史記錄**：檢測歷史查詢、分頁、排序、過濾、刪除、列印
-   **個人資料**：查看個人資訊、修改密碼、更新使用者名稱
-   **響應式設計**：支援桌面版和手機版，自適應佈局

---

## 目錄結構

```
frontend/
├── public/                          # 靜態資源
│   ├── background.png
│   ├── LOGO_Horizontal.png
│   ├── LOGO_only.png
│   ├── LOGO_V.png
│   └── vite.svg
│
├── src/                             # 應用程式源碼
│   ├── main.tsx                     # 應用程式入口
│   ├── App.tsx                      # 根組件（路由配置）
│   ├── App.css                      # 應用程式樣式
│   ├── index.css                    # 全局樣式
│   │
│   ├── pages/                       # 頁面組件
│   │   ├── LoginPage.tsx            # 登入/註冊頁面
│   │   ├── HomePage.tsx             # 首頁（桌面版歡迎頁面）
│   │   ├── PredictPage.tsx          # 病害檢測頁面
│   │   ├── HistoryPage.tsx           # 歷史記錄頁面
│   │   └── AccountPage.tsx           # 個人資料頁面
│   │
│   ├── components/                   # 組件
│   │   ├── AppLayout.tsx            # 應用程式佈局（導覽列 + 內容區）
│   │   ├── ProtectedRoute.tsx       # 路由保護組件
│   │   ├── ResponsiveNavbar.tsx     # 響應式導覽列
│   │   ├── AccountSidebar.tsx      # 帳號側邊欄（桌面版）
│   │   ├── CameraView.tsx           # 相機視圖組件
│   │   ├── ImageCropper.tsx         # 圖片裁切組件
│   │   ├── LeafDetectionView.tsx    # 檢測結果顯示組件
│   │   ├── Loading.tsx              # 載入中組件
│   │   ├── PrintButton.tsx          # 列印按鈕組件
│   │   │
│   │   └── ui/                      # UI 組件庫（shadcn/ui）
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── pagination.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── sonner.tsx           # Toast 通知組件
│   │       └── ... (其他 UI 組件)
│   │
│   ├── lib/                          # 工具函數庫
│   │   ├── api.ts                   # API 請求工具
│   │   └── utils.ts                 # 通用工具函數
│   │
│   ├── hooks/                       # 自定義 Hooks
│   │   └── use-mobile.ts            # 檢測是否為手機版
│   │
│   └── assets/                       # 資源檔案
│       └── react.svg
│
├── dist/                            # 建置輸出目錄
├── node_modules/                    # 依賴套件
│
├── package.json                     # 專案配置和依賴
├── package-lock.json                # 依賴鎖定檔案
├── vite.config.ts                   # Vite 配置
├── tsconfig.json                    # TypeScript 配置
├── tsconfig.app.json                # TypeScript 應用程式配置
├── tsconfig.node.json               # TypeScript Node 配置
├── tailwind.config.js               # Tailwind CSS 配置
├── eslint.config.js                 # ESLint 配置
├── components.json                   # shadcn/ui 配置
├── index.html                       # HTML 入口檔案
└── README.md                        # 專案說明
```

---

## 技術棧

### 核心框架

-   **React 19.2.0**：UI 框架
-   **TypeScript 5.9.3**：型別安全
-   **Vite 7.2.4**：建置工具和開發伺服器

### 路由

-   **react-router-dom 7.10.1**：客戶端路由

### UI 框架

-   **Tailwind CSS 4.1.18**：原子化 CSS 框架
-   **shadcn/ui**：基於 Radix UI 的組件庫
-   **Radix UI**：無障礙 UI 元件庫
-   **Framer Motion 12.23.26**：動畫庫
-   **Lucide React 0.561.0**：圖標庫

### 功能庫

-   **Sonner 2.0.7**：Toast 通知
-   **react-cropper 2.1.3**：圖片裁切
-   **react-to-print 3.2.0**：列印功能
-   **html2pdf.js 0.12.1**：PDF 生成

### 開發工具

-   **ESLint**：程式碼檢查
-   **TypeScript ESLint**：TypeScript 程式碼檢查

---

## 核心檔案說明

### 1. main.tsx

**功能**：應用程式入口點

**主要內容**：

-   使用 `StrictMode` 啟用 React 嚴格模式
-   使用 `BrowserRouter` 包裹應用程式以啟用路由
-   渲染 `App` 組件

### 2. App.tsx

**功能**：根組件，定義路由和認證狀態管理

**主要功能**：

-   **認證狀態管理**：
    -   `isAuthenticated`：是否已登入
    -   `userEmail`：使用者 Email
    -   `checkingAuth`：是否正在檢查認證狀態
-   **路由配置**：
    -   `/login`：登入/註冊頁面（獨立佈局）
    -   `/`：根目錄重定向（桌面版 → `/home`，手機版 → `/login`）
    -   `/home`：首頁（桌面版歡迎頁面，公開）
    -   `/predict`：病害檢測頁面（需要認證）
    -   `/history`：歷史記錄頁面（需要認證）
    -   `/account`：個人資料頁面（需要認證）
    -   `*`：404 頁面
-   **認證檢查**：
    -   應用程式啟動時檢查認證狀態
    -   使用 `/check-auth` API 端點
    -   2 秒超時保護
-   **事件處理**：
    -   `handleLoggedIn()`：處理登入成功
    -   `handleLogout()`：處理登出

**路由保護**：

-   使用 `ProtectedRoute` 組件保護需要認證的路由
-   未登入時自動重定向到 `/login`

### 3. lib/api.ts

**功能**：API 請求工具函數

**主要函數**：

-   `apiFetch(url, options)`：統一的 API 請求函數
    -   自動處理 base URL（從環境變數 `VITE_API_BASE_URL` 讀取，預設 `http://localhost:5000`）
    -   自動設置 `Content-Type: application/json`
    -   自動包含 cookies（`credentials: "include"`）
    -   支援 AbortSignal（請求取消）

**使用範例**：

```typescript
const res = await apiFetch("/api/predict", {
    method: "POST",
    body: JSON.stringify({ image: base64Data }),
});
```

### 4. lib/utils.ts

**功能**：通用工具函數

**主要函數**：

-   `cn(...inputs)`：合併 Tailwind CSS 類名（使用 `clsx` 和 `tailwind-merge`）
-   `validatePassword(password)`：驗證密碼複雜度（與後端規則一致）
    -   至少 8 個字符
    -   至少 1 個大寫字母 (A-Z)
    -   至少 1 個小寫字母 (a-z)
    -   至少 1 個數字 (0-9)
-   `getPasswordRequirements()`：獲取密碼要求說明文字
-   `parseUnicode(str)`：解析 Unicode 轉義序列為中文字符
-   `parseUnicodeInObject(obj)`：遞歸解析對象中的所有字符串

---

## 頁面組件 (pages)

### 1. LoginPage.tsx

**功能**：登入/註冊頁面

**主要功能**：

-   **登入模式**：
    -   Email 和密碼登入
    -   記住帳號功能（localStorage）
    -   保持登入選項
    -   顯示/隱藏密碼切換
-   **註冊模式**：
    -   Email、密碼、使用者名稱（可選）註冊
    -   密碼複雜度驗證（前端驗證）
    -   註冊成功後自動切換回登入模式
-   **表單驗證**：
    -   Email 格式驗證
    -   密碼複雜度驗證
    -   錯誤訊息顯示
-   **狀態管理**：
    -   `isLogin`：是否為登入模式
    -   `email`、`password`、`username`：表單欄位
    -   `rememberEmail`、`keepLoggedIn`：選項狀態
    -   `showPassword`：密碼可見性

### 2. HomePage.tsx

**功能**：首頁（桌面版歡迎頁面）

**主要功能**：

-   **桌面版**：
    -   顯示歡迎訊息和功能介紹
    -   提供快速開始按鈕
    -   已登入時自動重定向到 `/predict`
-   **手機版**：
    -   自動重定向到 `/login`
-   **動畫效果**：
    -   使用 Framer Motion 實現淡入動畫

### 3. PredictPage.tsx

**功能**：病害檢測頁面

**主要功能**：

-   **圖片上傳方式**：
    -   文件選擇（拖放或點擊）
    -   相機拍攝
    -   圖片庫選擇
-   **檢測流程**：
    -   上傳圖片 → 執行檢測 → 顯示結果
    -   如果需要裁切 → 顯示裁切介面 → 重新檢測
    -   支援最多 3 次裁切嘗試
-   **狀態管理**：
    -   `mode`：當前模式（idle, camera, processing, result, crop）
    -   `image`：當前圖片（Base64）
    -   `result`：檢測結果
    -   `cropCount`：裁切次數（1-3）
-   **檢測結果處理**：
    -   解析 Unicode 轉義序列
    -   處理 `need_crop` 狀態（顯示裁切介面）
    -   處理 `not_plant` 狀態（顯示錯誤訊息）
    -   處理 `yolo_detected` 狀態（顯示檢測結果）
-   **圖片處理**：
    -   支援拖放上傳
    -   支援相機拍攝
    -   支援圖片裁切（使用 `ImageCropper` 組件）

### 4. HistoryPage.tsx

**功能**：歷史記錄頁面

**主要功能**：

-   **記錄查詢**：
    -   分頁支援（每頁 12 筆，可調整）
    -   排序支援（按時間、置信度、病害名稱、嚴重程度）
    -   過濾支援（按病害類型、最小置信度）
-   **記錄顯示**：
    -   卡片式佈局
    -   顯示原始圖片和帶框圖片
    -   顯示病害資訊（中文名稱、症狀、防治措施等）
    -   顯示檢測時間、置信度、嚴重程度
-   **記錄操作**：
    -   查看詳細資訊（彈出對話框）
    -   刪除記錄（單筆或批量）
    -   列印記錄（使用 `PrintButton` 組件）
-   **批量操作**：
    -   選擇模式（多選記錄）
    -   批量刪除
-   **UI 功能**：
    -   滾動到頂部按鈕
    -   響應式佈局（桌面版和手機版）
    -   載入狀態顯示
    -   空狀態顯示

### 5. AccountPage.tsx

**功能**：個人資料頁面

**主要功能**：

-   **個人資料顯示**：
    -   Email
    -   使用者名稱（暱稱）
    -   帳號創建時間
    -   最後登入時間
-   **修改密碼**：
    -   舊密碼驗證
    -   新密碼複雜度驗證
    -   確認密碼驗證
    -   顯示/隱藏密碼切換
-   **更新個人資料**：
    -   更新使用者名稱（暱稱）
    -   檢查使用者名稱是否已被使用
-   **登出功能**：
    -   登出按鈕
    -   清除本地儲存資料

---

## 組件 (components)

### 1. AppLayout.tsx

**功能**：應用程式佈局組件

**主要內容**：

-   使用 `ResponsiveNavbar` 顯示導覽列
-   使用 `Outlet` 渲染子路由
-   使用 Framer Motion 實現頁面切換動畫
-   響應式佈局（手機版底部導覽列，桌面版頂部導覽列）

### 2. ProtectedRoute.tsx

**功能**：路由保護組件

**主要功能**：

-   檢查認證狀態
-   未登入時顯示 Loading 並重定向到 `/login`
-   已登入時渲染子組件或 `Outlet`

### 3. ResponsiveNavbar.tsx

**功能**：響應式導覽列

**主要功能**：

-   **桌面版**：
    -   頂部水平導覽列
    -   Logo 顯示
    -   導覽項目（PREDICT, HISTORY, ACCOUNT）
    -   帳號側邊欄（點擊 ACCOUNT 打開）
-   **手機版**：
    -   底部固定導覽列
    -   圖標 + 文字標籤
    -   響應式佈局
-   **導覽項目**：
    -   `/predict`：病害檢測
    -   `/history`：歷史記錄
    -   `/account`：個人資料

### 4. AccountSidebar.tsx

**功能**：帳號側邊欄（桌面版）

**主要功能**：

-   顯示使用者 Email
-   顯示帳號資訊
-   登出按鈕
-   使用 shadcn/ui Sidebar 組件

### 5. CameraView.tsx

**功能**：相機視圖組件

**主要功能**：

-   訪問設備相機（前置/後置）
-   實時預覽
-   拍攝照片
-   切換前後相機
-   計算正確的裁切區域（考慮 object-cover 效果）
-   自動清理相機資源

### 6. ImageCropper.tsx

**功能**：圖片裁切組件

**主要功能**：

-   使用 `react-cropper` 實現圖片裁切
-   初始裁切區域設置為圖片中心 80%
-   支援裁切次數追蹤（最多 3 次）
-   根據裁切次數顯示不同提示訊息
-   裁切完成後返回 Base64 圖片和座標

### 7. LeafDetectionView.tsx

**功能**：檢測結果顯示組件

**主要功能**：

-   **圖片顯示**：
    -   原始圖片
    -   帶檢測框圖片（如果有）
    -   響應式佈局（桌面版並排，手機版堆疊）
-   **檢測結果顯示**：
    -   病害名稱（中文名稱優先）
    -   置信度
    -   嚴重程度
    -   CNN 分類結果
    -   YOLO 檢測結果（如果有）
-   **病害資訊顯示**：
    -   中文名稱、英文名稱
    -   病因、特徵、症狀
    -   防治措施、農藥建議
    -   目標作物、嚴重程度等級
    -   預防提示、參考連結
-   **操作按鈕**：
    -   重新檢測
    -   查看歷史記錄
    -   列印結果（使用 `PrintButton` 組件）

### 8. Loading.tsx

**功能**：載入中組件

**主要功能**：

-   顯示載入動畫
-   自訂載入訊息
-   可選顯示使用者名稱和歡迎訊息

### 9. PrintButton.tsx

**功能**：列印按鈕組件

**主要功能**：

-   使用 `react-to-print` 實現列印功能
-   支援列印樣式自訂
-   支援 PDF 生成（使用 `html2pdf.js`）
-   列印優化（隱藏不需要的元素）

---

## UI 組件庫 (components/ui)

基於 **shadcn/ui** 的組件庫，使用 **Radix UI** 作為底層實現。

### 主要組件

-   **Button**：按鈕組件
-   **Card**：卡片組件
-   **Input**：輸入框組件
-   **Label**：標籤組件
-   **Dialog**：對話框組件
-   **Select**：下拉選單組件
-   **Pagination**：分頁組件
-   **Badge**：徽章組件
-   **Alert**：警告組件
-   **Toast (Sonner)**：通知組件
-   **Sidebar**：側邊欄組件
-   **Skeleton**：骨架屏組件
-   **Separator**：分隔線組件
-   **Popover**：彈出框組件
-   **Tooltip**：工具提示組件
-   **Checkbox**：複選框組件
-   **Switch**：開關組件
-   **Progress**：進度條組件

所有組件都支援：

-   無障礙功能（ARIA）
-   響應式設計
-   深色模式（可選）
-   自訂樣式（Tailwind CSS）

---

## Hooks

### use-mobile.ts

**功能**：檢測是否為手機版

**實現**：

-   使用 `window.matchMedia` 檢測螢幕寬度
-   斷點：768px（`MOBILE_BREAKPOINT`）
-   監聽視窗大小變化
-   返回布林值（`true` = 手機版，`false` = 桌面版）

**使用範例**：

```typescript
const isMobile = useIsMobile();
```

---

## 配置檔案

### 1. vite.config.ts

**功能**：Vite 建置工具配置

**主要配置**：

-   **插件**：
    -   `@vitejs/plugin-react`：React 支援
    -   `@tailwindcss/vite`：Tailwind CSS 支援
-   **路徑別名**：
    -   `@` → `./src`
-   **開發伺服器**：
    -   代理配置（將 API 請求代理到後端）
    -   HMR 配置
-   **優化**：
    -   預先打包依賴
    -   ESBuild 配置

### 2. tailwind.config.js

**功能**：Tailwind CSS 配置

**主要配置**：

-   內容掃描路徑
-   主題擴展（可選）
-   插件（可選）

### 3. tsconfig.json

**功能**：TypeScript 配置

**主要配置**：

-   編譯選項
-   路徑別名
-   模組解析

### 4. components.json

**功能**：shadcn/ui 配置

**主要配置**：

-   樣式：`new-york`
-   路徑別名
-   圖標庫：`lucide`
-   Tailwind CSS 配置

---

## 路由結構

### 公開路由

-   `/login`：登入/註冊頁面
-   `/home`：首頁（桌面版歡迎頁面）

### 受保護路由（需要認證）

-   `/predict`：病害檢測頁面
-   `/history`：歷史記錄頁面
-   `/account`：個人資料頁面

### 路由保護機制

1. **應用程式啟動時檢查認證狀態**：

    - 調用 `/check-auth` API
    - 設置 `isAuthenticated` 狀態

2. **路由保護**：

    - 使用 `ProtectedRoute` 組件包裹需要認證的路由
    - 未登入時顯示 Loading 並重定向到 `/login`

3. **認證狀態更新**：
    - 登入成功：設置 `isAuthenticated = true`
    - 登出：設置 `isAuthenticated = false`

---

## 狀態管理

### 應用程式級狀態（App.tsx）

-   `isAuthenticated`：認證狀態
-   `userEmail`：使用者 Email
-   `checkingAuth`：是否正在檢查認證狀態

### 頁面級狀態

每個頁面組件管理自己的狀態：

-   表單欄位狀態
-   載入狀態
-   錯誤狀態
-   資料狀態

### 本地儲存（localStorage）

-   `rememberedEmail`：記住的 Email
-   `userDisplayName`：使用者顯示名稱（username 或 email）

---

## API 整合

### API 端點

-   **認證**：

    -   `POST /login`：登入
    -   `POST /register`：註冊
    -   `GET /check-auth`：檢查認證狀態
    -   `GET/POST /logout`：登出

-   **使用者**：

    -   `GET /user/profile`：獲取個人資料
    -   `POST /user/change-password`：修改密碼
    -   `POST /user/update-profile`：更新個人資料
    -   `GET /user/stats`：獲取統計資料

-   **檢測**：

    -   `POST /api/predict`：整合檢測（CNN + YOLO）
    -   `POST /api/predict-crop`：裁切後重新檢測

-   **歷史記錄**：

    -   `GET /history`：獲取檢測歷史（支持分頁、排序、過濾）
    -   `DELETE /history/delete`：刪除檢測記錄

-   **圖片**：
    -   `GET /image/{record_id}`：獲取檢測記錄圖片
    -   `GET /image/prediction/{prediction_id}`：獲取預測記錄圖片

### API 請求處理

-   使用 `apiFetch` 統一處理 API 請求
-   自動處理錯誤和成功響應
-   使用 Toast 通知顯示錯誤和成功訊息
-   支援請求取消（AbortSignal）

---

## 響應式設計

### 斷點

-   **手機版**：< 768px
-   **桌面版**：≥ 768px

### 響應式策略

1. **導覽列**：

    - 桌面版：頂部水平導覽列
    - 手機版：底部固定導覽列

2. **佈局**：

    - 桌面版：寬屏佈局，多欄顯示
    - 手機版：單欄佈局，堆疊顯示

3. **圖片顯示**：

    - 桌面版：並排顯示（原始圖片 + 帶框圖片）
    - 手機版：堆疊顯示

4. **表單**：
    - 桌面版：較寬的表單欄位
    - 手機版：全寬表單欄位

### 檢測方法

使用 `useIsMobile` Hook 檢測設備類型：

```typescript
const isMobile = useIsMobile();
```

---

## 圖片處理流程

### 1. 圖片上傳

-   **文件選擇**：

    -   拖放上傳
    -   點擊選擇文件
    -   支援格式：jpg, jpeg, png, gif

-   **相機拍攝**：
    -   訪問設備相機
    -   實時預覽
    -   拍攝照片
    -   自動計算裁切區域

### 2. 圖片裁切

-   **觸發條件**：

    -   CNN 分類結果為 `whole_plant`
    -   後端返回 `final_status: "need_crop"`

-   **裁切流程**：

    1. 顯示裁切介面（`ImageCropper` 組件）
    2. 使用者調整裁切區域
    3. 確認裁切
    4. 發送裁切後的圖片到 `/api/predict-crop`
    5. 支援最多 3 次裁切嘗試

-   **裁切次數限制**：
    -   第 1 次裁切：提示「檢測到整株植物圖片，請裁切出葉片區域進行檢測」
    -   第 2-3 次裁切：提示「第 X/3 次裁切，請重新裁切葉片區域」
    -   第 3 次裁切後仍為 `whole_plant`：強制設置為 `others`，顯示錯誤訊息

### 3. 圖片顯示

-   **原始圖片**：

    -   從 `image_path` 或 `original_image_url` 獲取
    -   如果是 Cloudinary URL，直接使用
    -   響應式顯示（桌面版和手機版）

-   **帶框圖片**：
    -   從 `predict_img_url` 或 `annotated_image_url` 獲取
    -   顯示 YOLO 檢測框（不包含文字標籤）
    -   響應式顯示

---

## 檢測結果處理

### 結果狀態

1. **`yolo_detected`**：

    - 成功檢測到病害
    - 顯示檢測結果和病害資訊
    - 顯示原始圖片和帶框圖片

2. **`need_crop`**：

    - 需要裁切圖片
    - 顯示裁切介面
    - 支援最多 3 次裁切嘗試

3. **`not_plant`**：
    - 非植物影像
    - 顯示錯誤訊息
    - 提示使用者上傳植物葉片圖片

### 結果資料結構

```typescript
interface PredictionResult {
    status?: "success" | "error" | "need_crop";
    workflow?: string;
    prediction_id: string;
    cnn_result?: {
        mean_score?: number;
        best_class?: string;
        best_score?: number;
        all_scores?: Record<string, number>;
    };
    disease?: string;
    confidence?: number;
    severity?: string;
    final_status: "yolo_detected" | "need_crop" | "not_plant";
    image_path?: string;
    predict_img_url?: string;
    yolo_result?: {
        detected: boolean;
        detections?: Array<{
            class: string;
            confidence: number;
            bbox: number[];
        }>;
    };
    disease_info?: DiseaseInfo;
    crop_count?: number;
    max_crop_count?: number;
    processing_time_ms?: number;
    cnn_time_ms?: number;
    yolo_time_ms?: number;
}
```

---

## 歷史記錄功能

### 查詢功能

-   **分頁**：

    -   預設每頁 12 筆
    -   可調整每頁筆數
    -   顯示總頁數和當前頁

-   **排序**：

    -   按時間排序（`created_at`）
    -   按置信度排序（`confidence`）
    -   按病害名稱排序（`disease_name`）
    -   按嚴重程度排序（`severity`）
    -   升序/降序切換

-   **過濾**：
    -   按病害類型過濾（多選）
    -   按最小置信度過濾
    -   過濾條件可組合使用

### 記錄操作

-   **查看詳細資訊**：

    -   點擊記錄卡片
    -   彈出對話框顯示完整資訊
    -   顯示病害詳細資訊

-   **刪除記錄**：

    -   單筆刪除（點擊刪除按鈕）
    -   批量刪除（選擇模式）
    -   確認對話框

-   **列印記錄**：
    -   使用 `PrintButton` 組件
    -   支援列印和 PDF 生成
    -   列印樣式優化

### 記錄顯示

-   **卡片式佈局**：

    -   響應式網格佈局
    -   桌面版：3-4 欄
    -   手機版：1-2 欄

-   **資訊顯示**：
    -   病害名稱（中文名稱優先）
    -   置信度（百分比）
    -   嚴重程度（徽章顯示）
    -   檢測時間
    -   原始圖片和帶框圖片（縮圖）

---

## 表單驗證

### 密碼驗證

-   **前端驗證**（與後端規則一致）：

    -   至少 8 個字符
    -   至少 1 個大寫字母 (A-Z)
    -   至少 1 個小寫字母 (a-z)
    -   至少 1 個數字 (0-9)

-   **驗證時機**：
    -   註冊時：提交前驗證
    -   修改密碼時：提交前驗證
    -   即時顯示錯誤訊息

### Email 驗證

-   使用 HTML5 `type="email"` 驗證
-   後端驗證作為最終驗證

---

## 錯誤處理

### API 錯誤處理

-   **網路錯誤**：

    -   顯示 Toast 錯誤通知
    -   記錄錯誤到控制台

-   **API 錯誤響應**：
    -   解析錯誤訊息
    -   顯示使用者友好的錯誤訊息
    -   記錄錯誤到控制台

### 使用者輸入錯誤

-   **表單驗證錯誤**：
    -   即時顯示錯誤訊息
    -   使用 Toast 通知
    -   表單欄位高亮顯示

### 圖片處理錯誤

-   **圖片格式錯誤**：

    -   顯示錯誤訊息
    -   提示支援的格式

-   **圖片上傳失敗**：
    -   顯示錯誤訊息
    -   允許重新上傳

---

## 動畫效果

### 頁面切換動畫

-   使用 Framer Motion 實現
-   淡入淡出效果
-   垂直位移效果
-   動畫時長：200ms

### 組件動畫

-   Loading 動畫
-   按鈕懸停效果
-   卡片懸停效果
-   Toast 通知動畫

---

## 無障礙功能

### ARIA 支援

-   所有 UI 組件都支援 ARIA 屬性
-   鍵盤導航支援
-   螢幕閱讀器支援

### 鍵盤操作

-   Tab 鍵導航
-   Enter 鍵提交表單
-   Escape 鍵關閉對話框
-   方向鍵操作選單

---

## 性能優化

### 代碼分割

-   使用 `React.lazy()` 懶加載頁面組件
-   路由級別代碼分割
-   減少初始載入時間

### 圖片優化

-   使用 Base64 編碼傳輸
-   後端處理圖片壓縮
-   使用 Cloudinary CDN 加速

### 快取策略

-   API 響應快取（後端處理）
-   本地儲存快取（localStorage）
-   靜態資源快取（Vite 處理）

---

## 開發指南

### 環境變數

創建 `.env` 檔案：

```env
VITE_API_BASE_URL=http://localhost:5000
```

### 開發命令

```bash
# 啟動開發伺服器
npm run dev

# 快速啟動（強制重新載入）
npm run dev:fast

# 建置生產版本
npm run build

# 預覽生產版本
npm run preview

# 程式碼檢查
npm run lint
```

### 專案結構建議

-   **頁面組件**：放在 `src/pages/`
-   **可重用組件**：放在 `src/components/`
-   **UI 組件**：放在 `src/components/ui/`
-   **工具函數**：放在 `src/lib/`
-   **自定義 Hooks**：放在 `src/hooks/`

---

## 部署說明

### Railway 部署（推薦）

專案已配置 Railway 部署支援：

1. **構建**：`build.sh` 會自動構建前端
2. **服務**：後端會自動服務前端靜態文件（生產環境）
3. **路由**：SPA 路由由後端處理（所有路由返回 `index.html`）

詳細部署指南請參考：
- **快速指南**：`RAILWAY_DEPLOYMENT.md`
- **完整文檔**：`docs/railway_deployment.md`

### 建置生產版本

```bash
npm run build
```

建置輸出目錄：`dist/`

### 部署到靜態主機

1. 建置生產版本
2. 將 `dist/` 目錄內容上傳到靜態主機
3. 配置 API 代理（如果需要）

### 環境變數配置

在生產環境中，確保設置正確的 `VITE_API_BASE_URL`：

```env
VITE_API_BASE_URL=https://api.example.com
```

---

## 版本資訊

-   **專案版本**：2.1.0
-   **React**：19.2.0
-   **TypeScript**：5.9.3
-   **Vite**：7.2.4
-   **React Router**：7.10.1
-   **Tailwind CSS**：4.1.18

---

## 相關文檔

-   `docs/backend.md`：後端架構文檔
-   `docs/database.md`：資料庫架構文檔
-   `docs/sequences_diagram.md`：序列圖文檔
-   `docs/railway_deployment.md`：Railway 部署詳細文檔
-   `README.md`：專案總體說明

---

## 更新日誌

### v2.1.0

-   支援 Railway 生產環境部署
-   生產環境配置優化
-   自動資料庫初始化支援
-   前端構建流程優化

### v2.0.0

-   整合 CNN + YOLO 檢測流程
-   支援圖片裁切功能（最多 3 次）
-   支援相機拍攝
-   完整的歷史記錄功能（分頁、排序、過濾）
-   響應式設計（桌面版和手機版）
-   使用 shadcn/ui 組件庫
-   使用 Framer Motion 動畫
-   使用 Sonner Toast 通知
-   支援列印和 PDF 生成功能
