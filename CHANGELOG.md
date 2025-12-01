# 版本控制

## [1.0.0] - 2025-11-28

### ✨ 新增

- **核心功能**

  - 用戶註冊與登入系統（基於郵箱+密碼）
  - 密碼複雜度驗證（長度、大小寫、數字）
  - YOLOv11 實時病害檢測引擎
  - 檢測歷史記錄保存
  - 用戶隔離的檢測記錄管理

- **前端界面**

  - 現代化認證頁面（登入/註冊切換）
  - 響應式應用主界面
  - 圖像預覽功能
  - 檢測結果模態框
  - 歷史紀錄卡片展示
  - Bootstrap 5 美化 UI

- **API 端點**

  - `/register` - 用戶註冊
  - `/login` - 用戶登入
  - `/logout` - 用戶登出
  - `/check-auth` - 檢查認證狀態
  - `/predict` - 圖像預測
  - `/history` - 檢測歷史查詢

- **安全特性**
  - Werkzeug 密碼加密
  - 基於 Session 的認證
  - 用戶資料隔離
  - Base64 圖像傳輸

### 🔧 技術棧

- Flask 3.0+ 後端框架
- YOLOv11 物體檢測模型
- Bootstrap 5.3 前端框架
- JSON 資料存儲
- Gunicorn WSGI 伺服器

### 📁 項目結構

```
Leaf_Disease_AI/
├── app.py                  # 主應用程式
├── requirements.txt        # 依賴列表
├── templates/index.html    # 前端模板
├── static/script.js        # 前端邏輯
├── yolov11/best.pt        # 模型檔案
└── data/                  # 數據存儲
```

- **帳號中心功能**

  - 用戶個人資料查看
  - 密碼修改功能
  - 檢測統計與病害分布展示
  - 登入/登出時間記錄

- **病害詳細信息系統**

  - disease_info.json 數據庫集成
  - 6 種作物病害詳細信息配置
  - 病害原因、症狀、防治方案展示
  - 農藥防治建議與用量指導
  - 田間管理措施說明

### 📖 文檔

- README.md - 完整使用指南
- API 文檔 - 9 個 API 端點說明
- 快速開始 - 安裝和運行步驟

### 🔜 計劃功能

- [ ] 資料庫集成（PostgreSQL）
- [ ] 用戶資料管理介面
- [ ] 批量圖像處理
- [ ] 結果數據導出（CSV/Excel）
- [ ] 檢測統計分析
- [ ] 郵件通知系統
- [ ] API 文檔（Swagger）
- [ ] 單元測試框架
- [ ] CI/CD 管道
- [ ] 多語言支持
- [ ] 更多作物病害類型
- [ ] 實時通知系統

### 📋 集成驗收

#### 後端集成 (app.py)

- ✅ 載入 disease_info.json 數據庫
- ✅ 根據檢測病害名稱查詢病害信息
- ✅ 在 JSON 響應中返回 disease_info 字段
- ✅ 帳號管理 API 端點 (/user/profile, /user/change-password, /user/stats)

#### 前端 HTML 模板 (templates/index.html)

- ✅ 病害詳細信息容器 (diseaseDetailContainer) - 淺綠色背景
- ✅ 病因顯示區域 (modalDiseaseCode)
- ✅ 症狀特徵顯示區域 (modalDiseaseFeature)
- ✅ 農藥防治列表 (modalPesticideList)
- ✅ 管理措施列表 (modalManagementList)
- ✅ 帳號中心頁面 (profilePage) - 個人資訊、密碼修改、統計數據

#### 前端 JavaScript 邏輯 (static/script.js)

- ✅ 接收並處理 disease_info 數據
- ✅ 條件檢查 disease_info 存在性
- ✅ 動態生成農藥和管理措施列表
- ✅ 帳號功能函數 (showPage, loadUserProfile, loadUserStats, changePassword)

#### 支持的病害列表 (disease_info.json)

1. Tomato_early_blight - 番茄早疫病
2. Tomato_late_blight - 番茄晚疫病
3. Tomato_bacterial_spot - 番茄細菌性斑點病
4. Potato_early_blight - 馬鈴薯早疫病
5. Potato_late_blight - 馬鈴薯晚疫病
6. Bell_pepper_bacterial_spot - 甜椒細菌性斑點病

### 🔜 計劃功能

- JSON 存儲不適合生產環境
- Secret key 需要在生產環境中更改
- 未實現用戶資料刪除功能
- 不支持圖像批量上傳

### 🚀 部署

- 開發環境：`python app.py`
- 生產環境：Gunicorn + Nginx
- 容器化：Docker/Docker Compose 配置已提供

---

## 後續版本計劃

### [1.1.0] - 計劃中

- 資料庫集成
- 用戶管理後台
- 更多檢測模型支持

### [2.0.0] - 計劃中

- 行動應用版本
- 云端同步
- 高級分析功能

## [1.0.1] - 2025-12-01

### 🐞 修正

- 修正 YOLOv11 檢測模型路徑錯誤，確保模型能正確載入
- 優化 disease_info.json 數據結構，提升查詢效率
- 修正前端圖像預覽在 Safari 下的顯示問題
- 修正部分 API 回傳格式不一致（/predict, /history）
- 修正密碼修改 API 的驗證邏輯

### ✨ 優化

- 增加檢測記錄分頁查詢功能，提升大數據量下的效能
- 前端 dashboard 新增病害分布統計圖表
- 強化 session 安全性，增加過期自動登出
- 優化 Dockerfile，減少映像檔大小
- 補充 README.md 快速啟動指引

### 🔧 技術棧

- 升級 Flask 至 3.0.2
- 升級 Bootstrap 至 5.3.2
- 新增 pandas 依賴（用於統計分析）

### 📖 文檔

- 更新 API 文檔，補充 /user/change-password、/history 分頁參數
- 新增 CI/CD 配置說明

### 🚀 部署

- 新增 docker-compose.yml 範例，支援一鍵啟動

---
