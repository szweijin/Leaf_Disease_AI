# 🌿 Leaf Disease AI - PostgreSQL + psycopg2 完整資料庫設計

## 📋 目錄

- [架構概述](#架構概述)
- [資料庫表設計](#資料庫表設計)
- [日誌系統設計](#日誌系統設計)
- [角色權限管理](#角色權限管理)
- [SQL 初始化腳本](#sql-初始化腳本)
- [psycopg2 連接管理](#psycopg2-連接管理)
- [Python 實現代碼](#python-實現代碼)
- [查詢範例](#查詢範例)
- [備份與恢復](#備份與恢復)

---

## 架構概述

### 技術棧

- **資料庫**：PostgreSQL
- **驅動**：psycopg2（直接 SQL）
- **日誌**：資料庫表 + 應用程式日誌
- **角色系統**：User、Admin、Developer

### 系統架構圖

```
┌─────────────────────────────────────────────────────┐
│         Flask Web Application                       │
│  (app.py, routes.py, handlers.py)                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼ psycopg2
┌─────────────────────────────────────────────────────┐
│      Database Connection Pool                       │
│  (db_manager.py - 管理連接、事務、錯誤處理)             │
└────────────────┬────────────────────────────────────┘
                 │
    ┌────────────┴────────────┬─────────────┐
    ▼                         ▼             ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────┐
│  Core Tables │  │  Logging Tables  │  │ Metadata │
│              │  │                  │  │ Tables   │
│ • users      │  │ • activity_logs  │  │          │
│ • detection  │  │ • error_logs     │  │ • roles  │
│ • diseases   │  │ • audit_logs     │  │ • perms  │
│ • sessions   │  │ • api_logs       │  │          │
└──────────────┘  └──────────────────┘  └──────────┘
```

---

## 資料庫表設計

### 1️⃣ Core Tables

#### Users 表

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    role_id INTEGER NOT NULL DEFAULT 1,  -- FK to roles table
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    profile_data JSONB DEFAULT '{}',  -- 存儲額外用戶資訊

    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT chk_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_active ON users(is_active);
```

**欄位說明**：

- `role_id`: 關聯到 roles 表（1=User, 2=Admin, 3=Developer）
- `profile_data`: JSON 格式儲存用戶偏好設定
- `login_count`: 追蹤用戶活動頻率

---

#### Detection_Records 表

```sql
CREATE TABLE detection_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    disease_name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    image_path VARCHAR(500) NOT NULL,
    image_hash VARCHAR(64) UNIQUE,  -- SHA256
    image_size INTEGER,  -- 圖片大小 (bytes)
    raw_model_output JSONB,  -- YOLO 完整輸出
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',  -- completed, processing, failed
    processing_time_ms INTEGER,  -- 處理耗時
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_severity CHECK (severity IN ('Mild', 'Moderate', 'Severe', 'Healthy', 'Unknown')),
    CONSTRAINT chk_status CHECK (status IN ('completed', 'processing', 'failed'))
);

CREATE INDEX idx_records_user ON detection_records(user_id);
CREATE INDEX idx_records_disease ON detection_records(disease_name);
CREATE INDEX idx_records_created ON detection_records(created_at);
CREATE INDEX idx_records_status ON detection_records(status);
CREATE INDEX idx_records_user_date ON detection_records(user_id, created_at DESC);
CREATE INDEX idx_records_confidence ON detection_records(confidence DESC);
```

**欄位說明**：

- `image_hash`: 用於檢測重複上傳
- `status`: 追蹤檢測狀態（3 種狀態）
- `processing_time_ms`: 性能監控

---

#### Disease_Library 表

```sql
CREATE TABLE disease_library (
    id SERIAL PRIMARY KEY,
    disease_name VARCHAR(255) UNIQUE NOT NULL,
    chinese_name VARCHAR(255) NOT NULL,
    english_name VARCHAR(255),
    causes TEXT NOT NULL,
    features TEXT NOT NULL,
    symptoms JSONB,  -- 症狀列表
    pesticides JSONB NOT NULL,  -- 農藥防治方案
    management_measures JSONB NOT NULL,  -- 管理措施
    target_crops VARCHAR(255),
    severity_levels VARCHAR(255),
    prevention_tips JSONB,  -- 預防建議
    reference_links JSONB,  -- 參考資料連結
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT chk_disease_name CHECK (disease_name ~ '^[a-zA-Z0-9_]+$')
);

CREATE INDEX idx_disease_name ON disease_library(disease_name);
CREATE INDEX idx_disease_chinese ON disease_library(chinese_name);
CREATE INDEX idx_disease_active ON disease_library(is_active);
CREATE INDEX idx_disease_fulltext ON disease_library USING GIN(to_tsvector('chinese', chinese_name || ' ' || causes));
```

---

#### Sessions 表（用於追蹤使用者會話）

```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,  -- PostgreSQL 原生 IP 類型
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

---

### 2️⃣ Roles & Permissions 表

#### Roles 表

```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入預設角色
INSERT INTO roles (id, role_name, description) VALUES
    (1, 'user', '普通使用者 - 可進行檢測、查看自己的紀錄'),
    (2, 'admin', '管理員 - 完整系統管理權限'),
    (3, 'developer', '開發者 - 可查看日誌、系統指標、執行維護操作');
```

#### Permissions 表

```sql
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入預設權限
INSERT INTO permissions (permission_name, description) VALUES
    ('upload_image', '上傳圖像'),
    ('view_own_records', '查看自己的檢測記錄'),
    ('view_all_records', '查看所有使用者記錄'),
    ('manage_users', '管理使用者帳戶'),
    ('manage_diseases', '編輯病害資訊'),
    ('view_logs', '查看系統日誌'),
    ('view_analytics', '查看分析儀表板'),
    ('export_data', '匯出資料'),
    ('system_maintenance', '系統維護');
```

#### Role_Permissions 表（多對多）

```sql
CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,

    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 設置預設權限
INSERT INTO role_permissions (role_id, permission_id) VALUES
    -- User (1) 權限
    (1, (SELECT id FROM permissions WHERE permission_name = 'upload_image')),
    (1, (SELECT id FROM permissions WHERE permission_name = 'view_own_records')),
    -- Admin (2) 全部權限
    (2, (SELECT id FROM permissions WHERE permission_name = 'view_all_records')),
    (2, (SELECT id FROM permissions WHERE permission_name = 'manage_users')),
    (2, (SELECT id FROM permissions WHERE permission_name = 'manage_diseases')),
    (2, (SELECT id FROM permissions WHERE permission_name = 'view_logs')),
    (2, (SELECT id FROM permissions WHERE permission_name = 'view_analytics')),
    (2, (SELECT id FROM permissions WHERE permission_name = 'export_data')),
    (2, (SELECT id FROM permissions WHERE permission_name = 'system_maintenance')),
    -- Developer (3) 權限
    (3, (SELECT id FROM permissions WHERE permission_name = 'view_logs')),
    (3, (SELECT id FROM permissions WHERE permission_name = 'view_analytics')),
    (3, (SELECT id FROM permissions WHERE permission_name = 'system_maintenance'));
```

---

## 日誌系統設計

### Activity Logs 表（用戶活動日誌）

```sql
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,  -- 可為 NULL（系統操作）
    action_type VARCHAR(100) NOT NULL,  -- upload, login, logout, download 等
    resource_type VARCHAR(100),  -- detection_record, user, disease 等
    resource_id INTEGER,
    action_details JSONB,  -- 操作詳細資訊
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_action_type CHECK (action_type IN (
        'login', 'logout', 'upload', 'download', 'view', 'edit', 'delete',
        'password_change', 'profile_update', 'permission_change', 'system_event'
    ))
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_action ON activity_logs(action_type);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_user_date ON activity_logs(user_id, created_at DESC);
```

**JSON 結構示例**：

```json
{
  "image_name": "leaf_sample.jpg",
  "disease_detected": "Tomato_late_blight",
  "confidence": 0.95,
  "processing_time_ms": 1200,
  "ip_address": "192.168.1.100"
}
```

---

### Error Logs 表（錯誤日誌）

```sql
CREATE TABLE error_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    error_code VARCHAR(50),
    error_type VARCHAR(100),  -- ValidationError, DatabaseError, ProcessingError 等
    error_message TEXT NOT NULL,
    error_traceback TEXT,  -- Python traceback
    context JSONB,  -- 錯誤上下文資訊
    severity VARCHAR(20),  -- critical, error, warning, info
    endpoint VARCHAR(255),  -- 觸發端點
    request_method VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolution_note TEXT,

    CONSTRAINT chk_severity CHECK (severity IN ('critical', 'error', 'warning', 'info')),
    CONSTRAINT chk_error_type CHECK (error_type IN (
        'ValidationError', 'DatabaseError', 'ProcessingError', 'AuthenticationError',
        'AuthorizationError', 'FileError', 'NetworkError', 'SystemError', 'UnknownError'
    )),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_error_severity ON error_logs(severity);
CREATE INDEX idx_error_type ON error_logs(error_type);
CREATE INDEX idx_error_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_resolved ON error_logs(is_resolved);
CREATE INDEX idx_error_user ON error_logs(user_id);
```

---

### Audit Logs 表（審計日誌 - 系統級操作）

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER,  -- 執行操作的管理員
    operation_type VARCHAR(100) NOT NULL,  -- user_created, user_deleted, role_changed, permission_updated
    target_table VARCHAR(100),
    target_id INTEGER,
    old_values JSONB,  -- 變更前的值
    new_values JSONB,  -- 變更後的值
    change_summary TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_op_type CHECK (operation_type IN (
        'user_created', 'user_updated', 'user_deleted', 'user_activated', 'user_deactivated',
        'role_assigned', 'permission_granted', 'permission_revoked',
        'disease_created', 'disease_updated', 'disease_deleted',
        'database_backup', 'database_restore', 'settings_changed'
    ))
);

CREATE INDEX idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_operation ON audit_logs(operation_type);
CREATE INDEX idx_audit_target ON audit_logs(target_table, target_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

**JSON 結構示例**：

```json
{
  "old_values": {
    "is_active": true,
    "role_id": 1
  },
  "new_values": {
    "is_active": false,
    "role_id": 2
  }
}
```

---

### API Logs 表（API 請求日誌）

```sql
CREATE TABLE api_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,  -- GET, POST, PUT, DELETE
    status_code INTEGER,
    request_body_size INTEGER,
    response_body_size INTEGER,
    execution_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'))
);

CREATE INDEX idx_api_user ON api_logs(user_id);
CREATE INDEX idx_api_endpoint ON api_logs(endpoint);
CREATE INDEX idx_api_method ON api_logs(method);
CREATE INDEX idx_api_status ON api_logs(status_code);
CREATE INDEX idx_api_created ON api_logs(created_at DESC);
CREATE INDEX idx_api_perf ON api_logs(execution_time_ms DESC);  -- 性能監控
```

---

### Performance Logs 表（性能監控）

```sql
CREATE TABLE performance_logs (
    id SERIAL PRIMARY KEY,
    operation_name VARCHAR(255),  -- detection_process, database_query, image_upload 等
    execution_time_ms INTEGER NOT NULL,
    memory_used_mb NUMERIC(10, 2),
    cpu_percentage NUMERIC(5, 2),
    status VARCHAR(20),  -- success, timeout, error
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_perf_operation ON performance_logs(operation_name);
CREATE INDEX idx_perf_time ON performance_logs(execution_time_ms DESC);
CREATE INDEX idx_perf_created ON performance_logs(created_at DESC);
```

---

## 角色權限管理

### 角色定義表

| 角色              | 權限                                                                                                 | 場景             |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ---------------- |
| **User (1)**      | • 上傳圖像<br>• 查看自己的紀錄<br>• 修改密碼                                                         | 普通農民、用戶   |
| **Admin (2)**     | • 所有 User 權限<br>• 管理所有使用者<br>• 編輯病害資訊<br>• 查看所有日誌<br>• 系統設置<br>• 資料匯出 | 系統管理員       |
| **Developer (3)** | • 查看系統日誌<br>• 性能監控<br>• 錯誤追蹤<br>• 系統維護<br>• 資料庫備份                             | 開發者、運維人員 |

### 權限檢查函數

```sql
-- 檢查用戶是否有特定權限
CREATE OR REPLACE FUNCTION has_permission(
    p_user_id INTEGER,
    p_permission_name VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_perm BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN permissions p ON rp.permission_id = p.id
        JOIN users u ON u.role_id = r.id
        WHERE u.id = p_user_id
        AND p.permission_name = p_permission_name
    ) INTO v_has_perm;

    RETURN v_has_perm;
END;
$$ LANGUAGE plpgsql;

-- 使用方式
SELECT has_permission(5, 'view_logs');  -- 檢查 user_id=5 是否可查看日誌
```

---

## SQL 初始化腳本

### 完整初始化腳本

```sql
-- ============================================
-- 1. 建立角色和權限表
-- ============================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ============================================
-- 2. 建立使用者表
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    role_id INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    profile_data JSONB DEFAULT '{}',
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT chk_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_created ON users(created_at);

-- ============================================
-- 3. 建立會話表
-- ============================================

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);

-- ============================================
-- 4. 建立病害資訊表
-- ============================================

CREATE TABLE disease_library (
    id SERIAL PRIMARY KEY,
    disease_name VARCHAR(255) UNIQUE NOT NULL,
    chinese_name VARCHAR(255) NOT NULL,
    english_name VARCHAR(255),
    causes TEXT NOT NULL,
    features TEXT NOT NULL,
    symptoms JSONB,
    pesticides JSONB NOT NULL,
    management_measures JSONB NOT NULL,
    target_crops VARCHAR(255),
    severity_levels VARCHAR(255),
    prevention_tips JSONB,
    reference_links JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_disease_name ON disease_library(disease_name);
CREATE INDEX idx_disease_active ON disease_library(is_active);

-- ============================================
-- 5. 建立檢測記錄表
-- ============================================

CREATE TABLE detection_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    disease_name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    image_path VARCHAR(500) NOT NULL,
    image_hash VARCHAR(64) UNIQUE,
    image_size INTEGER,
    raw_model_output JSONB,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_severity CHECK (severity IN ('Mild', 'Moderate', 'Severe', 'Healthy', 'Unknown')),
    CONSTRAINT chk_status CHECK (status IN ('completed', 'processing', 'failed'))
);

CREATE INDEX idx_records_user ON detection_records(user_id);
CREATE INDEX idx_records_disease ON detection_records(disease_name);
CREATE INDEX idx_records_created ON detection_records(created_at DESC);

-- ============================================
-- 6. 建立日誌表
-- ============================================

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    action_details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_action CHECK (action_type IN ('login', 'logout', 'upload', 'download', 'view', 'edit', 'delete', 'password_change', 'profile_update', 'system_event'))
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

CREATE TABLE error_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    error_code VARCHAR(50),
    error_type VARCHAR(100),
    error_message TEXT NOT NULL,
    error_traceback TEXT,
    context JSONB,
    severity VARCHAR(20),
    endpoint VARCHAR(255),
    request_method VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_severity CHECK (severity IN ('critical', 'error', 'warning', 'info'))
);

CREATE INDEX idx_error_severity ON error_logs(severity);
CREATE INDEX idx_error_created ON error_logs(created_at DESC);

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER,
    operation_type VARCHAR(100) NOT NULL,
    target_table VARCHAR(100),
    target_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    change_summary TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE api_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    request_body_size INTEGER,
    response_body_size INTEGER,
    execution_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_api_endpoint ON api_logs(endpoint);
CREATE INDEX idx_api_created ON api_logs(created_at DESC);

CREATE TABLE performance_logs (
    id SERIAL PRIMARY KEY,
    operation_name VARCHAR(255),
    execution_time_ms INTEGER NOT NULL,
    memory_used_mb NUMERIC(10, 2),
    cpu_percentage NUMERIC(5, 2),
    status VARCHAR(20),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_perf_created ON performance_logs(created_at DESC);

-- ============================================
-- 7. 插入預設角色和權限
-- ============================================

INSERT INTO roles (id, role_name, description) VALUES
    (1, 'user', '普通使用者 - 可進行檢測、查看自己的紀錄'),
    (2, 'admin', '管理員 - 完整系統管理權限'),
    (3, 'developer', '開發者 - 可查看日誌、系統指標、執行維護操作');

INSERT INTO permissions (permission_name, description) VALUES
    ('upload_image', '上傳圖像'),
    ('view_own_records', '查看自己的檢測記錄'),
    ('view_all_records', '查看所有使用者記錄'),
    ('manage_users', '管理使用者帳戶'),
    ('manage_diseases', '編輯病害資訊'),
    ('view_logs', '查看系統日誌'),
    ('view_analytics', '查看分析儀表板'),
    ('export_data', '匯出資料'),
    ('system_maintenance', '系統維護');

-- ============================================
-- 8. 授予角色權限
-- ============================================

-- User 角色
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE permission_name IN ('upload_image', 'view_own_records');

-- Admin 角色（所有權限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions;

-- Developer 角色
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE permission_name IN ('view_logs', 'view_analytics', 'system_maintenance');
```

---

## psycopg2 連接管理

### Database Manager 模組

```python
# db_manager.py

import psycopg2
import psycopg2.extras
from psycopg2 import pool
from contextlib import contextmanager
import logging
from typing import Optional, List, Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    PostgreSQL 資料庫管理類
    使用連接池，支援事務管理和錯誤處理
    """

    def __init__(self):
        """初始化資料庫連接池"""
        try:
            self.pool = psycopg2.pool.SimpleConnectionPool(
                minconn=2,
                maxconn=10,
                host=os.getenv('DB_HOST', 'localhost'),
                port=os.getenv('DB_PORT', 5432),
                database=os.getenv('DB_NAME', 'leaf_disease_ai'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD', 'password')
            )
            logger.info("✅ 資料庫連接池建立成功")
        except Exception as e:
            logger.error(f"❌ 資料庫連接失敗: {str(e)}")
            raise

    @contextmanager
    def get_connection(self):
        """
        上下文管理器 - 自動處理連接獲取和釋放

        使用方式：
            with db.get_connection() as conn:
                cursor = conn.cursor()
                ...
        """
        conn = self.pool.getconn()
        try:
            yield conn
        finally:
            self.pool.putconn(conn)

    @contextmanager
    def get_cursor(self, dict_cursor=False):
        """
        獲取遊標 - 自動處理事務

        Args:
            dict_cursor: 是否使用字典遊標（返回 dict 而非 tuple）
        """
        with self.get_connection() as conn:
            if dict_cursor:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            else:
                cursor = conn.cursor()

            try:
                yield cursor
                conn.commit()
                logger.debug("✅ 事務已提交")
            except Exception as e:
                conn.rollback()
                logger.error(f"❌ 事務回滾: {str(e)}")
                raise
            finally:
                cursor.close()

    def execute_query(self, sql: str, params: tuple = None, fetch_one=False, dict_cursor=False):
        """
        執行 SELECT 查詢

        Args:
            sql: SQL 查詢語句
            params: 參數元組
            fetch_one: 只返回第一條記錄
            dict_cursor: 使用字典遊標

        Returns:
            查詢結果
        """
        try:
            with self.get_cursor(dict_cursor=dict_cursor) as cursor:
                cursor.execute(sql, params or ())

                if fetch_one:
                    result = cursor.fetchone()
                    logger.debug(f"✅ 查詢完成 (1 條記錄)")
                    return result
                else:
                    result = cursor.fetchall()
                    logger.debug(f"✅ 查詢完成 ({len(result)} 條記錄)")
                    return result
        except psycopg2.Error as e:
            logger.error(f"❌ 查詢錯誤: {str(e)}")
            raise

    def execute_update(self, sql: str, params: tuple = None) -> int:
        """
        執行 INSERT/UPDATE/DELETE 操作

        Args:
            sql: SQL 語句
            params: 參數元組

        Returns:
            受影響的行數
        """
        try:
            with self.get_cursor() as cursor:
                cursor.execute(sql, params or ())
                rows_affected = cursor.rowcount
                logger.info(f"✅ 操作完成 ({rows_affected} 行受影響)")
                return rows_affected
        except psycopg2.Error as e:
            logger.error(f"❌ 更新錯誤: {str(e)}")
            raise

    def execute_batch(self, sql: str, data_list: List[tuple]) -> int:
        """
        批量插入操作

        Args:
            sql: SQL 語句
            data_list: 資料列表

        Returns:
            插入的行數
        """
        try:
            with self.get_cursor() as cursor:
                cursor.executemany(sql, data_list)
                rows_affected = cursor.rowcount
                logger.info(f"✅ 批量插入完成 ({rows_affected} 行)")
                return rows_affected
        except psycopg2.Error as e:
            logger.error(f"❌ 批量插入失敗: {str(e)}")
            raise

    def call_procedure(self, proc_name: str, params: tuple = None) -> Any:
        """
        呼叫存儲過程

        Args:
            proc_name: 過程名稱
            params: 參數

        Returns:
            過程返回值
        """
        try:
            with self.get_cursor() as cursor:
                cursor.callproc(proc_name, params or ())
                result = cursor.fetchall()
                logger.info(f"✅ 存儲過程執行完成")
                return result
        except psycopg2.Error as e:
            logger.error(f"❌ 存儲過程執行失敗: {str(e)}")
            raise

    def close_all(self):
        """關閉所有連接"""
        try:
            self.pool.closeall()
            logger.info("✅ 所有資料庫連接已關閉")
        except Exception as e:
            logger.error(f"❌ 關閉連接失敗: {str(e)}")
            raise


# 全局資料庫實例
db = DatabaseManager()
```

### 環境配置文件

```env
# .env

# 資料庫配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=leaf_disease_ai
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Flask 配置
FLASK_ENV=development
SECRET_KEY=your_secret_key_here
DEBUG=True

# 日誌配置
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10485760  # 10MB
LOG_BACKUP_COUNT=10

# 應用配置
MAX_UPLOAD_SIZE=5242880  # 5MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif
SESSION_TIMEOUT=3600  # 1 hour
```

---

## Python 實現代碼

### 使用者管理模組

```python
# user_manager.py

from db_manager import db
from werkzeug.security import generate_password_hash, check_password_hash
import logging
import re
from datetime import datetime, timedelta
import secrets

logger = logging.getLogger(__name__)

class UserManager:
    """使用者管理類"""

    # ==================== 驗證 ====================

    @staticmethod
    def validate_email(email: str) -> bool:
        """驗證郵箱格式"""
        pattern = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'
        return re.match(pattern, email) is not None

    @staticmethod
    def validate_password(password: str) -> tuple[bool, str]:
        """驗證密碼複雜度"""
        if len(password) < 8:
            return False, "密碼長度需至少 8 碼"
        if not re.search(r"[A-Z]", password):
            return False, "密碼需包含至少一個大寫字母"
        if not re.search(r"[a-z]", password):
            return False, "密碼需包含至少一個小寫字母"
        if not re.search(r"[0-9]", password):
            return False, "密碼需包含至少一個數字"
        return True, "密碼符合要求"

    # ==================== 註冊與登入 ====================

    @staticmethod
    def register(email: str, password: str, full_name: str = None) -> tuple[bool, str, int | None]:
        """
        註冊新使用者

        Returns:
            (success, message, user_id)
        """
        # 1. 驗證郵箱
        if not UserManager.validate_email(email):
            return False, "郵箱格式不正確", None

        # 2. 檢查郵箱是否已存在
        try:
            result = db.execute_query(
                "SELECT id FROM users WHERE email = %s",
                (email,),
                fetch_one=True
            )
            if result:
                return False, "該郵箱已被註冊", None
        except Exception as e:
            logger.error(f"查詢郵箱失敗: {str(e)}")
            return False, "系統錯誤", None

        # 3. 驗證密碼
        is_valid, msg = UserManager.validate_password(password)
        if not is_valid:
            return False, msg, None

        # 4. 加密密碼並插入資料庫
        try:
            password_hash = generate_password_hash(password)

            sql = """
                INSERT INTO users (email, password_hash, full_name, role_id, created_at)
                VALUES (%s, %s, %s, 1, NOW())
                RETURNING id;
            """

            with db.get_cursor() as cursor:
                cursor.execute(sql, (email, password_hash, full_name or email))
                user_id = cursor.fetchone()[0]

            # 5. 記錄活動日誌
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='user_created',
                resource_type='user',
                resource_id=user_id,
                action_details={'method': 'self_registration'}
            )

            logger.info(f"✅ 使用者 {email} 註冊成功 (ID: {user_id})")
            return True, "註冊成功", user_id

        except Exception as e:
            logger.error(f"❌ 註冊失敗: {str(e)}")
            return False, "註冊失敗", None

    @staticmethod
    def login(email: str, password: str, ip_address: str = None) -> tuple[bool, str, int | None]:
        """
        使用者登入

        Returns:
            (success, message, user_id)
        """
        try:
            # 1. 查詢使用者
            result = db.execute_query(
                "SELECT id, password_hash, is_active FROM users WHERE email = %s",
                (email,),
                fetch_one=True
            )

            if not result:
                logger.warning(f"❌ 登入失敗: 使用者不存在 ({email})")
                return False, "帳號或密碼錯誤", None

            user_id, password_hash, is_active = result

            # 2. 檢查帳戶是否停用
            if not is_active:
                logger.warning(f"❌ 登入失敗: 帳戶已停用 ({email})")
                return False, "帳戶已被停用", None

            # 3. 驗證密碼
            if not check_password_hash(password_hash, password):
                logger.warning(f"❌ 登入失敗: 密碼錯誤 ({email})")
                # 記錄失敗嘗試
                ErrorLogger.log_error(
                    user_id=user_id,
                    error_type='AuthenticationError',
                    error_message='登入密碼錯誤',
                    severity='warning'
                )
                return False, "帳號或密碼錯誤", None

            # 4. 更新登入時間和計數
            db.execute_update(
                "UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = %s",
                (user_id,)
            )

            # 5. 建立會話
            session_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(hours=1)

            db.execute_update(
                """
                INSERT INTO sessions (user_id, session_token, ip_address, expires_at)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, session_token, ip_address, expires_at)
            )

            # 6. 記錄活動日誌
            ActivityLogger.log_action(
                user_id=user_id,
                action_type='login',
                ip_address=ip_address
            )

            logger.info(f"✅ 使用者 {email} 登入成功")
            return True, "登入成功", user_id

        except Exception as e:
            logger.error(f"❌ 登入錯誤: {str(e)}")
            return False, "系統錯誤", None

    # ==================== 權限檢查 ====================

    @staticmethod
    def has_permission(user_id: int, permission_name: str) -> bool:
        """
        檢查使用者是否有特定權限
        """
        try:
            result = db.execute_query(
                """
                SELECT EXISTS(
                    SELECT 1 FROM role_permissions rp
                    JOIN roles r ON rp.role_id = r.id
                    JOIN permissions p ON rp.permission_id = p.id
                    JOIN users u ON u.role_id = r.id
                    WHERE u.id = %s AND p.permission_name = %s
                )
                """,
                (user_id, permission_name),
                fetch_one=True
            )
            return result[0] if result else False
        except Exception as e:
            logger.error(f"❌ 權限檢查失敗: {str(e)}")
            return False


class ActivityLogger:
    """活動日誌記錄"""

    @staticmethod
    def log_action(user_id: int, action_type: str, resource_type: str = None,
                   resource_id: int = None, action_details: dict = None, ip_address: str = None):
        """記錄使用者活動"""
        try:
            import json
            sql = """
                INSERT INTO activity_logs
                (user_id, action_type, resource_type, resource_id, action_details, ip_address, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (user_id, action_type, resource_type, resource_id, json.dumps(action_details or {}), ip_address)
            )
        except Exception as e:
            logger.error(f"❌ 記錄活動失敗: {str(e)}")


class ErrorLogger:
    """錯誤日誌記錄"""

    @staticmethod
    def log_error(user_id: int = None, error_type: str = None, error_message: str = None,
                  error_code: str = None, severity: str = 'error', context: dict = None):
        """記錄系統錯誤"""
        try:
            import json
            import traceback

            sql = """
                INSERT INTO error_logs
                (user_id, error_type, error_message, error_code, severity, context, error_traceback, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """
            db.execute_update(
                sql,
                (user_id, error_type, error_message, error_code, severity,
                 json.dumps(context or {}), traceback.format_exc())
            )
        except Exception as e:
            logger.error(f"❌ 記錄錯誤失敗: {str(e)}")
```

---

## 查詢範例

### 常用查詢

```python
# 查詢示例 - queries.py

from db_manager import db
from datetime import datetime, timedelta

class DetectionQueries:
    """檢測相關查詢"""

    @staticmethod
    def get_user_detections(user_id: int, limit: int = 50):
        """獲取使用者檢測歷史"""
        sql = """
            SELECT id, disease_name, severity, confidence, image_path,
                   created_at, status, processing_time_ms
            FROM detection_records
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """
        return db.execute_query(sql, (user_id, limit), dict_cursor=True)

    @staticmethod
    def get_disease_statistics(user_id: int):
        """獲取使用者病害統計"""
        sql = """
            SELECT
                disease_name,
                COUNT(*) as count,
                AVG(confidence)::numeric(5,4) as avg_confidence,
                MAX(confidence)::numeric(5,4) as max_confidence
            FROM detection_records
            WHERE user_id = %s AND status = 'completed'
            GROUP BY disease_name
            ORDER BY count DESC
        """
        return db.execute_query(sql, (user_id,), dict_cursor=True)

    @staticmethod
    def get_severity_distribution(user_id: int):
        """獲取嚴重程度分佈"""
        sql = """
            SELECT severity, COUNT(*) as count
            FROM detection_records
            WHERE user_id = %s AND status = 'completed'
            GROUP BY severity
        """
        return db.execute_query(sql, (user_id,), dict_cursor=True)


class LogQueries:
    """日誌查詢"""

    @staticmethod
    def get_activity_logs(days: int = 7, limit: int = 100):
        """獲取最近活動日誌"""
        sql = """
            SELECT al.id, u.email, al.action_type, al.resource_type,
                   al.action_details, al.ip_address, al.created_at
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.created_at >= NOW() - INTERVAL '%s days'
            ORDER BY al.created_at DESC
            LIMIT %s
        """
        return db.execute_query(sql, (days, limit), dict_cursor=True)

    @staticmethod
    def get_error_logs_unresolved(limit: int = 100):
        """獲取未解決的錯誤"""
        sql = """
            SELECT id, error_type, error_message, severity, endpoint,
                   created_at, error_traceback
            FROM error_logs
            WHERE is_resolved = FALSE
            ORDER BY created_at DESC
            LIMIT %s
        """
        return db.execute_query(sql, (limit,), dict_cursor=True)

    @staticmethod
    def get_api_performance(hours: int = 24):
        """獲取 API 性能統計"""
        sql = """
            SELECT
                endpoint,
                method,
                COUNT(*) as call_count,
                AVG(execution_time_ms)::integer as avg_time,
                MAX(execution_time_ms)::integer as max_time,
                MIN(execution_time_ms)::integer as min_time,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
            FROM api_logs
            WHERE created_at >= NOW() - INTERVAL '%s hours'
            GROUP BY endpoint, method
            ORDER BY avg_time DESC
        """
        return db.execute_query(sql, (hours,), dict_cursor=True)
```

---

## 備份與恢復

### 備份腳本

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="leaf_disease_ai"
DB_USER="postgres"

mkdir -p $BACKUP_DIR

# 完整資料庫備份
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_full_$TIMESTAMP.sql.gz

# 僅備份資料（不備份結構）
pg_dump -U $DB_USER --data-only $DB_NAME | gzip > $BACKUP_DIR/db_data_$TIMESTAMP.sql.gz

# 清理 30 天前的備份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "✅ 備份完成: $BACKUP_DIR/db_full_$TIMESTAMP.sql.gz"
```

### 恢復腳本

```bash
#!/bin/bash
# restore.sh

DB_NAME="leaf_disease_ai"
DB_USER="postgres"
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "用法: ./restore.sh <備份檔案>"
    exit 1
fi

# 刪除現有資料庫
dropdb -U $DB_USER $DB_NAME 2>/dev/null

# 建立新資料庫
createdb -U $DB_USER $DB_NAME

# 恢復備份
gunzip < $BACKUP_FILE | psql -U $DB_USER $DB_NAME

echo "✅ 恢復完成"
```

---

**更新日期**：2025 年 12 月 1 日
**狀態**：完整設計文檔 - 準備實施

# IMPLEMENTATION_GUIDE.md

# 🌿 Leaf Disease AI - psycopg2 + 日誌系統實施指南

## 📋 快速開始

### 步驟 1：安裝依賴

```bash
pip install psycopg2-binary python-dotenv werkzeug Flask
```

### 步驟 2：建立資料庫

```bash
# 連接到 PostgreSQL
psql -U postgres

# 建立資料庫
CREATE DATABASE leaf_disease_ai;

# 退出
\q

# 執行初始化腳本
psql -U postgres -d leaf_disease_ai -f init_database.sql
```

### 步驟 3：配置環境

```bash
# 複製環境配置文件
cp .env.example .env

# 編輯 .env 檔案，填入您的資料庫認證
nano .env
```

### 步驟 4：驗證連接

```python
from db_manager import db

# 測試連接
try:
    result = db.execute_query("SELECT NOW()", fetch_one=True)
    print("✅ 資料庫連接成功:", result)
except Exception as e:
    print("❌ 連接失敗:", e)
```

---

## 💻 使用示例

### 使用者管理

#### 1. 使用者註冊

```python
from user_manager import UserManager

success, message, user_id = UserManager.register(
    email="user@example.com",
    password="SecurePassword123",
    full_name="John Doe",
    ip_address="192.168.1.1"
)

if success:
    print(f"✅ 新用戶 ID: {user_id}")
else:
    print(f"❌ 錯誤: {message}")
```

#### 2. 使用者登入

```python
success, message, user_id, session_token = UserManager.login(
    email="user@example.com",
    password="SecurePassword123",
    ip_address="192.168.1.1",
    user_agent="Mozilla/5.0..."
)

if success:
    print(f"✅ 登入成功，User ID: {user_id}, Session: {session_token}")
    # 儲存 session_token 到 Cookie 或 Session
else:
    print(f"❌ 錯誤: {message}")
```

#### 3. 修改密碼

```python
success, message = UserManager.change_password(
    user_id=1,
    old_password="SecurePassword123",
    new_password="NewPassword456",
    ip_address="192.168.1.1"
)

if success:
    print(f"✅ {message}")
else:
    print(f"❌ {message}")
```

#### 4. 檢查權限

```python
# 檢查使用者是否可以上傳圖像
if UserManager.has_permission(user_id=1, permission_name='upload_image'):
    print("✅ 使用者有上傳權限")
    # 允許上傳
else:
    print("❌ 無上傳權限")
    # 拒絕上傳
```

#### 5. 獲取使用者資訊

```python
user_info = UserManager.get_user_info(user_id=1)
print(f"使用者郵箱: {user_info['email']}")
print(f"角色: {user_info['role_name']}")
print(f"登入次數: {user_info['login_count']}")
```

### 檢測記錄管理

#### 1. 保存檢測記錄

```python
from db_manager import db
import json

# 模型預測結果
detection_data = {
    'user_id': 1,
    'disease_name': 'Tomato_late_blight',
    'severity': 'Severe',
    'confidence': 0.95,
    'image_path': '/static/uploads/abc123.jpg',
    'image_hash': 'sha256_hash_value',
    'image_size': 102400,
    'raw_model_output': {'boxes': [...], 'masks': [...]},
    'status': 'completed',
    'processing_time_ms': 1250
}

sql = """
    INSERT INTO detection_records
    (user_id, disease_name, severity, confidence, image_path, image_hash,
     image_size, raw_model_output, status, processing_time_ms, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
    RETURNING id
"""

result = db.execute_returning(
    sql,
    (
        detection_data['user_id'],
        detection_data['disease_name'],
        detection_data['severity'],
        detection_data['confidence'],
        detection_data['image_path'],
        detection_data['image_hash'],
        detection_data['image_size'],
        json.dumps(detection_data['raw_model_output']),
        detection_data['status'],
        detection_data['processing_time_ms']
    )
)

print(f"✅ 檢測記錄已保存，ID: {result[0]}")
```

#### 2. 查詢使用者檢測記錄

```python
from user_manager import DetectionQueries

# 獲取最近 50 條記錄
records = DetectionQueries.get_user_detections(user_id=1, limit=50)

for record in records:
    print(f"病害: {record['disease_name']}, 置信度: {record['confidence']:.2%}")
```

#### 3. 病害統計

```python
# 獲取使用者檢測到的所有病害統計
stats = DetectionQueries.get_disease_statistics(user_id=1)

print("使用者的病害統計:")
for stat in stats:
    print(f"  {stat['disease_name']}: {stat['count']} 次, 平均置信度: {stat['avg_confidence']:.4f}")
```

### 日誌系統

#### 1. 記錄活動日誌

```python
from db_manager import ActivityLogger

ActivityLogger.log_action(
    user_id=1,
    action_type='upload',
    resource_type='detection_record',
    resource_id=123,
    action_details={
        'filename': 'leaf_sample.jpg',
        'file_size': 102400
    },
    ip_address='192.168.1.1'
)

print("✅ 活動已記錄")
```

#### 2. 記錄錯誤

```python
from db_manager import ErrorLogger

try:
    # 某些操作
    result = dangerous_operation()
except Exception as e:
    ErrorLogger.log_error(
        user_id=1,
        error_type='ProcessingError',
        error_message='圖像處理失敗',
        error_code='IMG_PROCESS_001',
        severity='error',
        context={
            'image_path': '/static/uploads/abc123.jpg',
            'operation': 'resize_image'
        },
        endpoint='/api/predict'
    )
    print("❌ 錯誤已記錄")
```

#### 3. 記錄審計日誌（管理員）

```python
from db_manager import AuditLogger

# 管理員分配角色
AuditLogger.log_operation(
    admin_id=2,  # 管理員 ID
    operation_type='role_assigned',
    target_table='users',
    target_id=5,
    old_values={'role_id': 1},
    new_values={'role_id': 2},
    change_summary='使用者角色從 User 更改為 Admin',
    ip_address='192.168.1.100'
)

print("✅ 審計日誌已記錄")
```

#### 4. 記錄 API 日誌

```python
from db_manager import APILogger
import time

# 在 Flask 路由中
@app.route('/api/predict', methods=['POST'])
def predict():
    start_time = time.time()

    try:
        # 處理預測
        result = model.predict(image)

        APILogger.log_request(
            user_id=1,
            endpoint='/api/predict',
            method='POST',
            status_code=200,
            execution_time_ms=int((time.time() - start_time) * 1000),
            ip_address=request.remote_addr,
            user_agent=request.user_agent.string,
            request_size=len(request.data),
            response_size=len(json.dumps(result))
        )

        return jsonify(result)
    except Exception as e:
        APILogger.log_request(
            user_id=1,
            endpoint='/api/predict',
            method='POST',
            status_code=500,
            execution_time_ms=int((time.time() - start_time) * 1000),
            ip_address=request.remote_addr,
            error_message=str(e)
        )
        return jsonify({'error': str(e)}), 500
```

#### 5. 記錄性能指標

```python
from db_manager import PerformanceLogger
import time

def slow_operation():
    start_time = time.time()

    # 執行長時間操作
    result = expensive_computation()

    execution_time = int((time.time() - start_time) * 1000)

    PerformanceLogger.log_performance(
        operation_name='expensive_computation',
        execution_time_ms=execution_time,
        status='success' if execution_time < 5000 else 'timeout',
        memory_used_mb=50.5,
        cpu_percentage=75.3,
        details={'input_size': 1000}
    )

    return result
```

### 查詢日誌

#### 1. 查詢活動日誌

```python
from user_manager import LogQueries

# 獲取最近 7 天的活動
logs = LogQueries.get_activity_logs(days=7, limit=100)

for log in logs:
    print(f"{log['created_at']}: {log['email']} - {log['action_type']}")
```

#### 2. 查詢未解決的錯誤

```python
errors = LogQueries.get_error_logs_unresolved(limit=50)

print("未解決的錯誤:")
for error in errors:
    print(f"  [{error['severity']}] {error['error_type']}: {error['error_message']}")
```

#### 3. 查詢 API 性能

```python
performance = LogQueries.get_api_performance(hours=24)

print("API 性能統計 (過去 24 小時):")
for stat in performance:
    print(f"  {stat['method']} {stat['endpoint']}")
    print(f"    呼叫次數: {stat['call_count']}")
    print(f"    平均時間: {stat['avg_time_ms']}ms")
    print(f"    錯誤數: {stat['error_count']}")
```

---

## 🔒 權限設置

### 查看所有權限

```sql
SELECT * FROM permissions;
```

### 查看各角色權限

```sql
SELECT r.role_name, p.permission_name
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.role_name, p.permission_name;
```

### 新增權限給角色

```sql
-- 例如：給 User 角色新增「查看分析」權限
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE permission_name = 'view_analytics';
```

### 檢查使用者權限

```python
# 方法 1: 使用函數
user_roles = db.execute_query(
    """
    SELECT r.role_name, p.permission_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE u.id = %s
    """,
    (user_id,),
    dict_cursor=True
)

# 方法 2: 使用管理方法
if UserManager.has_permission(user_id, 'view_logs'):
    print("用戶可查看日誌")
```

---

## 📊 視圖查詢

### 使用者統計視圖

```python
stats = db.execute_query(
    "SELECT * FROM user_statistics WHERE user_id = %s",
    (1,),
    fetch_one=True,
    dict_cursor=True
)

print(f"使用者 {stats['email']} 的統計:")
print(f"  總檢測數: {stats['total_detections']}")
print(f"  平均置信度: {stats['avg_confidence']:.4f}")
print(f"  最後檢測時間: {stats['last_detection_at']}")
```

### API 性能視圖

```python
performance_stats = db.execute_query(
    "SELECT * FROM api_performance_stats ORDER BY avg_time_ms DESC LIMIT 10",
    dict_cursor=True
)

print("效能最差的 10 個 API:")
for stat in performance_stats:
    print(f"  {stat['method']} {stat['endpoint']}: {stat['avg_time_ms']}ms")
```

---

## 🔄 事務操作

### 原子操作示例

```python
# 使用者重新分配角色時的事務
operations = [
    # 1. 更新使用者角色
    (
        "UPDATE users SET role_id = %s WHERE id = %s",
        (2, user_id)
    ),
    # 2. 記錄審計日誌
    (
        """
        INSERT INTO audit_logs (admin_id, operation_type, target_table, target_id, new_values)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (admin_id, 'role_assigned', 'users', user_id, json.dumps({'role_id': 2}))
    ),
]

success = db.transaction(operations)
if success:
    print("✅ 事務完成")
else:
    print("❌ 事務失敗，已回滾")
```

---

## 🛠️ 常用管理命令

### 備份資料庫

```bash
./backup.sh
```

### 恢復資料庫

```bash
./restore.sh backups/db_full_20251201_120000.sql.gz
```

### 清理過期會話

```sql
DELETE FROM sessions WHERE expires_at < NOW();
```

### 解決錯誤

```sql
UPDATE error_logs
SET is_resolved = TRUE, resolved_at = NOW(), resolution_note = '已修復'
WHERE id = 123;
```

---

**最後更新**：2025 年 12 月 1 日
**狀態**：完整實施指南
