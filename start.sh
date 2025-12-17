#!/bin/bash
# Railway 應用啟動腳本

set -e  # 遇到錯誤時退出

echo "🚀 啟動 Leaf Disease AI..."

# 確保在 /app 目錄下執行
cd /app

# 設置 Python 路徑，確保可以導入 backend 和 src 模組
export PYTHONPATH=/app:/app/backend:$PYTHONPATH

# 1. 執行資料庫初始化
echo "🔍 執行資料庫初始化..."
chmod +x ./railway-init.sh
./railway-init.sh

# 2. 啟動 Gunicorn 服務器
echo "📦 啟動 Gunicorn 服務器..."
# 使用 exec 讓 Gunicorn 接收系統信號 (PID 1)
# 從 backend 目錄執行，這樣可以正確導入 src 模組
exec gunicorn app:app \
    --bind 0.0.0.0:${PORT:-5000} \
    --workers 2 \
    --threads 2 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --chdir /app/backend

