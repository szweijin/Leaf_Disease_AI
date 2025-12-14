#!/bin/bash

# 前端啟動腳本

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 切換到專案根目錄
cd "$PROJECT_ROOT" || exit 1

# 檢查前端目錄是否存在
if [ ! -d "$PROJECT_ROOT/frontend" ]; then
    echo "❌ 錯誤：找不到 frontend 目錄"
    exit 1
fi

# 檢查端口是否已經被佔用
if lsof -ti:5173 > /dev/null 2>&1; then
    echo "⚠️  端口 5173 已被佔用"
    PORT_5173_PID=$(lsof -ti:5173 2>/dev/null)
    echo "   檢測到進程 PID: $PORT_5173_PID"
    read -p "   是否要停止現有進程並重新啟動？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 停止現有前端進程..."
        kill -9 $PORT_5173_PID 2>/dev/null
        pkill -9 -f "vite" 2>/dev/null
        pkill -9 -f "npm.*dev" 2>/dev/null
        sleep 2
    else
        echo "❌ 取消啟動"
        exit 1
    fi
fi

echo "🎨 啟動 React 前端（React 19 + Vite 7 + Tailwind CSS 3.x + shadcn/ui + PostCSS）..."
cd "$PROJECT_ROOT/frontend" || exit 1

# 快速檢查依賴
echo "📦 檢查前端依賴..."
if [ ! -d "node_modules" ] || [ ! -d "node_modules/vite" ] || [ ! -d "node_modules/react" ]; then
    echo "   📥 依賴缺失，正在安裝..."
    npm install
    if [ $? -ne 0 ]; then
        echo "   ❌ 依賴安裝失敗"
        echo "   請檢查錯誤訊息並修復問題後重試"
        exit 1
    fi
    echo "   ✅ 依賴安裝完成"
else
    echo "   ✅ 前端依賴已存在"
fi

# 檢查是否使用快速啟動模式
if [ "$1" = "fast" ] || [ "$1" = "--fast" ]; then
    echo "🚀 使用快速模式啟動 Vite 開發伺服器..."
    DEV_CMD="npm run dev:fast"
else
    echo "🚀 啟動 Vite 開發伺服器..."
    DEV_CMD="npm run dev"
fi

# 清除舊日誌
> /tmp/vite-startup.log

# 啟動 Vite
nohup $DEV_CMD > /tmp/vite-startup.log 2>&1 &
FRONTEND_PID=$!

# 等待一下確保進程啟動
sleep 1

# 驗證進程是否真的在運行
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "   ⚠️  警告：無法驗證前端進程，將繼續檢查端口..."
    FRONTEND_PID=""
fi

# 等待 Vite 啟動
echo "⏳ 等待前端啟動..."
FRONTEND_READY=0
MAX_WAIT=120  # 2 分鐘
CHECK_INTERVAL=0.5
CHECK_COUNT=$((MAX_WAIT * 2))

for i in $(seq 1 $CHECK_COUNT); do
    sleep $CHECK_INTERVAL
    # 檢查進程是否還在運行（如果 PID 有效）
    if [ -n "$FRONTEND_PID" ] && ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "   ❌ 前端進程已停止"
        if [ -f /tmp/vite-startup.log ]; then
            echo "   📋 錯誤日誌："
            tail -20 /tmp/vite-startup.log | sed 's/^/      /'
        fi
        break
    fi
    # 檢查端口是否被佔用（主要檢查）
    if lsof -ti:5173 > /dev/null 2>&1; then
        # 測試 HTTP 連接（最可靠的方式）
        if curl -s -f http://localhost:5173 > /dev/null 2>&1; then
            FRONTEND_READY=1
            WAIT_SECONDS=$((i / 2))
            WAIT_DECIMAL=$((i % 2 * 5))
            if [ $WAIT_DECIMAL -eq 0 ]; then
                echo "   ✅ 前端已成功啟動（等待了 ${WAIT_SECONDS} 秒）"
            else
                echo "   ✅ 前端已成功啟動（等待了 ${WAIT_SECONDS}.${WAIT_DECIMAL} 秒）"
            fi
            break
        # 如果連接失敗，但日誌顯示已準備好，也認為啟動成功
        elif grep -qE "(ready in|Local:|VITE v)" /tmp/vite-startup.log 2>/dev/null; then
            FRONTEND_READY=1
            WAIT_SECONDS=$((i / 2))
            WAIT_DECIMAL=$((i % 2 * 5))
            if [ $WAIT_DECIMAL -eq 0 ]; then
                echo "   ✅ 前端已成功啟動（等待了 ${WAIT_SECONDS} 秒）"
            else
                echo "   ✅ 前端已成功啟動（等待了 ${WAIT_SECONDS}.${WAIT_DECIMAL} 秒）"
            fi
            break
        fi
    fi
    # 每 4 秒顯示一次進度
    if [ $((i % 4)) -eq 0 ]; then
        WAIT_SECONDS=$((i / 2))
        echo "   ⏳ 仍在等待... (${WAIT_SECONDS}/${MAX_WAIT} 秒)"
    fi
done

if [ $FRONTEND_READY -eq 1 ]; then
    echo ""
    echo "✅ 前端已成功啟動在 http://localhost:5173"
    # 顯示 Vite 啟動日誌的前幾行
    if [ -f /tmp/vite-startup.log ]; then
        echo "📋 Vite 啟動訊息："
        grep -E "(Local:|Network:|ready in)" /tmp/vite-startup.log | head -3 | sed 's/^/   /' || head -3 /tmp/vite-startup.log | sed 's/^/   /'
    fi
    echo ""
    echo "💡 提示："
    echo "   - 前端使用 React 19.2.0 + Vite 7.2.7 + shadcn/ui 組件庫，採用灰階配色方案"
    echo "   - 前端配置：tsconfig.json（TypeScript 支援）、jsconfig.json（路徑別名）、eslint.config.js（代碼檢查）"
    echo "   - 查看前端日誌: tail -f /tmp/vite-startup.log"
    echo "   - 停止前端: pkill -f 'vite' 或 kill $FRONTEND_PID"
    echo "   - 快速啟動模式: ./scripts/start_frontend.sh fast"
    echo ""
    echo "按 Ctrl+C 停止前端服務"
    
    # 等待中斷
    trap "echo ''; echo '🛑 正在停止前端服務...'; [ -n \"\$FRONTEND_PID\" ] && kill \$FRONTEND_PID 2>/dev/null; pkill -f 'vite' 2>/dev/null; pkill -f 'npm.*dev' 2>/dev/null; exit" INT TERM
    wait
else
    echo "   ❌ 前端啟動失敗"
    echo "   檢查項目："
    echo "   1. 查看完整日誌: cat /tmp/vite-startup.log"
    echo "   2. 檢查端口是否被佔用: lsof -ti:5173"
    echo "   3. 手動啟動測試: cd frontend && npm run dev"
    if [ -f /tmp/vite-startup.log ]; then
        echo ""
        echo "   📋 最近的日誌輸出："
        tail -20 /tmp/vite-startup.log | sed 's/^/   /'
    fi
    echo ""
    echo "❌ 前端啟動失敗"
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    pkill -f 'vite' 2>/dev/null
    pkill -f 'npm.*dev' 2>/dev/null
    exit 1
fi
