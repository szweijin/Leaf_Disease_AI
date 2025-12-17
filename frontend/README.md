# Leaf Disease AI - Frontend

Leaf Disease AI 前端應用程式，使用 React 19 + TypeScript + Vite 7 + Tailwind CSS 4.x 構建。

## 技術棧

- **React 19.2.0** - UI 框架
- **TypeScript 5.9.3** - 型別安全
- **Vite 7.2.4** - 建置工具和開發服務器
- **React Router DOM 7.10.1** - 路由管理
- **Tailwind CSS 4.1.18** - 樣式框架
- **shadcn/ui** - UI 組件庫（灰階配色方案）
- **PostCSS 8.5.6** - CSS 處理
- **ESLint 9.39.1** - 代碼檢查

## 快速開始

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

開發服務器會在 `http://localhost:5173` 啟動。

### 生產構建

```bash
npm run build
```

構建後的檔案會在 `dist/` 目錄中。

## 專案結構

```
frontend/
├── src/
│   ├── pages/              # 頁面組件
│   │   ├── LoginPage.tsx   # 登入/註冊頁面
│   │   ├── HomePage.tsx    # 首頁（檢測功能）
│   │   ├── HistoryPage.tsx # 歷史記錄頁面
│   │   ├── AccountPage.tsx # 個人資料頁面
│   │   └── PredictPage.tsx # 預測結果頁面
│   ├── components/         # 共用組件
│   │   ├── ui/             # shadcn/ui 組件
│   │   └── ...             # 其他組件
│   ├── lib/                # 工具函數
│   │   ├── api.ts          # API 調用封裝
│   │   └── utils.ts        # 通用工具函數
│   └── hooks/              # React Hooks
│       └── use-mobile.ts   # 行動裝置檢測
├── public/                 # 靜態資源
├── dist/                   # 構建輸出
└── package.json           # 專案配置
```

## 主要功能

- ✅ 使用者認證（登入、註冊、登出）
- ✅ 病害檢測（上傳圖片、相機拍攝、圖片裁切）
- ✅ 檢測結果顯示（原始圖片 + 帶框圖片）
- ✅ 歷史記錄（分頁、排序、過濾、刪除）
- ✅ 個人資料管理（修改密碼、更新使用者名稱）
- ✅ 響應式設計（手機、平板、桌面）
- ✅ PDF 列印功能

## 配置

### TypeScript

- `tsconfig.json` - 主配置
- `tsconfig.app.json` - 應用配置
- `tsconfig.node.json` - Node 配置

### Tailwind CSS

- `tailwind.config.js` - Tailwind 主題配置（ES 模組格式）
- `postcss.config.js` - PostCSS 配置

### Vite

- `vite.config.ts` - Vite 配置（TypeScript）

### ESLint

- `eslint.config.js` - ESLint 配置（ES 模組格式）

### shadcn/ui

- `components.json` - shadcn/ui 配置

## 開發說明

### 路由結構

- `/` - 根據登入狀態重定向
- `/login` - 登入/註冊頁面
- `/home` - 首頁（檢測功能）
- `/history` - 歷史記錄頁面
- `/account` - 個人資料頁面

### API 配置

API 基礎 URL 在 `src/lib/api.ts` 中配置：

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
```

### 環境變數

創建 `.env.local` 文件（可選）：

```bash
VITE_API_BASE_URL=http://localhost:5000
```

## 生產部署

### Railway 部署

專案已配置 Railway 部署支援：

1. **構建**：`build.sh` 會自動構建前端
2. **服務**：後端會自動服務前端靜態文件（生產環境）
3. **路由**：SPA 路由由後端處理（所有路由返回 `index.html`）

### 手動部署

1. 構建前端：
   ```bash
   npm run build
   ```

2. 將 `dist/` 目錄部署到靜態文件服務器

3. 配置服務器支援 SPA 路由（所有路由返回 `index.html`）

## 詳細文檔

- **前端架構**：`../docs/frontend.md` - 完整的前端架構文檔
- **專案總覽**：`../README.md` - 專案總體說明

## 注意事項

1. **ES 模組**：`package.json` 包含 `"type": "module"`，所有配置使用 ES 模組語法
2. **shadcn/ui**：使用灰階配色方案，組件配置在 `components.json` 中
3. **響應式設計**：支援手機（底部導覽列）、平板、桌面（頂部導覽列）三種佈局
4. **TypeScript**：所有組件和工具函數都使用 TypeScript 編寫
