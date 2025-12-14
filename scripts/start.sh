#!/bin/bash

# 主啟動腳本 - 同時啟動所有服務
# 使用拆分的腳本模組化啟動

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 切換到專案根目錄
cd "$PROJECT_ROOT" || exit 1

echo "🌿 啟動 Leaf Disease AI 本地開發環境..."
echo ""

# 載入環境變數
source "$SCRIPT_DIR/load_env.sh" || exit 1

# 檢查並初始化資料庫
echo "📊 檢查資料庫..."
source "$SCRIPT_DIR/start_database.sh" || {
    echo "❌ 資料庫檢查失敗，無法繼續啟動"
    exit 1
}

# 檢查 Redis（可選）
echo "🔴 檢查 Redis 連線..."
(redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1) &
REDIS_PID=$!
sleep 1
if kill -0 $REDIS_PID 2>/dev/null; then
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
fi

echo ""
echo "🚀 啟動後端服務..."
# 在後台啟動後端
"$SCRIPT_DIR/start_backend.sh" > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# 等待後端啟動
echo "⏳ 等待後端啟動..."
sleep 5
for i in {1..30}; do
    if curl -s http://localhost:5000/check-auth > /dev/null 2>&1; then
        echo "✅ 後端已啟動"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo "⚠️  後端啟動可能較慢，繼續啟動前端..."
    fi
done

echo ""
echo "🎨 啟動前端服務..."
# 在後台啟動前端
"$SCRIPT_DIR/start_frontend.sh" > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端啟動
echo "⏳ 等待前端啟動..."
sleep 3
for i in {1..20}; do
    if curl -s -f http://localhost:5173 > /dev/null 2>&1; then
        echo "✅ 前端已啟動"
        break
    fi
    sleep 1
done

echo ""
echo "✅ 本地開發環境已啟動"
echo "   - 後端 API: http://localhost:5000"
echo "   - Swagger 文檔: http://localhost:5000/api-docs"
echo "   - 前端 (React 19 + Vite 7 + Tailwind CSS 3.x + shadcn/ui): http://localhost:5173"
echo ""
echo "💡 提示："
echo "   - 查看後端日誌: tail -f /tmp/backend.log"
echo "   - 查看前端日誌: tail -f /tmp/frontend.log"
echo "   - 停止所有服務: ./scripts/stop_all.sh"
echo ""
echo "   或者分別啟動服務："
echo "   - 僅啟動資料庫檢查: ./scripts/start_database.sh"
echo "   - 僅啟動後端: ./scripts/start_backend.sh"
echo "   - 僅啟動前端: ./scripts/start_frontend.sh"
echo "   - 快速啟動前端: ./scripts/start_frontend.sh fast"
echo ""
echo "按 Ctrl+C 停止所有服務"

# 等待中斷
trap "echo ''; echo '🛑 正在停止所有服務...'; kill $BACKEND_PID 2>/dev/null; kill $FRONTEND_PID 2>/dev/null; pkill -f 'python.*app.py' 2>/dev/null; pkill -f 'vite' 2>/dev/null; pkill -f 'npm.*dev' 2>/dev/null; exit" INT TERM
wait
