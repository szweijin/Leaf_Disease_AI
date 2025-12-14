#!/bin/bash

# 後端啟動腳本

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 載入環境變數
source "$SCRIPT_DIR/load_env.sh" || exit 1

# 切換到專案根目錄
cd "$PROJECT_ROOT" || exit 1

# 檢查資料庫連線（可選，如果資料庫未初始化會提示）
echo "📊 檢查資料庫連線..."
source "$SCRIPT_DIR/start_database.sh" 2>/dev/null || {
    echo "⚠️  資料庫檢查失敗，但將繼續嘗試啟動後端"
    echo "   如需初始化資料庫，請執行: ./scripts/start_database.sh init"
}

# 檢查 Redis 連線（可選，有預設值）
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

# 檢查後端是否已經在運行
if lsof -ti:5000 > /dev/null 2>&1; then
    echo "⚠️  端口 5000 已被佔用"
    read -p "   是否要停止現有進程並重新啟動？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 停止現有後端進程..."
        lsof -ti:5000 | xargs kill -9 2>/dev/null
        pkill -f "python.*app.py" 2>/dev/null
        sleep 2
    else
        echo "❌ 取消啟動"
        exit 1
    fi
fi

# 啟動後端
echo "🚀 啟動 Flask 後端..."
cd "$PROJECT_ROOT/backend" || exit 1
python app.py > /tmp/flask-startup.log 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_ROOT" || exit 1

# 等待後端啟動並驗證
echo "⏳ 等待後端啟動..."
BACKEND_READY=0
MAX_WAIT=180  # 3 分鐘，給後端更多時間載入模型和初始化
CHECK_INTERVAL=1

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
    # 每 5 秒顯示一次進度
    if [ $((i % 5)) -eq 0 ]; then
        echo "   ⏳ 仍在等待後端啟動... (${i}/${MAX_WAIT} 秒)"
    fi
done

if [ $BACKEND_READY -eq 0 ]; then
    echo "   ❌ 後端啟動失敗或未完全啟動"
    echo "   💡 請檢查: curl http://localhost:5000/check-auth"
    if [ -f /tmp/flask-startup.log ]; then
        echo "   📋 後端啟動日誌："
        tail -20 /tmp/flask-startup.log | sed 's/^/      /'
    fi
    echo ""
    echo "❌ 後端啟動失敗"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo "✅ 後端已成功啟動"
echo "   - API: http://localhost:5000"
echo "   - Swagger 文檔: http://localhost:5000/api-docs"
echo ""
echo "💡 提示："
echo "   - 查看後端日誌: tail -f /tmp/flask-startup.log"
echo "   - 停止後端: pkill -f 'python.*app.py' 或 kill $BACKEND_PID"
echo ""
echo "按 Ctrl+C 停止後端服務"

# 等待中斷
trap "echo ''; echo '🛑 正在停止後端服務...'; kill $BACKEND_PID 2>/dev/null; pkill -f 'python.*app.py' 2>/dev/null; exit" INT TERM
wait
