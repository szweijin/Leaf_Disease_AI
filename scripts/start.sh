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

# 檢查資料庫連線
echo "📊 檢查 PostgreSQL 連線..."
# 使用 PGPASSWORD 環境變數避免手動輸入密碼
export PGPASSWORD="$DB_PASSWORD"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
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

# 檢查 Redis 連線
echo "🔴 檢查 Redis 連線..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
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
python app.py &
BACKEND_PID=$!
cd "$PROJECT_ROOT" || exit 1

# 等待後端啟動
echo "⏳ 等待後端啟動..."
sleep 3

# 檢查後端是否正常啟動
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ 後端啟動失敗"
    exit 1
fi

# 啟動前端（如果存在）
if [ -d "$PROJECT_ROOT/frontend" ]; then
    echo "🎨 啟動 React 前端（Tailwind CSS 3.x + PostCSS）..."
    cd "$PROJECT_ROOT/frontend" || exit 1
    
    # 首先清除可能存在的舊進程和端口佔用
    echo "🧹 清理舊的前端進程..."
    PORT_5173_PID=$(lsof -ti:5173 2>/dev/null)
    if [ -n "$PORT_5173_PID" ]; then
        echo "   ⚠️  檢測到端口 5173 已被佔用 (PID: $PORT_5173_PID)"
        echo "   🔄 正在清除佔用端口的進程..."
        kill $PORT_5173_PID 2>/dev/null
        sleep 1
        if kill -0 $PORT_5173_PID 2>/dev/null; then
            echo "   ⚠️  進程未響應，強制終止..."
            kill -9 $PORT_5173_PID 2>/dev/null
            sleep 1
        fi
    fi
    
    # 清除所有 vite 和 npm 相關進程
    pkill -f "vite" 2>/dev/null
    pkill -f "npm run dev" 2>/dev/null
    sleep 1
    
    # 確認端口已釋放
    if lsof -ti:5173 > /dev/null 2>&1; then
        echo "   ⚠️  警告：端口 5173 仍被佔用，可能需要手動清除"
    else
        echo "   ✅ 端口 5173 已準備就緒"
    fi
    
    # 檢查 node_modules 是否存在
    if [ ! -d "node_modules" ]; then
        echo "📦 安裝前端依賴（包含 Tailwind CSS、PostCSS、Autoprefixer）..."
        npm install
    fi
    
    # 檢查 Tailwind CSS 是否已安裝
    if [ ! -d "node_modules/tailwindcss" ]; then
        echo "⚠️  Tailwind CSS 未安裝，正在安裝..."
        npm install -D tailwindcss@^3.4.1 postcss@^8.4.35 autoprefixer@^10.4.17
    fi
    
    # 檢查配置檔案
    if [ ! -f "tailwind.config.js" ]; then
        echo "⚠️  警告：tailwind.config.js 不存在"
    fi
    if [ ! -f "postcss.config.js" ]; then
        echo "⚠️  警告：postcss.config.js 不存在"
    fi
    
    echo "🚀 啟動 Vite 開發伺服器..."
    # 啟動 Vite 並捕獲輸出
    npm run dev > /tmp/vite-startup.log 2>&1 &
    FRONTEND_PID=$!
    cd "$PROJECT_ROOT" || exit 1
    
    # 等待 Vite 啟動（最多等待 20 秒）
    echo "⏳ 等待前端啟動..."
    FRONTEND_READY=0
    for i in {1..20}; do
        sleep 1
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
            echo "   ⏳ 仍在等待... (${i}/20 秒)"
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
    echo "   - 前端 (Vite + Tailwind CSS 3.x): http://localhost:5173"
    echo ""
    echo "💡 提示：如果前端樣式無法顯示，請："
    echo "   1. 檢查瀏覽器控制台（F12）是否有錯誤"
    echo "   2. 清除瀏覽器快取並重新載入（Ctrl+Shift+R 或 Cmd+Shift+R）"
    echo "   3. 查看前端日誌: tail -f /tmp/vite-startup.log"
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
