# Leaf Disease AI

一個使用 YOLOv11 進行葉片病害檢測的 Flask Web 應用程式。

## 專案概述

本專案使用深度學習模型（YOLOv11）來檢測和分類植物葉片上的病害。使用者可以透過 Web 介面上傳圖像，系統會自動進行病害預測並保存檢測歷史記錄。

## 主要功能

- 👤 **使用者管理**：使用者可以註冊和登入帳戶
- 🖼️ **圖像上傳與預測**：上傳植物葉片圖像進行實時病害檢測
- 📊 **檢測歷史**：查看過往的檢測結果和預測記錄
- 🔒 **安全認證**：採用密碼加密存儲使用者資訊

## 技術堆棧

- **後端**：Python Flask
- **機器學習**：YOLOv11（Object Detection）
- **前端**：HTML5 + JavaScript
- **資料存儲**：JSON 檔案
- **部署**：Gunicorn

## 專案結構

```
Leaf_Disease_AI/
├── app.py                 # Flask 應用主程式
├── requirements.txt       # 依賴套件
├── templates/
│   └── index.html        # 前端介面
├── static/
│   └── script.js         # 前端邏輯
├── yolov11/
│   └── best.pt           # 預訓練模型
└── data/
    ├── users.json        # 使用者資料
    └── records.json      # 檢測記錄
```

## 安裝與使用

### 前置需求

- Python 3.8+
- pip

### 安裝步驟

1. 複製專案：

```bash
git clone <repository-url>
cd Leaf_Disease_AI
```

2. 安裝依賴：

```bash
pip install -r requirements.txt
```

3. 運行應用：

```bash
python app.py
```

4. 打開瀏覽器訪問：

```
http://localhost:5000
```

## 使用指南

1. **註冊帳戶**：填入郵箱和密碼進行註冊
2. **登入**：使用已註冊的帳戶登入
3. **上傳圖像**：選擇植物葉片圖像進行預測
4. **查看結果**：系統會顯示檢測結果和置信度
5. **檢查歷史**：查看過去的所有檢測記錄

## API 端點

| 方法 | 端點        | 描述         |
| ---- | ----------- | ------------ |
| POST | `/register` | 使用者註冊   |
| POST | `/login`    | 使用者登入   |
| POST | `/logout`   | 使用者登出   |
| POST | `/predict`  | 圖像病害預測 |
| GET  | `/history`  | 獲取檢測歷史 |

## 開發分支

目前在 `fix` 分支進行開發。

## 注意事項

- 使用 JSON 檔案存儲資料，適合本地開發和演示
- 建議在生產環境中遷移至專業資料庫（如 PostgreSQL）
- 模型檔案 `best.pt` 需要單獨下載或訓練

## 許可證

待定

## 聯絡方式

如有問題或建議，歡迎提出 Issue 或 Pull Request。
