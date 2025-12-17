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

# 檢查 requirements.txt 是否存在
if [ ! -f "requirements.txt" ]; then
  echo "❌ 錯誤: requirements.txt 不存在！"
  exit 1
fi

# 檢查 Python 和 pip 是否可用
if command -v python3 &>/dev/null; then
  PYTHON_CMD=python3
elif command -v python &>/dev/null; then
  PYTHON_CMD=python
else
  echo "❌ 錯誤: Python 未安裝！"
  echo "   提示: NIXPACKS 應該通過 requirements.txt 自動檢測並安裝 Python"
  echo "   請確認 requirements.txt 在專案根目錄，且 NIXPACKS 已正確檢測到它"
  echo "   當前目錄: $(pwd)"
  echo "   requirements.txt 位置: $(ls -la requirements.txt 2>/dev/null || echo '未找到')"
  exit 1
fi

# 檢查 pip 是否可用
if command -v pip3 &>/dev/null; then
  PIP_CMD=pip3
elif command -v pip &>/dev/null; then
  PIP_CMD=pip
elif $PYTHON_CMD -m pip --version &>/dev/null 2>&1; then
  PIP_CMD="$PYTHON_CMD -m pip"
else
  echo "❌ 錯誤: pip 未安裝！"
  echo "   嘗試使用 $PYTHON_CMD -m ensurepip --upgrade 安裝 pip..."
  $PYTHON_CMD -m ensurepip --upgrade || {
    echo "   無法自動安裝 pip，請檢查 Python 安裝"
    exit 1
  }
  PIP_CMD="$PYTHON_CMD -m pip"
fi

echo "   ✅ 使用 Python: $($PYTHON_CMD --version 2>&1)"
echo "   ✅ 使用 pip: $($PIP_CMD --version 2>&1 | head -n1 || echo '通過 $PYTHON_CMD -m pip')"
$PIP_CMD install -r requirements.txt

# 設置腳本執行權限
echo "🔧 設置腳本執行權限..."
chmod +x railway-init.sh

echo "✅ 構建完成！"
