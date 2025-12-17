#!/bin/bash
# Railway 構建腳本

set -e  # 遇到錯誤時退出

echo "🚀 開始構建 Leaf Disease AI..."

# 檢查 npm 是否存在
if command -v npm &>/dev/null; then
  # 構建前端
  echo "📦 構建前端..."
  cd frontend
  npm install
  npm run build
  cd ..
  echo "✅ 前端構建完成！"
else
  echo "❌ 錯誤: npm 未安裝！"
  echo "   提示: NIXPACKS 應該通過 nixpacks.toml 或根目錄的 package.json 安裝 Node.js"
  echo "   請檢查 nixpacks.toml 配置或根目錄的 package.json 是否存在"
  exit 1
fi

# 安裝 Python 依賴
echo "📦 安裝 Python 依賴..."
pip install -r requirements.txt

# 設置腳本執行權限
echo "🔧 設置腳本執行權限..."
chmod +x railway-init.sh

echo "✅ 構建完成！"
