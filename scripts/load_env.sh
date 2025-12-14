#!/bin/bash

# 載入環境變數腳本
# 用於其他腳本載入 .env 文件中的環境變數

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 切換到專案根目錄
cd "$PROJECT_ROOT" || exit 1

# 檢查環境變數檔案
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 檔案，將使用預設設定"
    echo "   建議創建 .env 檔案並設定資料庫和 Redis 連線資訊"
    return 2>/dev/null || exit 0
fi

# 載入環境變數（如果存在）- 安全地處理註釋和特殊字符
if [ -f ".env" ]; then
    # 使用 set -a 來自動導出變數
    set -a
    # 安全地載入 .env 文件，過濾註釋和空行
    while IFS= read -r line || [ -n "$line" ]; do
        # 跳過空行
        if [[ -z "$line" ]]; then
            continue
        fi
        # 跳過以 # 開頭的註釋行
        if [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi
        # 移除行尾的註釋（# 後面的內容），但保留值中的 #
        # 只移除行尾的註釋，不影響值本身
        if [[ "$line" =~ ^[^#]*=.*# ]]; then
            # 如果有 = 號，且 # 在 = 號之後，則移除 # 及其後面的內容
            line="${line%%[[:space:]]*#*}"
        fi
        # 移除前後空白
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        # 如果有等號且不是空值，則導出
        if [[ "$line" =~ = ]] && [[ -n "$line" ]]; then
            export "$line" 2>/dev/null || true
        fi
    done < .env
    set +a
fi

# 檢查必要的環境變數
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ 錯誤：缺少必要的資料庫環境變數"
    echo "   請在 .env 檔案中設定：DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    return 1 2>/dev/null || exit 1
fi

# 檢查 SECRET_KEY
if [ -z "$SECRET_KEY" ] || [ "$SECRET_KEY" = "your-secret-key-here" ] || [ "$SECRET_KEY" = "dev-secret-key" ]; then
    echo "⚠️  警告：SECRET_KEY 未設定或使用預設值"
    echo "   正在生成一個隨機 SECRET_KEY..."
    # 生成一個隨機的 SECRET_KEY（32 字元）
    GENERATED_SECRET=$(openssl rand -hex 32)
    export SECRET_KEY="$GENERATED_SECRET"
    echo "   ✅ 已生成 SECRET_KEY（僅本次啟動有效）"
    echo "   💡 建議：將以下內容添加到 .env 檔案中："
    echo "   SECRET_KEY=$GENERATED_SECRET"
    echo ""
fi

# Redis 設定（可選，有預設值）
export REDIS_HOST=${REDIS_HOST:-localhost}
export REDIS_PORT=${REDIS_PORT:-6379}

# 設定 Python 模組搜尋路徑
export PYTHONPATH="$PROJECT_ROOT"
