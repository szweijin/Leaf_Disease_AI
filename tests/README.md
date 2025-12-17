# 測試目錄

此目錄用於存放測試文件。

## 版本資訊

-   **專案版本**：2.1.0
-   **文檔版本**：1.0
-   **最後更新**：2024-12

---

## 目錄結構

```
tests/
├── __init__.py
├── unit/              # 單元測試
│   ├── test_core/     # 核心模組測試
│   ├── test_services/ # 服務層測試
│   └── test_modules/  # AI 模組測試
├── integration/       # 整合測試
│   ├── test_api/      # API 端點測試
│   └── test_e2e/      # 端到端測試
└── fixtures/          # 測試數據和固定裝置
```

## 運行測試

```bash
# 運行所有測試
pytest

# 運行特定測試
pytest tests/unit/test_core/

# 運行並顯示覆蓋率
pytest --cov=backend --cov-report=html

# 運行並顯示詳細輸出
pytest -v

# 運行並在失敗時停止
pytest -x
```

## 測試環境配置

### 環境變數

創建 `.env.test` 文件（測試環境配置）：

```env
FLASK_ENV=testing
DATABASE_URL=postgresql://user:password@localhost:5432/leaf_disease_ai_test
REDIS_URL=redis://localhost:6379/1
SECRET_KEY=test-secret-key
```

### 測試資料庫

測試使用獨立的測試資料庫，確保不會影響開發或生產資料：

```bash
# 創建測試資料庫
createdb leaf_disease_ai_test

# 初始化測試資料庫
psql -U postgres -d leaf_disease_ai_test -f database/init_database.sql
```

## 測試類型

### 單元測試

測試單個函數或類的功能：

```bash
# 運行所有單元測試
pytest tests/unit/

# 運行特定模組的單元測試
pytest tests/unit/test_core/
```

### 整合測試

測試多個組件之間的交互：

```bash
# 運行所有整合測試
pytest tests/integration/

# 運行 API 端點測試
pytest tests/integration/test_api/
```

### 端到端測試

測試完整的用戶流程：

```bash
# 運行端到端測試
pytest tests/integration/test_e2e/
```

## 測試覆蓋率

生成測試覆蓋率報告：

```bash
# 生成 HTML 覆蓋率報告
pytest --cov=backend --cov-report=html

# 查看覆蓋率報告
open htmlcov/index.html
```

## 注意事項

1. **測試資料庫**：確保使用獨立的測試資料庫，避免影響開發資料
2. **環境變數**：測試環境應使用獨立的環境變數配置
3. **模型文件**：測試時可能需要模擬模型加載，避免加載大型模型文件
4. **外部服務**：測試時應模擬外部服務（如 Cloudinary、Redis），避免實際調用

## 相關文檔

-   [後端架構文檔](../docs/backend.md)
-   [資料庫架構文檔](../docs/database.md)
-   [專案總體說明](../README.md)
