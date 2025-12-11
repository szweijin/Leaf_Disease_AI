# 測試目錄

此目錄用於存放測試文件。

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
```
