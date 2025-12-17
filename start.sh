#!/bin/bash
# Railway 應用啟動腳本

set -e  # 遇到錯誤時退出

echo "🚀 啟動 Leaf Disease AI..."

# 執行資料庫初始化
./railway-init.sh

# 啟動 Gunicorn 服務器
echo "📦 啟動 Gunicorn 服務器..."
cd backend
exec gunicorn app:app \
    --bind 0.0.0.0:${PORT:-5000} \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -

