# 啟動腳本說明

本目錄包含用於啟動 Leaf Disease AI 本地開發環境的腳本。

## 腳本列表

### 核心腳本

1. **`load_env.sh`** - 載入環境變數

    - 載入 `.env` 文件中的環境變數
    - 檢查必要的環境變數
    - 生成 SECRET_KEY（如果未設定）
    - 被其他腳本引用使用

2. **`start_database.sh`** - 資料庫初始化和檢查

    - 檢查 PostgreSQL 連線
    - 如果資料庫不存在，可以初始化資料庫
    - 用法：
        ```bash
        ./scripts/start_database.sh        # 檢查資料庫連線
        ./scripts/start_database.sh init   # 初始化資料庫
        ```

3. **`start_backend.sh`** - 啟動後端服務

    - 檢查資料庫和 Redis 連線
    - 啟動 Flask 後端服務（端口 5000）
    - 等待後端完全啟動
    - 用法：
        ```bash
        ./scripts/start_backend.sh
        ```

4. **`start_frontend.sh`** - 啟動前端服務
    - 檢查並安裝前端依賴
    - 啟動 Vite 開發服務器（端口 5173）
    - 支援快速啟動模式
    - 用法：
        ```bash
        ./scripts/start_frontend.sh        # 正常啟動
        ./scripts/start_frontend.sh fast    # 快速啟動（強制重新構建依賴）
        ```

### 整合腳本

5. **`start.sh`** - 主啟動腳本（同時啟動所有服務）

    - 載入環境變數
    - 檢查並初始化資料庫
    - 啟動後端服務
    - 啟動前端服務
    - 用法：
        ```bash
        ./scripts/start.sh
        ```

6. **`stop_all.sh`** - 停止所有服務
    - 停止後端服務（端口 5000）
    - 停止前端服務（端口 5173）
    - 清理所有相關進程
    - 用法：
        ```bash
        ./scripts/stop_all.sh
        ```

## 使用方式

### 方式一：分別啟動服務（推薦用於開發）

```bash
# 1. 初始化資料庫（首次使用或需要重置時）
./scripts/start_database.sh init

# 2. 啟動後端（在一個終端窗口）
./scripts/start_backend.sh

# 3. 啟動前端（在另一個終端窗口）
./scripts/start_frontend.sh
# 或使用快速啟動模式
./scripts/start_frontend.sh fast
```

### 方式二：同時啟動所有服務

```bash
# 啟動所有服務（後端和前端）
./scripts/start.sh
```

### 停止服務

```bash
# 停止所有服務
./scripts/stop_all.sh

# 或手動停止
# 停止後端
pkill -f "python.*app.py"
lsof -ti:5000 | xargs kill -9

# 停止前端
pkill -f "vite"
lsof -ti:5173 | xargs kill -9
```

## 服務地址

啟動成功後，可以訪問：

-   **後端 API**: http://localhost:5000
-   **Swagger 文檔**: http://localhost:5000/api-docs
-   **前端應用**: http://localhost:5173

## 日誌文件

-   後端日誌: `/tmp/flask-startup.log` 或 `/tmp/backend.log`
-   前端日誌: `/tmp/vite-startup.log` 或 `/tmp/frontend.log`

查看日誌：

```bash
tail -f /tmp/flask-startup.log  # 後端日誌
tail -f /tmp/vite-startup.log    # 前端日誌
```

## 故障排除

### 端口被佔用

如果端口 5000 或 5173 已被佔用，腳本會提示是否要停止現有進程。也可以手動停止：

```bash
# 查看端口佔用
lsof -ti:5000
lsof -ti:5173

# 停止佔用端口的進程
lsof -ti:5000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### 資料庫未初始化

如果資料庫不存在，執行：

```bash
./scripts/start_database.sh init
```

### 前端依賴問題

如果前端啟動失敗，嘗試清理並重新安裝：

```bash
cd frontend
rm -rf node_modules package-lock.json .vite
npm install
./scripts/start_frontend.sh
```

### 後端啟動失敗

檢查後端日誌：

```bash
cat /tmp/flask-startup.log
```

確認：

1. 資料庫已初始化
2. `.env` 文件配置正確
3. Python 依賴已安裝

## 注意事項

1. 所有腳本都需要在專案根目錄執行，或使用 `./scripts/` 前綴
2. 確保 `.env` 文件已正確配置
3. 首次啟動時，資料庫需要初始化
4. 前端首次啟動可能較慢（需要構建依賴緩存）
5. 使用 `start_frontend.sh fast` 可以強制重新構建依賴緩存
