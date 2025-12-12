#!/bin/bash

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 切換到專案根目錄
cd "$PROJECT_ROOT" || exit 1

echo "🌿 啟動 Leaf Disease AI 本地開發環境..."

# 檢查環境變數檔案
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 檔案，將使用預設設定"
    echo "   建議創建 .env 檔案並設定資料庫和 Redis 連線資訊"
fi

# 載入環境變數（如果存在）- 安全地處理註釋和特殊字符
if [ -f ".env" ]; then
    # 使用 set -a 來自動導出變數
    set -a
    # 安全地載入 .env 文件，過濾註釋和空行
    while IFS= read -r line || [ -n "$line" ]; do
        # 跳過空行
        if [[ -z "$line" ]]; then
            continue
        fi
        # 跳過以 # 開頭的註釋行
        if [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        # 移除行尾的註釋（# 後面的內容），但保留值中的 #
        # 只移除行尾的註釋，不影響值本身
        if [[ "$line" =~ ^[^#]*=.*# ]]; then
            # 如果有 = 號，且 # 在 = 號之後，則移除 # 及其後面的內容
            line="${line%%[[:space:]]*#*}"
        fi
        # 移除前後空白
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        # 如果有等號且不是空值，則導出
        if [[ "$line" =~ = ]] && [[ -n "$line" ]]; then
            export "$line" 2>/dev/null || true
        fi
    done < .env
    set +a
fi

# 檢查必要的環境變數
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ 錯誤：缺少必要的資料庫環境變數"
    echo "   請在 .env 檔案中設定：DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

# 檢查 SECRET_KEY
if [ -z "$SECRET_KEY" ] || [ "$SECRET_KEY" = "your-secret-key-here" ] || [ "$SECRET_KEY" = "dev-secret-key" ]; then
    echo "⚠️  警告：SECRET_KEY 未設定或使用預設值"
    echo "   正在生成一個隨機 SECRET_KEY..."
    # 生成一個隨機的 SECRET_KEY（32 字元）
    GENERATED_SECRET=$(openssl rand -hex 32)
    export SECRET_KEY="$GENERATED_SECRET"
    echo "   ✅ 已生成 SECRET_KEY（僅本次啟動有效）"
    echo "   💡 建議：將以下內容添加到 .env 檔案中："
    echo "   SECRET_KEY=$GENERATED_SECRET"
    echo ""
fi

# Redis 設定（可選，有預設值）
export REDIS_HOST=${REDIS_HOST:-localhost}
export REDIS_PORT=${REDIS_PORT:-6379}

# 設定 Python 模組搜尋路徑
export PYTHONPATH="$PROJECT_ROOT"

# 檢查資料庫連線（添加超時，避免長時間等待）
echo "📊 檢查 PostgreSQL 連線..."
# 使用 PGPASSWORD 環境變數避免手動輸入密碼
export PGPASSWORD="$DB_PASSWORD"
# 使用後台進程和超時檢查（兼容 macOS）
(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1) &
PSQL_PID=$!
sleep 2
if kill -0 $PSQL_PID 2>/dev/null; then
    # 如果還在運行，表示連線超時或失敗
    kill $PSQL_PID 2>/dev/null
    DB_CHECK_FAILED=1
else
    wait $PSQL_PID 2>/dev/null
    DB_CHECK_FAILED=$?
fi

if [ "$DB_CHECK_FAILED" -ne 0 ]; then
    echo "⚠️  無法連接到資料庫 '$DB_NAME'"
    echo ""
    echo "   可能的原因："
    echo "   1. 資料庫不存在 - 請執行: python database/database_manager.py init"
    echo "      （會自動創建資料庫並執行完整初始化，包含所有表、視圖、函數、prediction_log 表、病害資訊資料）"
    echo "   2. PostgreSQL 服務未啟動"
    echo "   3. 連線資訊錯誤（檢查 .env 檔案）"
    echo ""
    echo "   後端仍會嘗試啟動，但可能會失敗"
    echo ""
    read -p "   是否要現在初始化資料庫？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 執行資料庫初始化..."
        echo "   （將創建資料庫並執行完整初始化腳本，包含所有內容）"
        python database/database_manager.py init
        if [ $? -eq 0 ]; then
            echo "✅ 資料庫初始化完成（包含所有表、視圖、函數、prediction_log 表、病害資訊資料）"
        else
            echo "❌ 資料庫初始化失敗"
        fi
    fi
else
    echo "✅ 資料庫連線正常"
fi

# 檢查 Redis 連線（添加超時，避免長時間等待）
echo "🔴 檢查 Redis 連線..."
# 使用後台進程和超時檢查（兼容 macOS）
(redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1) &
REDIS_PID=$!
sleep 1
if kill -0 $REDIS_PID 2>/dev/null; then
    # 如果還在運行，表示連線超時或失敗
    kill $REDIS_PID 2>/dev/null
    REDIS_CHECK_FAILED=1
else
    wait $REDIS_PID 2>/dev/null
    REDIS_CHECK_FAILED=$?
fi

if [ "$REDIS_CHECK_FAILED" -eq 0 ]; then
    echo "✅ Redis 連線正常"
else
    echo "⚠️  Redis 未啟動或無法連接，將不使用快取功能"
    echo "   建議安裝並啟動 Redis: brew install redis && brew services start redis"
fi

# 創建必要的目錄
mkdir -p uploads
mkdir -p data/logs

# 啟動後端
echo "🚀 啟動 Flask 後端..."
cd "$PROJECT_ROOT/backend" || exit 1
python app.py > /tmp/flask-startup.log 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_ROOT" || exit 1

# 等待後端啟動並驗證
echo "⏳ 等待後端啟動..."
BACKEND_READY=0
MAX_WAIT=10
CHECK_INTERVAL=1  # 改為整數，避免算術運算錯誤

for i in $(seq 1 $MAX_WAIT); do
    sleep $CHECK_INTERVAL
    # 檢查進程是否還在運行
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "   ❌ 後端進程已停止"
        if [ -f /tmp/flask-startup.log ]; then
            echo "   📋 後端啟動日誌："
            tail -20 /tmp/flask-startup.log | sed 's/^/      /'
        fi
        exit 1
    fi
    # 檢查端口是否被佔用
    if lsof -ti:5000 > /dev/null 2>&1; then
        # 檢查是否可以連接
        if curl -s http://localhost:5000/check-auth > /dev/null 2>&1; then
            BACKEND_READY=1
            echo "   ✅ 後端已成功啟動（等待了 ${i} 秒）"
            break
        fi
    fi
    # 每 2 秒顯示一次進度
    if [ $((i % 2)) -eq 0 ]; then
        echo "   ⏳ 仍在等待後端啟動... (${i}/${MAX_WAIT} 秒)"
    fi
done

if [ $BACKEND_READY -eq 0 ]; then
    echo "   ⚠️  後端可能未完全啟動，但進程仍在運行"
    echo "   💡 請檢查: curl http://localhost:5000/check-auth"
    if [ -f /tmp/flask-startup.log ]; then
        echo "   📋 後端啟動日誌："
        tail -10 /tmp/flask-startup.log | sed 's/^/      /'
    fi
fi

# 啟動前端（如果存在）
if [ -d "$PROJECT_ROOT/frontend" ]; then
    echo "🎨 啟動 React 前端（Tailwind CSS 3.x + shadcn/ui + PostCSS）..."
    cd "$PROJECT_ROOT/frontend" || exit 1
    
    # 首先清除可能存在的舊進程和端口佔用（優化：減少等待時間）
    echo "🧹 清理舊的前端進程..."
    PORT_5173_PID=$(lsof -ti:5173 2>/dev/null)
    if [ -n "$PORT_5173_PID" ]; then
        echo "   ⚠️  檢測到端口 5173 已被佔用 (PID: $PORT_5173_PID)"
        echo "   🔄 正在清除佔用端口的進程..."
        kill $PORT_5173_PID 2>/dev/null
        sleep 0.5  # 從 1 秒減少到 0.5 秒
        if kill -0 $PORT_5173_PID 2>/dev/null; then
            echo "   ⚠️  進程未響應，強制終止..."
            kill -9 $PORT_5173_PID 2>/dev/null
            sleep 0.5  # 從 1 秒減少到 0.5 秒
        fi
    fi
    
    # 清除所有 vite 和 npm 相關進程
    pkill -f "vite" 2>/dev/null
    pkill -f "npm run dev" 2>/dev/null
    sleep 0.5  # 從 1 秒減少到 0.5 秒
    
    # 確認端口已釋放
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo "   ⚠️  警告：端口 5173 仍被佔用，可能需要手動清除"
    else
        echo "   ✅ 端口 5173 已準備就緒"
    fi
    
    # 清除 Vite 快取和構建文件（優化：只在必要時清除）
    # 檢查是否需要清除（如果快取文件很大或很舊）
    if [ -d "node_modules/.vite" ] || [ -d "dist" ]; then
        echo "🧹 清除 Vite 快取和構建文件..."
        # 使用後台清除，不阻塞啟動流程
        (rm -rf node_modules/.vite dist 2>/dev/null && echo "   ✅ 已清除 Vite 快取和構建文件") &
        CLEANUP_PID=$!
    else
        echo "   ℹ️  無需清除（快取文件不存在）"
    fi
    
    # 檢查並安裝前端依賴
    echo "📦 檢查前端依賴..."
    
    # 檢查 node_modules 是否存在
    if [ ! -d "node_modules" ]; then
        echo "   📥 node_modules 不存在，正在安裝所有依賴..."
        npm install
        if [ $? -ne 0 ]; then
            echo "   ❌ 依賴安裝失敗，請檢查錯誤訊息"
            exit 1
        fi
        echo "   ✅ 依賴安裝完成"
    else
        # 檢查關鍵依賴是否存在
        MISSING_DEPS=0
        
        # 檢查生產依賴
        if [ ! -d "node_modules/react" ] || [ ! -d "node_modules/react-dom" ]; then
            echo "   ⚠️  React 依賴缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        if [ ! -d "node_modules/vite" ]; then
            echo "   ⚠️  Vite 依賴缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        if [ ! -d "node_modules/@vitejs/plugin-react" ]; then
            echo "   ⚠️  Vite React 插件缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        if [ ! -d "node_modules/tailwindcss" ]; then
            echo "   ⚠️  Tailwind CSS 缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        if [ ! -d "node_modules/postcss" ] || [ ! -d "node_modules/autoprefixer" ]; then
            echo "   ⚠️  PostCSS 或 Autoprefixer 缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        # 檢查 Radix UI 依賴（shadcn/ui 需要）
        if [ ! -d "node_modules/@radix-ui" ]; then
            echo "   ⚠️  Radix UI 依賴缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        if [ ! -d "node_modules/react-router-dom" ]; then
            echo "   ⚠️  React Router 缺失，正在重新安裝..."
            MISSING_DEPS=1
        fi
        
        if [ $MISSING_DEPS -eq 1 ]; then
            echo "   🔄 正在重新安裝所有依賴..."
            npm install
            if [ $? -ne 0 ]; then
                echo "   ❌ 依賴安裝失敗，請檢查錯誤訊息"
                exit 1
            fi
            echo "   ✅ 依賴重新安裝完成"
        else
            echo "   ✅ 所有依賴已正確安裝"
        fi
    fi
    
    # 驗證關鍵依賴
    echo "   🔍 驗證關鍵依賴..."
    if [ ! -d "node_modules/react" ]; then
        echo "   ❌ React 未安裝，請手動執行: cd frontend && npm install"
        exit 1
    fi
    if [ ! -d "node_modules/vite" ]; then
        echo "   ❌ Vite 未安裝，請手動執行: cd frontend && npm install"
        exit 1
    fi
    if [ ! -d "node_modules/tailwindcss" ]; then
        echo "   ❌ Tailwind CSS 未安裝，請手動執行: cd frontend && npm install"
        exit 1
    fi
    echo "   ✅ 關鍵依賴驗證通過"
    
    # 檢查配置檔案
    if [ ! -f "tailwind.config.js" ]; then
        echo "⚠️  警告：tailwind.config.js 不存在"
    fi
    if [ ! -f "postcss.config.js" ]; then
        echo "⚠️  警告：postcss.config.js 不存在"
    fi
    if [ ! -f "components.json" ]; then
        echo "⚠️  警告：components.json (shadcn/ui 配置) 不存在"
    fi
    if [ ! -f "jsconfig.json" ]; then
        echo "⚠️  警告：jsconfig.json (路徑別名配置) 不存在"
    fi
    
    echo "🚀 啟動 Vite 開發伺服器..."
    # 啟動 Vite 並捕獲輸出（優化：不等待清除快取完成）
    npm run dev > /tmp/vite-startup.log 2>&1 &
    FRONTEND_PID=$!
    cd "$PROJECT_ROOT" || exit 1
    
    # 等待清除快取完成（如果正在清除）
    if [ -n "$CLEANUP_PID" ]; then
        wait $CLEANUP_PID 2>/dev/null || true
    fi
    
    # 等待 Vite 啟動（優化：減少最大等待時間，更頻繁檢查）
    echo "⏳ 等待前端啟動..."
    FRONTEND_READY=0
    MAX_WAIT=15  # 從 20 秒減少到 15 秒
    CHECK_INTERVAL=1  # 改為整數，避免算術運算錯誤
    
    for i in $(seq 1 $MAX_WAIT); do
        sleep $CHECK_INTERVAL
        # 檢查端口是否被佔用
        if lsof -ti:5173 > /dev/null 2>&1; then
            # 額外檢查：確認是 Vite 進程（通過檢查日誌中的 ready 訊息）
            if grep -q "ready in" /tmp/vite-startup.log 2>/dev/null; then
                FRONTEND_READY=1
                echo "   ✅ 前端已成功啟動（等待了 ${i} 秒）"
                break
            fi
        fi
        # 每 5 秒顯示一次進度
        if [ $((i % 5)) -eq 0 ]; then
            echo "   ⏳ 仍在等待... (${i}/${MAX_WAIT} 秒)"
        fi
    done
    
    if [ $FRONTEND_READY -eq 1 ]; then
        echo "✅ 前端已成功啟動在 http://localhost:5173"
        # 顯示 Vite 啟動日誌的前幾行
        if [ -f /tmp/vite-startup.log ]; then
            echo "📋 Vite 啟動訊息："
            grep -E "(Local:|Network:|ready in)" /tmp/vite-startup.log | head -3 | sed 's/^/   /' || head -3 /tmp/vite-startup.log | sed 's/^/   /'
        fi
    else
        echo "⚠️  前端可能未正確啟動"
        echo "   檢查項目："
        echo "   1. 查看完整日誌: cat /tmp/vite-startup.log"
        echo "   2. 檢查端口是否被佔用: lsof -ti:5173"
        echo "   3. 手動啟動測試: cd frontend && npm run dev"
        if [ -f /tmp/vite-startup.log ]; then
            echo ""
            echo "   📋 最近的日誌輸出："
            tail -10 /tmp/vite-startup.log | sed 's/^/   /'
        fi
        echo ""
        echo "   💡 提示：前端進程可能仍在後台運行，請檢查 http://localhost:5173"
    fi
    
    echo ""
    echo "✅ 本地開發環境已啟動"
    echo "   - 後端 API: http://localhost:5000"
    echo "   - Swagger 文檔: http://localhost:5000/api-docs"
    echo "   - 前端 (Vite + Tailwind CSS 3.x + shadcn/ui): http://localhost:5173"
    echo ""
    echo "💡 提示："
    echo "   - 前端使用 shadcn/ui 組件庫，採用灰階配色方案"
    echo "   - 詳細的 shadcn/ui 使用指南: frontend/SHADCN_UI_GUIDE.md"
    echo ""
    echo "   如果前端樣式無法顯示，請："
    echo "   1. 檢查瀏覽器控制台（F12）是否有錯誤"
    echo "   2. 清除瀏覽器快取並重新載入（Ctrl+Shift+R 或 Cmd+Shift+R）"
    echo "   3. 查看前端日誌: tail -f /tmp/vite-startup.log"
    echo "   4. 確認所有 shadcn/ui 組件已正確安裝"
else
    echo ""
    echo "✅ 後端服務已啟動"
    echo "   - API: http://localhost:5000"
    echo "   - Swagger 文檔: http://localhost:5000/api-docs"
fi

echo ""
echo "按 Ctrl+C 停止服務"

# 等待中斷
trap "echo ''; echo '🛑 正在停止服務...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
