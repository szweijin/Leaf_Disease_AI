#!/bin/bash

# 快速重啟 Vite 開發服務器腳本

cd "$(dirname "$0")" || exit 1

echo "🔄 重啟 Vite 開發服務器..."

# 停止所有 Vite 進程
echo "🧹 清理舊進程..."
pkill -f "vite" 2>/dev/null
sleep 1

# 清理端口 5173
PORT_PID=$(lsof -ti:5173 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "   ⚠️  端口 5173 被佔用 (PID: $PORT_PID)，正在清除..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

# 確認端口已釋放
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "   ⚠️  警告：端口 5173 仍被佔用"
else
    echo "   ✅ 端口 5173 已準備就緒"
fi

# 啟動 Vite
echo "🚀 啟動 Vite..."
npm run dev > /tmp/vite-startup.log 2>&1 &
VITE_PID=$!

# 等待啟動
echo "⏳ 等待 Vite 啟動（最多 15 秒）..."
for i in {1..15}; do
    sleep 1
    if lsof -ti:5173 > /dev/null 2>&1; then
        if grep -q "ready in" /tmp/vite-startup.log 2>/dev/null; then
            echo "✅ Vite 已成功啟動在 http://localhost:5173"
            echo ""
            echo "📋 啟動訊息："
            grep -E "(Local:|Network:|ready in)" /tmp/vite-startup.log | head -3 | sed 's/^/   /'
            echo ""
            echo "💡 查看完整日誌: tail -f /tmp/vite-startup.log"
            exit 0
        fi
    fi
    if [ $((i % 3)) -eq 0 ]; then
        echo "   ⏳ 仍在等待... (${i}/15 秒)"
    fi
done

echo "⚠️  Vite 可能未完全啟動"
echo "📋 最近的日誌："
tail -10 /tmp/vite-startup.log | sed 's/^/   /'
echo ""
echo "💡 手動檢查: cd frontend && npm run dev"
