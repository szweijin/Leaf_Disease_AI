#!/bin/bash
echo "🌿 啟動 Leaf Disease AI 本地開發環境..."

# 檢查環境變數檔案
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 檔案，將使用預設設定"
    echo "   建議創建 .env 檔案並設定資料庫和 Redis 連線資訊"
fi

# 載入環境變數（如果存在）
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 檢查必要的環境變數
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ 錯誤：缺少必要的資料庫環境變數"
    echo "   請在 .env 檔案中設定：DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

# Redis 設定（可選，有預設值）
export REDIS_HOST=${REDIS_HOST:-localhost}
export REDIS_PORT=${REDIS_PORT:-6379}

# 設定 Python 模組搜尋路徑
export PYTHONPATH=$(pwd)

# 檢查資料庫連線
echo "📊 檢查 PostgreSQL 連線..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  無法連接到資料庫 '$DB_NAME'"
    echo ""
    echo "   可能的原因："
    echo "   1. 資料庫不存在 - 請執行: python scripts/init_database.py"
    echo "   2. PostgreSQL 服務未啟動"
    echo "   3. 連線資訊錯誤（檢查 .env 檔案）"
    echo ""
    echo "   後端仍會嘗試啟動，但可能會失敗"
    echo ""
    read -p "   是否要現在初始化資料庫？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 執行資料庫初始化..."
        python scripts/init_database.py
        if [ $? -eq 0 ]; then
            echo "✅ 資料庫初始化完成"
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
cd backend
python app.py &
BACKEND_PID=$!
cd ..

# 等待後端啟動
echo "⏳ 等待後端啟動..."
sleep 3

# 檢查後端是否正常啟動
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ 後端啟動失敗"
    exit 1
fi

# 啟動前端（如果存在）
if [ -d "frontend" ]; then
    echo "🎨 啟動 React 前端..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo "📦 安裝前端依賴..."
        npm install > /dev/null 2>&1
    fi
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    echo ""
    echo "✅ 本地開發環境已啟動"
    echo "   - 後端 API: http://localhost:5000"
    echo "   - Swagger 文檔: http://localhost:5000/api-docs"
    echo "   - 前端: http://localhost:5173"
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
