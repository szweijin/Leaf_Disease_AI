# 🌿 Leaf Disease AI

以 YOLOv11 深度學習模型為核心的植物葉片病害檢測 Web 應用，支援多用戶帳號、病害資料查詢、檢測歷史、統計分析與現代化前端。

![Python](https://img.shields.io/badge/Python-3.8+-3776ab?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0+-000000?style=flat-square&logo=flask)
![YOLOv11](https://img.shields.io/badge/YOLOv11-Latest-00457C?style=flat-square&logo=yolo)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3+-7952B3?style=flat-square&logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 目錄

- [🌿 Leaf Disease AI](#-leaf-disease-ai)
  - [目錄](#目錄)
  - [專案簡介](#專案簡介)
  - [主要功能](#主要功能)
  - [技術架構](#技術架構)
  - [快速開始](#快速開始)
  - [API 端點（摘要）](#api-端點摘要)
  - [檔案結構與用途](#檔案結構與用途)
  - [部署建議](#部署建議)
  - [❓ 常見問題](#-常見問題)
    - [Q: 模型檔案 `best.pt` 在哪裡下載？](#q-模型檔案-bestpt-在哪裡下載)
    - [Q: 密碼錯誤或忘記怎麼辦？](#q-密碼錯誤或忘記怎麼辦)
    - [Q: 上傳的圖像存儲在哪裡？](#q-上傳的圖像存儲在哪裡)
    - [Q: 如何刪除檢測記錄？](#q-如何刪除檢測記錄)
    - [Q: 支援哪些圖像格式？](#q-支援哪些圖像格式)
    - [Q: 檢測速度如何？](#q-檢測速度如何)
  - [🤝 貢獻指南](#-貢獻指南)
  - [📄 許可證](#-許可證)
  - [📧 聯絡方式](#-聯絡方式)

## 專案簡介

Leaf Disease AI 提供即時植物病害檢測、病害資料查詢、檢測歷史管理與統計分析。後端採用 Flask 3.0+，前端以 Bootstrap 5 打造響應式 UI，核心模型為 YOLOv11。支援多用戶帳號、密碼安全、Session 認證，並可容器化部署。

**適用場景**：農業監測、農技診斷、教學演示、研究數據採集。

## 主要功能

- 用戶註冊、登入、密碼修改、Session 認證
- 圖像上傳與 YOLOv11 病害檢測（類型、置信度、嚴重度）
- 檢測歷史查詢、分頁、統計分析
- 病害詳細資料查詢（病因、症狀、防治、管理措施）
- 前端響應式 UI、病害分布圖表
- 多層日誌系統（activity/error/audit/api/performance）

## 技術架構

- 後端：Flask 3.0+
- 機器學習：YOLOv11
- 前端：Bootstrap 5.3+、HTML5、JavaScript (ES6+)
- 密碼安全：Werkzeug
- 資料存儲：JSON（計劃支援 PostgreSQL）
- 伺服器：Gunicorn
- 容器化：Docker / Docker Compose

## 快速開始

1. 複製並進入專案目錄
   ```bash
   git clone <repository-url>
   cd Leaf_Disease_AI
   ```
2. 安裝依賴
   ```bash
   pip install -r requirements.txt
   ```
3. 驗證模型檔案
   ```bash
   ls -la data/models/yolov11/best.pt
   ```
4. 初始化資料目錄
   ```bash
   mkdir -p data/static/uploads data/models
   ```
5. 啟動應用
   ```bash
   python src/app.py
   # 或生產環境
   gunicorn -w 4 -b 0.0.0.0:5000 src.app:app
   ```
6. 訪問 http://localhost:5000

## API 端點（摘要）

- `POST /register`：用戶註冊
- `POST /login`：用戶登入
- `GET /logout`：登出
- `GET /check-auth`：檢查認證
- `GET /user/profile`：取得個人資料
- `POST /user/change-password`：修改密碼
- `GET /user/stats`：檢測統計
- `POST /predict`：圖像病害檢測
- `GET /history`：檢測歷史查詢

## 檔案結構與用途

```
Leaf_Disease_AI/
│
├── src/                          # 【核心源碼】應用程式的核心邏輯
│   ├── __init__.py               # 將 src 標示為 Python 套件
│   ├── app.py                    # Flask 應用主入口，整合路由與配置
│   ├── core/                     # 核心模組，處理資料庫與使用者驗證
│   │   ├── __init__.py
│   │   ├── db_manager.py         # 資料庫連線與操作管理
│   │   └── user_manager.py       # 使用者帳戶與 Session 管理
│   ├── models/                   # 資料庫模型定義 (若使用 ORM)
│   │   └── __init__.py
│   ├── routes/                   # API 路由定義，劃分不同功能的端點
│   │   └── __init__.py
│   ├── services/                 # 服務層，處理具體業務邏輯
│   │   └── __init__.py           # 圖像辨識、資料處理、統計分析等
│   └── utils/                    # 通用工具函數，如格式轉換、日誌記錄
│       └── __init__.py
│
├── frontend/                     # 【前端資源】使用者介面相關檔案
│   ├── templates/                # HTML 模板檔案 (Jinja2)
│   │   ├── index.html            # 首頁
│   │   ├── admin/                # 管理員頁面
│   │   ├── auth/                 # 登入/註冊頁面
│   │   └── dashboard/            # 使用者儀表板
│   └── static/                   # 靜態資源
│       ├── script.js             # 主要 JavaScript 邏輯
│       ├── css/                  # CSS 樣式表
│       ├── js/                   # 其他 JavaScript 模組
│       ├── images/               # 圖片資源
│       │   └── icons/            # 圖標集合
│       └── uploads/              # 使用者上傳的圖像暫存目錄
│
├── data/                         # 【數據與模型】應用所需的資料與 AI 模型
│   ├── disease_info.json         # 病害詳細資料 (病名、症狀、防治)
│   ├── records.json              # 檢測歷史記錄 (開發用)
│   ├── users.json                # 使用者資料 (開發用)
│   ├── seed/                     # 初始化資料種子檔
│   │   └── disease_info.json     # 預設病害資料
│   ├── logs/                     # 應用程式日誌檔
│   │   └── *.log                 # activity, error, audit, api, performance 日誌
│   └── models/                   # AI 模型儲存目錄
│       └── yolov11/              # YOLOv11 模型相關檔案
│           └── best.pt           # 預訓練的模型權重檔
│
├── config/                       # 【環境配置】不同環境的設定檔
│   ├── __init__.py
│   ├── base.py                   # 基礎通用設定 (資料庫路徑、日誌配置等)
│   ├── development.py            # 開發環境專用設定 (Debug 模式)
│   └── production.py             # 生產環境專用設定 (高效能設定)
│
├── database/                     # 【資料庫】資料庫相關腳本
│   ├── init_database.sql         # 資料庫初始化腳本 (表結構、索引、字段)
│   ├── migrations/               # 資料庫遷移腳本 (版本升級)
│   ├── queries/                  # 常用的 SQL 查詢範本
│   └── backup/                   # 資料庫備份檔
│
├── deploy/                       # 【部署配置】用於生產環境部署的設定檔
│   ├── docker/                   # Docker 容器化相關
│   │   └── Dockerfile            # Docker 映像定義檔
│   ├── docker-compose/           # Docker Compose 編排配置
│   │   └── docker-compose.yml    # 多容器部署定義
│   ├── kubernetes/               # Kubernetes 部署配置 (可選)
│   ├── nginx/                    # Nginx 反向代理伺服器設定
│   │   └── ssl/                  # SSL 憑證 (生產環境)
│   ├── ci-cd/                    # 持續整合/持續部署管道設定
│   └── scripts/                  # 部署自動化腳本
│
├── docs/                         # 【專案文件】詳細的設計與說明文件
│   ├── DATABASE_DESIGN.md        # 資料庫架構詳細說明
│   ├── IMPLEMENTATION_GUIDE.md   # 實作指南
│   ├── PROJECT_STRUCTURE.md      # 專案結構說明
│   ├── ARCHIVE_PLAN.md           # 檔案歸檔計畫
│   ├── usermap.mmd               # 使用者流程圖 (Mermaid)
│   └── diagrams/                 # 系統設計圖表
│
├── tests/                        # 【自動化測試】確保程式碼品質
│   ├── fixtures/                 # 測試資料與 fixture 集合
│   └── integration/              # 整合測試
│
├── requirements/                 # 【依賴管理】分層的 Python 套件需求
│   ├── base.txt                  # 基礎依賴 (所有環境通用)
│   ├── dev.txt                   # 開發環境依賴 (測試工具、偵錯工具等)
│   └── prod.txt                  # 生產環境依賴 (高效能、監控工具等)
│
├── local/                        # 【本地開發工具】本地開發與測試工具
│   ├── Makefile                  # 本地開發命令集
│   └── README_LOCAL.md           # 本地開發說明
│
├── env/                          # 【環境變數】敏感資訊存儲 (勿提交至 git)
│
├── .vscode/                      # VS Code 工作區設定
├── .git/                         # Git 版本控制目錄
├── .gitignore                    # Git 忽略清單
├── CHANGELOG.md                  # 版本歷史與更新日誌
├── CONTRIBUTING.md               # 貢獻指南
├── LICENSE                       # MIT 許可證
├── requirements.txt              # 主要依賴檔案 (簡易安裝)
└── README.md                     # 專案入口說明文件 (本檔案)
```

## 部署建議

- 開發：`python src/app.py`
- 生產：`gunicorn -w 4 -b 0.0.0.0:5000 src.app:app`
- 容器化：參考 `deploy/docker/`、`docker-compose/`
- 建議使用 PostgreSQL 取代 JSON 作為正式資料庫
- 機密資訊請放置於 `env/`，勿提交至 git

## ❓ 常見問題

### Q: 模型檔案 `best.pt` 在哪裡下載？

A: 模型檔案是經過訓練的 YOLOv11 模型。請確保 `data/models/yolov11/best.pt` 已存在。若無，則需自行訓練或尋找預訓練模型。

### Q: 密碼錯誤或忘記怎麼辦？

A: 註冊時請遵循密碼規則（至少 8 字元、含大小寫字母與數字）。當前版本尚未支援密碼重設功能。

### Q: 上傳的圖像存儲在哪裡？

A: 圖像暫時存儲在 `frontend/static/uploads/`，並以 UUID 重新命名以避免衝突。

### Q: 如何刪除檢測記錄？

A: 目前版本不支援從介面刪除記錄。若為測試資料，可手動編輯 `data/records.json`。

### Q: 支援哪些圖像格式？

A: 支援常見的網頁圖像格式，如 JPG, PNG, GIF。

### Q: 檢測速度如何？

A: 檢測速度依賴於伺服器硬體配置。在 GPU 環境下，單張圖像的處理時間通常在 1-2 秒內。

## 🤝 貢獻指南

我們歡迎任何形式的貢獻！您可以：

- 回報問題 (Issue)
- 提交功能請求 (Pull Request)
- 協助改善文檔

請參考 `CONTRIBUTING.md` 了解詳細的貢獻流程。

```bash
# 簡易流程範例
git checkout -b feature/your-awesome-feature
git commit -am 'Add some feature'
git push origin feature/your-awesome-feature
```

## 📄 許可證

本專案採用 MIT 許可證。詳情請參閱 [LICENSE](LICENSE) 檔案。

## 📧 聯絡方式

- **回報問題**: [GitHub Issues](https://github.com/szweijin/Leaf_Disease_AI/issues)
- **功能建議**: 提交 Pull Request 或開啟 Issue 討論

---

**最後更新**：2025-12-01
**當前版本**：1.0.1
**開發分支**：fix
