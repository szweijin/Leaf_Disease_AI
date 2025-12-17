#!/bin/bash
# Railway 資料庫初始化腳本

set +e  # 不因錯誤而退出，允許繼續執行

echo "🔍 檢查資料庫連接..."

# 等待資料庫就緒
sleep 5

# 檢查 DATABASE_URL 是否存在
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  警告: DATABASE_URL 未設置，跳過資料庫初始化"
    exit 0
fi

# 檢查 psql 是否可用
if ! command -v psql &> /dev/null; then
    echo "⚠️  警告: psql 命令不可用，跳過資料庫初始化"
    echo "   提示: 資料庫可能需要手動初始化"
    exit 0
fi

# 檢查資料庫是否已初始化（檢查 users 表是否存在）
echo "🔍 檢查資料庫是否已初始化..."
TABLE_EXISTS=$(psql $DATABASE_URL -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');" 2>/dev/null)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✅ 資料庫已初始化，跳過初始化步驟"
    exit 0
fi

# 執行初始化 SQL
echo "📦 正在初始化資料庫..."
if psql $DATABASE_URL -f database/init_database.sql; then
    echo "✅ 資料庫初始化完成！"
else
    echo "⚠️  資料庫初始化失敗，但繼續啟動應用程式"
    echo "   提示: 請檢查資料庫連接或手動執行初始化"
fi