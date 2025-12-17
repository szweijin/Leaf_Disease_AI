#!/bin/bash
# Railway 構建腳本

set -e  # 遇到錯誤時退出

echo "🚀 開始構建 Leaf Disease AI..."

# 構建前端
echo "📦 構建前端..."
cd frontend
npm install
npm run build
cd ..

# 安裝 Python 依賴
echo "📦 安裝 Python 依賴..."
pip install -r requirements.txt

# 設置腳本執行權限
echo "🔧 設置腳本執行權限..."
chmod +x railway-init.sh

echo "✅ 構建完成！"

