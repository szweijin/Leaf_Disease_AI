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
  echo ""
  echo "   問題診斷："
  echo "   - 當前目錄: $(pwd)"
  echo "   - requirements.txt 存在: $([ -f requirements.txt ] && echo '是' || echo '否')"
  echo "   - package.json 存在: $([ -f package.json ] && echo '是' || echo '否')"
  echo "   - 可用的命令: $(which python3 python python2 2>/dev/null | head -n3 | tr '\n' ' ' || echo '無')"
  echo ""
  echo "   可能的原因："
  echo "   1. NIXPACKS 只檢測到了 Node.js（package.json），但沒有檢測到 Python（requirements.txt）"
  echo "   2. 這是 NIXPACKS 的已知限制：當同時有 package.json 和 requirements.txt 時，"
  echo "      可能只處理第一個檢測到的語言"
  echo ""
  echo "   建議的解決方案："
  echo "   1. 檢查 Railway 構建日誌，確認 NIXPACKS 是否檢測到 requirements.txt"
  echo "   2. 嘗試在 Railway 專案設置中明確指定 Python 版本"
  echo "   3. 聯繫 Railway 支援，報告 NIXPACKS 多語言檢測問題"
  echo "   4. 考慮使用 Dockerfile 替代 NIXPACKS，以獲得更好的控制"
  echo ""
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
