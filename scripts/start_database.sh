#!/bin/bash

# 資料庫初始化和檢查腳本

# 獲取腳本所在目錄的絕對路徑
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 載入環境變數
source "$SCRIPT_DIR/load_env.sh" || exit 1

# 切換到專案根目錄
cd "$PROJECT_ROOT" || exit 1

echo "📊 檢查 PostgreSQL 連線..."

# 使用 PGPASSWORD 環境變數避免手動輸入密碼
export PGPASSWORD="$DB_PASSWORD"

# 使用後台進程和超時檢查（兼容 macOS）
(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1) &
PSQL_PID=$!
sleep 2
if kill -0 $PSQL_PID 2>/dev/null; then
    # 如果還在運行，表示連線超時或失敗
    kill $PSQL_PID 2>/dev/null
    DB_CHECK_FAILED=1
else
    wait $PSQL_PID 2>/dev/null
    DB_CHECK_FAILED=$?
fi

if [ "$DB_CHECK_FAILED" -ne 0 ]; then
    echo "⚠️  無法連接到資料庫 '$DB_NAME'"
    echo ""
    echo "   可能的原因："
    echo "   1. 資料庫不存在 - 請執行: ./scripts/start_database.sh init"
    echo "      （會自動創建資料庫並執行完整初始化，包含所有表、視圖、函數、prediction_log 表、病害資訊資料）"
    echo "   2. PostgreSQL 服務未啟動"
    echo "   3. 連線資訊錯誤（檢查 .env 檔案）"
    echo ""
    
    # 如果傳入了 init 參數，直接初始化
    if [ "$1" = "init" ]; then
        echo "🔄 執行資料庫初始化..."
        echo "   （將創建資料庫並執行完整初始化腳本，包含所有內容）"
        python database/database_manager.py init
        if [ $? -eq 0 ]; then
            echo "✅ 資料庫初始化完成（包含所有表、視圖、函數、prediction_log 表、病害資訊資料）"
            exit 0
        else
            echo "❌ 資料庫初始化失敗"
            echo "   請檢查錯誤訊息並修復問題後重試"
            exit 1
        fi
    else
        read -p "   是否要現在初始化資料庫？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🔄 執行資料庫初始化..."
            echo "   （將創建資料庫並執行完整初始化腳本，包含所有內容）"
            python database/database_manager.py init
            if [ $? -eq 0 ]; then
                echo "✅ 資料庫初始化完成（包含所有表、視圖、函數、prediction_log 表、病害資訊資料）"
            else
                echo "❌ 資料庫初始化失敗"
                echo "   請檢查錯誤訊息並修復問題後重試"
                exit 1
            fi
        else
            echo "❌ 資料庫未初始化，無法繼續"
            exit 1
        fi
    fi
else
    echo "✅ 資料庫連線正常"
    exit 0
fi
