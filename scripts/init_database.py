#!/usr/bin/env python3
"""
資料庫初始化腳本
自動創建資料庫並執行初始化 SQL
"""

import os
import sys
import re
import subprocess
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
DISEASE_DATA_SQL_PATH = os.path.join(BASE_DIR, 'database', 'insert_disease_data.sql')
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


def verify_tables() -> bool:
    """驗證關鍵表是否創建成功"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        
        expected_tables = [
            'roles', 'permissions', 'role_permissions', 'users', 'sessions',
            'disease_library', 'detection_records', 'activity_logs', 'error_logs',
            'audit_logs', 'api_logs', 'performance_logs'
        ]
        
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        existing_tables = [row[0] for row in cursor.fetchall()]
        missing_tables = [t for t in expected_tables if t not in existing_tables]
        
        if missing_tables:
            print(f"\n⚠️  警告：以下表未創建成功:")
            for table in missing_tables:
                print(f"    - {table}")
            print(f"\n   已創建的表: {len(existing_tables)}/{len(expected_tables)}")
            print(f"   缺少的表: {len(missing_tables)} 個")
            cursor.close()
            conn.close()
            return False
        else:
            print(f"\n✅ 所有 {len(expected_tables)} 個表都已成功創建")
            cursor.close()
            conn.close()
            return True
            
    except Exception as e:
        print(f"⚠️  驗證表時發生錯誤: {str(e)}")
        return False


def execute_sql_file(sql_path: str, description: str = "SQL 腳本") -> bool:
    """
    執行 SQL 文件（使用 psql 直接執行，避免手動分割的問題）
    
    Args:
        sql_path: SQL 文件路徑
        description: 描述文字
    
    Returns:
        是否成功
    """
    if not os.path.exists(sql_path):
        print(f"❌ {description}不存在: {sql_path}")
        return False
    
    print(f"📄 讀取 {description}: {sql_path}")
    print(f"🔄 執行 {description}...")
    
    try:
        # 使用 psql 直接執行 SQL 文件（最可靠的方法）
        # 構建 psql 命令
        env = os.environ.copy()
        env['PGPASSWORD'] = DB_PASSWORD
        
        psql_cmd = [
            'psql',
            '-h', DB_HOST,
            '-p', str(DB_PORT),
            '-U', DB_USER,
            '-d', DB_NAME,
            '-f', sql_path,
            '-v', 'ON_ERROR_STOP=1',  # 遇到錯誤時停止
            '--quiet',  # 減少輸出
            '--no-psqlrc',  # 不使用 .psqlrc
        ]
        
        # 執行 psql 命令
        result = subprocess.run(
            psql_cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=300  # 5 分鐘超時
        )
        
        if result.returncode == 0:
            print(f"✅ SQL 腳本執行成功")
            # 驗證關鍵表是否創建成功
            return verify_tables()
        else:
            print(f"❌ SQL 腳本執行失敗（返回碼: {result.returncode}）")
            if result.stderr:
                print(f"錯誤訊息:")
                # 只顯示前 500 字符的錯誤訊息
                error_lines = result.stderr.split('\n')
                for line in error_lines[:20]:  # 只顯示前 20 行
                    if line.strip():
                        print(f"  {line}")
                if len(error_lines) > 20:
                    print(f"  ... (還有 {len(error_lines) - 20} 行錯誤訊息)")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"❌ SQL 腳本執行超時（超過 5 分鐘）")
        return False
    except FileNotFoundError:
        print(f"❌ 找不到 psql 命令，請確保 PostgreSQL 客戶端已安裝")
        print(f"   可以嘗試: brew install postgresql (macOS) 或 apt-get install postgresql-client (Linux)")
        # 回退到使用 psycopg2 的方法
        return execute_sql_file_fallback(sql_path, description)
    except Exception as e:
        print(f"❌ 執行 SQL 腳本時發生錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        # 回退到使用 psycopg2 的方法
        return execute_sql_file_fallback(sql_path, description)


def execute_sql_file_fallback(sql_path: str, description: str = "SQL 腳本") -> bool:
    """
    回退方法：使用 psycopg2 執行 SQL（當 psql 不可用時）
    """
    print(f"⚠️  使用回退方法執行 SQL...")
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=int(DB_PORT),
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # 簡單分割：按分號分割（不處理複雜情況）
        # 移除註釋
        lines = []
        for line in sql_script.split('\n'):
            stripped = line.strip()
            if not stripped or stripped.startswith('--') or stripped.startswith('\\'):
                continue
            # 移除行尾註釋
            if '--' in line:
                comment_pos = line.find('--')
                line = line[:comment_pos].rstrip()
            if line:
                lines.append(line)
        
        full_text = '\n'.join(lines)
        # 簡單按分號分割
        statements = [s.strip() for s in full_text.split(';') if s.strip() and len(s.strip()) > 3]
        
        executed = 0
        errors = []
        
        for i, statement in enumerate(statements, 1):
            try:
                cursor.execute(statement)
                executed += 1
                if i % 20 == 0:
                    print(f"   已執行 {i}/{len(statements)} 個語句...")
            except psycopg2.Error as e:
                error_msg = str(e)
                # 忽略某些錯誤
                if "already exists" not in error_msg.lower() and "does not exist" not in error_msg.lower():
                    errors.append({'index': i, 'error': error_msg[:200]})
                    if 'CREATE TABLE' in statement.upper():
                        print(f"    ⚠️  語句 {i} 執行失敗: {error_msg[:100]}")
        
        cursor.close()
        conn.close()
        
        if errors:
            print(f"⚠️  執行完成，但有 {len(errors)} 個錯誤")
        else:
            print(f"✅ SQL 腳本執行成功（回退方法）")
        
        return verify_tables()
        
    except Exception as e:
        print(f"❌ 回退方法也失敗: {str(e)}")
        if conn:
            conn.close()
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
    print("步驟 1/3: 創建資料庫...")
    if not create_database():
        print("\n❌ 初始化失敗：無法創建資料庫")
        sys.exit(1)
    print()
    
    # 步驟 2: 執行完整初始化 SQL（包含表結構、視圖、函數、觸發器和圖片存儲功能）
    print("步驟 2/3: 執行完整資料庫初始化 SQL...")
    print("  （包含：表結構、視圖、函數、觸發器、圖片存儲功能）")
    if not execute_sql_file(INIT_SQL_PATH, "完整資料庫初始化腳本"):
        print("\n❌ 初始化失敗：無法執行資料庫初始化 SQL 腳本")
        sys.exit(1)
    print()
    
    # 步驟 3: 插入病害資訊資料（可選，如果檔案存在）
    print("步驟 3/3: 插入病害資訊資料...")
    if os.path.exists(DISEASE_DATA_SQL_PATH):
        if not execute_sql_file(DISEASE_DATA_SQL_PATH, "病害資訊資料插入腳本"):
            print("\n⚠️  警告：病害資訊資料插入失敗，但不影響資料庫初始化")
            print("   您可以稍後手動執行: psql -U postgres -d leaf_disease_ai -f database/insert_disease_data.sql")
        else:
            print("  ✅ 已插入 6 種病害資訊到 disease_library 表")
    else:
        print("  ⚠️  病害資訊資料檔案不存在，跳過此步驟")
        print(f"     （預期位置: {DISEASE_DATA_SQL_PATH}）")
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
    if os.path.exists(DISEASE_DATA_SQL_PATH):
        print("  - 病害資訊資料（6 種病害）")
    print("=" * 60)


if __name__ == '__main__':
    main()

