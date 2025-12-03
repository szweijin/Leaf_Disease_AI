#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
資料庫重置腳本
刪除並重新創建資料庫，執行所有初始化腳本
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()

# 獲取資料庫配置
DB_HOST = os.getenv('DB_HOST')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')

# 獲取專案根目錄
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INIT_SQL_PATH = os.path.join(BASE_DIR, 'database', 'init_database.sql')
# 注意：functions_views_triggers.sql 和 add_image_storage.sql 已合併到 init_database.sql


def validate_config():
    """驗證配置"""
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
        raise ValueError(
            f"缺少必要的資料庫環境變數: {', '.join(missing)}\n"
            f"請在 .env 檔案中設定這些變數"
        )


def drop_database():
    """刪除資料庫"""
    print("=" * 60)
    print("步驟 1/5: 刪除現有資料庫...")
    print("=" * 60)
    
    try:
        # 連接到 postgres 資料庫（不能連接到要刪除的資料庫）
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database='postgres',  # 連接到預設資料庫
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # 檢查資料庫是否存在
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (DB_NAME,)
        )
        exists = cursor.fetchone()
        
        if exists:
            # 終止所有連接到該資料庫的會話
            print(f"  終止連接到 {DB_NAME} 的會話...")
            cursor.execute(f"""
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = '{DB_NAME}'
                AND pid <> pg_backend_pid();
            """)
            
            # 刪除資料庫
            print(f"  刪除資料庫 {DB_NAME}...")
            cursor.execute(f'DROP DATABASE IF EXISTS "{DB_NAME}"')
            print(f"  ✅ 資料庫 {DB_NAME} 已刪除")
        else:
            print(f"  ℹ️  資料庫 {DB_NAME} 不存在，跳過刪除")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ 刪除資料庫失敗: {str(e)}")
        return False


def create_database():
    """創建資料庫"""
    print("\n" + "=" * 60)
    print("步驟 2/5: 創建新資料庫...")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database='postgres',
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        cursor.execute(f'CREATE DATABASE "{DB_NAME}"')
        print(f"  ✅ 資料庫 {DB_NAME} 已創建")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ 創建資料庫失敗: {str(e)}")
        return False


def execute_sql_file(file_path, description):
    """執行 SQL 文件"""
    if not os.path.exists(file_path):
        print(f"  ⚠️  文件不存在: {file_path}")
        return False
    
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        conn.autocommit = True  # 每個語句獨立執行
        cursor = conn.cursor()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # 解析 SQL 語句（處理美元引號）
        statements = []
        current_statement = []
        in_dollar_quote = False
        dollar_tag = None
        i = 0
        
        while i < len(sql_content):
            char = sql_content[i]
            
            if not in_dollar_quote:
                # 檢查是否開始美元引號
                if char == '$':
                    # 查找完整的美元標籤
                    tag_start = i
                    tag_end = sql_content.find('$', i + 1)
                    if tag_end > i:
                        potential_tag = sql_content[i:tag_end + 1]
                        # 檢查是否為有效的美元標籤（字母數字下劃線）
                        if len(potential_tag) > 2 and potential_tag[1:-1].replace('_', '').isalnum():
                            if dollar_tag is None:
                                # 開始美元引號
                                dollar_tag = potential_tag
                                in_dollar_quote = True
                                current_statement.append(char)
                                i += 1
                                continue
                            elif potential_tag == dollar_tag:
                                # 結束美元引號
                                dollar_tag = None
                                in_dollar_quote = False
                                current_statement.append(char)
                                i += 1
                                continue
                
                # 檢查是否為語句結束
                if char == ';' and not in_dollar_quote:
                    current_statement.append(char)
                    statement = ''.join(current_statement).strip()
                    if statement and not statement.startswith('--'):
                        statements.append(statement)
                    current_statement = []
                else:
                    current_statement.append(char)
            else:
                # 在美元引號內
                current_statement.append(char)
                # 檢查是否結束美元引號
                if char == '$' and i + len(dollar_tag) - 1 < len(sql_content):
                    potential_end = sql_content[i:i + len(dollar_tag)]
                    if potential_end == dollar_tag:
                        dollar_tag = None
                        in_dollar_quote = False
                        # 不移動 i，讓下一次循環處理這個 $
            
            i += 1
        
        # 處理最後一個語句
        if current_statement:
            statement = ''.join(current_statement).strip()
            if statement and not statement.startswith('--'):
                statements.append(statement)
        
        # 執行每個語句
        executed = 0
        for statement in statements:
            statement = statement.strip()
            if not statement or statement.startswith('--') or statement.startswith('\\'):
                continue
            
            try:
                cursor.execute(statement)
                executed += 1
            except psycopg2.errors.DuplicateObject:
                # 忽略已存在的對象
                pass
            except psycopg2.errors.DuplicateTable:
                # 忽略已存在的表
                pass
            except Exception as e:
                error_msg = str(e).split('\n')[0]
                if 'already exists' not in error_msg.lower() and 'does not exist' not in error_msg.lower():
                    print(f"    ⚠️  SQL 語句執行警告: {error_msg[:100]}")
        
        cursor.close()
        conn.close()
        
        print(f"  ✅ {description} 執行完成 ({executed} 個語句)")
        return True
        
    except Exception as e:
        print(f"  ❌ 執行 {description} 失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主函數"""
    print("\n" + "=" * 60)
    print("資料庫重置腳本")
    print("=" * 60)
    print(f"資料庫: {DB_NAME}")
    print(f"主機: {DB_HOST}:{DB_PORT}")
    print(f"用戶: {DB_USER}")
    print("=" * 60)
    print("\n⚠️  警告：此操作將刪除所有現有資料！")
    response = input("是否繼續？(yes/no): ")
    if response.lower() != 'yes':
        print("操作已取消")
        return
    
    try:
        validate_config()
    except ValueError as e:
        print(f"\n❌ 配置驗證失敗: {str(e)}")
        sys.exit(1)
    
    # 步驟 1: 刪除資料庫
    print("步驟 1/3: 刪除現有資料庫...")
    if not drop_database():
        print("\n❌ 重置失敗：無法刪除資料庫")
        sys.exit(1)
    
    # 步驟 2: 創建資料庫
    print("\n" + "=" * 60)
    print("步驟 2/3: 創建新資料庫...")
    print("=" * 60)
    if not create_database():
        print("\n❌ 重置失敗：無法創建資料庫")
        sys.exit(1)
    
    # 步驟 3: 執行完整初始化 SQL（包含表結構、視圖、函數、觸發器和圖片存儲功能）
    print("\n" + "=" * 60)
    print("步驟 3/3: 執行完整資料庫初始化 SQL...")
    print("=" * 60)
    print("  （包含：表結構、視圖、函數、觸發器、圖片存儲功能）")
    if not execute_sql_file(INIT_SQL_PATH, "完整資料庫初始化腳本"):
        print("\n❌ 重置失敗：無法執行資料庫初始化 SQL 腳本")
        sys.exit(1)
    print()
    
    print("=" * 60)
    print("✅ 資料庫重置完成！")
    print("=" * 60)
    print("\n已創建：")
    print("  - 所有表結構")
    print("  - 視圖（user_statistics, error_statistics, api_performance_stats）")
    print("  - 函數（has_permission, log_activity, update_timestamp）")
    print("  - 觸發器（自動更新時間戳）")
    print("  - 圖片存儲功能（image_data, image_data_size, image_compressed）")
    print("\n現在可以：")
    print("1. 重新註冊帳號")
    print("2. 上傳圖片進行檢測")
    print("3. 查看檢測歷史記錄")
    print("=" * 60)


if __name__ == '__main__':
    main()

