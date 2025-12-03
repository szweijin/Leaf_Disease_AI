#!/usr/bin/env python3
"""
資料庫初始化腳本
自動創建資料庫並執行初始化 SQL
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 資料庫配置 - 必須從 .env 檔案設定
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')

# 驗證必要的配置
def validate_config():
    """驗證資料庫配置是否完整"""
    missing = []
    if not DB_HOST:
        missing.append('DB_HOST')
    if not DB_PORT:
        missing.append('DB_PORT')
    if not DB_NAME:
        missing.append('DB_NAME')
    if not DB_USER:
        missing.append('DB_USER')
    if not DB_PASSWORD:
        missing.append('DB_PASSWORD')
    
    if missing:
        print("❌ 錯誤：缺少必要的環境變數")
        print(f"   缺少: {', '.join(missing)}")
        print("   請在 .env 檔案中設定這些變數")
        sys.exit(1)
    
    try:
        int(DB_PORT)  # 驗證端口是數字
    except (ValueError, TypeError):
        print("❌ 錯誤：DB_PORT 必須是有效的數字")
        sys.exit(1)

# 獲取專案根目錄
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INIT_SQL_PATH = os.path.join(BASE_DIR, 'database', 'init_database.sql')
# 注意：functions_views_triggers.sql 和 add_image_storage.sql 已合併到 init_database.sql


def create_database():
    """創建資料庫（如果不存在）"""
    try:
        # 連接到預設的 postgres 資料庫
        conn = psycopg2.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            database='postgres',  # 連接到預設資料庫
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # 檢查資料庫是否存在
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )
        exists = cursor.fetchone()
        
        if exists:
            print(f"✅ 資料庫 '{DB_NAME}' 已存在")
        else:
            # 創建資料庫
            cursor.execute(
                sql.SQL("CREATE DATABASE {}").format(
                    sql.Identifier(DB_NAME)
                )
            )
            print(f"✅ 資料庫 '{DB_NAME}' 創建成功")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.Error as e:
        print(f"❌ 創建資料庫失敗: {str(e)}")
        return False


def execute_sql_file(sql_path: str, description: str = "SQL 腳本") -> bool:
    """
    執行 SQL 文件
    
    Args:
        sql_path: SQL 文件路徑
        description: 描述文字
    
    Returns:
        是否成功
    """
    conn = None
    try:
        # 連接到目標資料庫
        conn = psycopg2.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        # 使用自動提交模式，每個語句獨立執行
        conn.autocommit = True
        cursor = conn.cursor()
        
        # 讀取並執行 SQL 腳本
        if not os.path.exists(sql_path):
            print(f"❌ {description}不存在: {sql_path}")
            return False
        
        print(f"📄 讀取 {description}: {sql_path}")
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # 分割 SQL 語句（以分號分隔，但要注意字串中的分號）
        print(f"🔄 執行 {description}...")
        
        # 使用 psycopg2 的 execute 方法執行 SQL
        # 注意：psycopg2 的 execute 一次只能執行一個語句
        # 我們需要分割 SQL 腳本為多個語句
        import re
        
        # 移除 psql 特定的命令（如 \echo）
        sql_script = re.sub(r'\\echo.*?$', '', sql_script, flags=re.MULTILINE)
        # 移除單行註釋
        sql_script = re.sub(r'--.*?$', '', sql_script, flags=re.MULTILINE)
        
        # 智能的 SQL 語句分割
        # 需要正確處理 $$ 字串分隔符（用於函數定義）
        sql_statements = []
        
        # 先移除註釋和 psql 命令
        lines = []
        for line in sql_script.split('\n'):
            line = line.rstrip()  # 只移除右側空白，保留左側縮進
            # 跳過空行、註釋行和 psql 命令
            stripped = line.strip()
            if stripped and not stripped.startswith('--') and not stripped.startswith('\\'):
                lines.append(line)
        
        # 合併所有行，保留換行符（函數定義需要）
        full_text = '\n'.join(lines) + '\n'
        
        # 智能分割：處理 $$ 字串分隔符（dollar-quoted strings）
        # PostgreSQL 支援 $$ 或 $tag$ 格式
        statements = []
        current_statement = []
        in_dollar_quote = False
        dollar_tag = None
        i = 0
        
        while i < len(full_text):
            # 檢測 $$ 或 $tag$ 標記
            if full_text[i] == '$':
                # 找到 $，檢查是否是 dollar quote 標記
                tag_start = i
                # 查找匹配的 $
                j = i + 1
                while j < len(full_text) and full_text[j] != '$':
                    j += 1
                
                if j < len(full_text):
                    # 找到匹配的 $，提取標籤
                    dollar_tag_candidate = full_text[tag_start:j+1]
                    
                    if not in_dollar_quote:
                        # 開始 dollar quote
                        in_dollar_quote = True
                        dollar_tag = dollar_tag_candidate
                        current_statement.append(dollar_tag_candidate)
                        i = j + 1
                    else:
                        # 檢查是否匹配當前標籤
                        if dollar_tag_candidate == dollar_tag:
                            # 結束 dollar quote
                            current_statement.append(dollar_tag_candidate)
                            in_dollar_quote = False
                            dollar_tag = None
                            i = j + 1
                        else:
                            # 不匹配，只是普通文字
                            current_statement.append(full_text[i])
                            i += 1
                else:
                    # 沒有找到匹配的 $，只是普通文字
                    current_statement.append(full_text[i])
                    i += 1
            elif full_text[i] == ';' and not in_dollar_quote:
                # 分號且不在 dollar quote 內，結束當前語句
                current_statement.append(';')
                statement = ''.join(current_statement).strip()
                if statement and len(statement) > 3:
                    statements.append(statement)
                current_statement = []
                i += 1
            else:
                current_statement.append(full_text[i])
                i += 1
        
        # 處理最後一個語句（如果沒有以分號結尾）
        if current_statement:
            statement = ''.join(current_statement).strip()
            if statement and len(statement) > 3:
                statements.append(statement)
        
        sql_statements = statements
        
        executed = 0
        skipped = 0
        errors = []
        
        for i, statement in enumerate(sql_statements, 1):
            if not statement or len(statement) <= 2:
                skipped += 1
                continue
            
            try:
                cursor.execute(statement)
                executed += 1
                if i % 20 == 0:
                    print(f"   已執行 {i}/{len(sql_statements)} 個語句...")
            except psycopg2.Error as e:
                error_msg = str(e)
                # 某些錯誤可以安全忽略
                ignorable_errors = [
                    "does not exist",
                    "already exists",
                    "duplicate key",
                    "current transaction is aborted"
                ]
                
                if any(ignorable in error_msg.lower() for ignorable in ignorable_errors):
                    skipped += 1
                else:
                    errors.append({
                        'index': i,
                        'statement': statement[:100] + '...' if len(statement) > 100 else statement,
                        'error': error_msg[:200]
                    })
                    # 即使出錯也繼續執行（因為使用 autocommit）
        
        if errors:
            print(f"⚠️  執行完成，但有 {len(errors)} 個錯誤")
            print(f"   ✅ 成功: {executed} 個語句")
            print(f"   ⏭️  跳過: {skipped} 個語句")
            print(f"   ❌ 錯誤: {len(errors)} 個語句")
            print("\n   前 5 個錯誤：")
            for err in errors[:5]:
                print(f"   語句 {err['index']}: {err['error']}")
                print(f"   SQL: {err['statement']}")
        else:
            print(f"✅ SQL 腳本執行成功")
            print(f"   ✅ 成功執行: {executed} 個語句")
            if skipped > 0:
                print(f"   ⏭️  跳過: {skipped} 個語句（已存在或可忽略）")
        
        cursor.close()
        conn.close()
        return len(errors) == 0
        
    except psycopg2.Error as e:
        print(f"❌ 執行 SQL 腳本失敗: {str(e)}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"❌ 發生錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return False


def main():
    """主函數"""
    # 驗證配置
    validate_config()
    
    print("=" * 60)
    print("🌿 Leaf Disease AI - 資料庫初始化")
    print("=" * 60)
    print(f"資料庫主機: {DB_HOST}:{DB_PORT}")
    print(f"資料庫名稱: {DB_NAME}")
    print(f"使用者: {DB_USER}")
    print("=" * 60)
    print()
    
    # 步驟 1: 創建資料庫
    print("步驟 1/2: 創建資料庫...")
    if not create_database():
        print("\n❌ 初始化失敗：無法創建資料庫")
        sys.exit(1)
    print()
    
    # 步驟 2: 執行完整初始化 SQL（包含表結構、視圖、函數、觸發器和圖片存儲功能）
    print("步驟 2/2: 執行完整資料庫初始化 SQL...")
    print("  （包含：表結構、視圖、函數、觸發器、圖片存儲功能）")
    if not execute_sql_file(INIT_SQL_PATH, "完整資料庫初始化腳本"):
        print("\n❌ 初始化失敗：無法執行資料庫初始化 SQL 腳本")
        sys.exit(1)
    print()
    
    print("=" * 60)
    print("✅ 資料庫初始化完成！")
    print("=" * 60)
    print("\n已創建：")
    print("  - 所有表結構")
    print("  - 視圖（user_statistics, error_statistics, api_performance_stats）")
    print("  - 函數（has_permission, log_activity, update_timestamp）")
    print("  - 觸發器（自動更新時間戳）")
    print("  - 圖片存儲功能（image_data, image_data_size, image_compressed）")
    print("=" * 60)


if __name__ == '__main__':
    main()

