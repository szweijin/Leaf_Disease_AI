#!/bin/bash

# 停止所有服務腳本

echo "🛑 正在停止所有服務..."

# 停止後端
echo "   停止後端服務..."
pkill -f "python.*app.py" 2>/dev/null
lsof -ti:5000 | xargs kill -9 2>/dev/null

# 停止前端
echo "   停止前端服務..."
pkill -f "vite" 2>/dev/null
pkill -f "npm.*dev" 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

# 等待一下確保進程停止
sleep 2

# 檢查是否還有進程在運行
if lsof -ti:5000 > /dev/null 2>&1 || lsof -ti:5173 > /dev/null 2>&1; then
    echo "⚠️  仍有服務在運行，強制停止..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    pkill -9 -f "python.*app.py" 2>/dev/null
    pkill -9 -f "vite" 2>/dev/null
    pkill -9 -f "npm.*dev" 2>/dev/null
fi

echo "✅ 所有服務已停止"
