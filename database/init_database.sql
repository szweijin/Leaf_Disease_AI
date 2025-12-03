-- ============================================
-- Leaf Disease AI - 完整資料庫初始化腳本
-- PostgreSQL 13+
-- 執行: psql -U postgres -d leaf_disease_ai -f init_database.sql
-- 
-- 注意: 此腳本包含所有資料庫結構：
--       - 表結構和初始數據
--       - 視圖（user_statistics, error_statistics, api_performance_stats）
--       - 函數（has_permission, log_activity, update_timestamp）
--       - 觸發器（自動更新時間戳）
--       - 圖片存儲功能（image_data, image_data_size, image_compressed）
-- 
-- 只需執行此一個腳本即可完成所有初始化！
-- ============================================

-- ============================================
-- 1. 建立角色表
-- ============================================

DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (id, role_name, description) VALUES
    (1, 'user', '普通使用者 - 可進行檢測、查看自己的紀錄'),
    (2, 'admin', '管理員 - 完整系統管理權限'),
    (3, 'developer', '開發者 - 可查看日誌、系統指標、執行維護操作');

-- ============================================
-- 2. 建立權限表
-- ============================================

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
-- 3. 建立角色權限關聯表
-- ============================================

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- User 角色
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 1, id FROM permissions WHERE permission_name IN ('upload_image', 'view_own_records');

-- Admin 角色（所有權限）
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions;

-- Developer 角色
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE permission_name IN ('view_logs', 'view_analytics', 'system_maintenance');

-- ============================================
-- 4. 建立使用者表
-- ============================================

DROP TABLE IF EXISTS users CASCADE;

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
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================
-- 5. 建立會話表
-- ============================================

DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    login_failed_count INTEGER DEFAULT 0, -- 連續登入失敗次數
    
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- 6. 建立病害資訊表
-- ============================================

DROP TABLE IF EXISTS disease_library CASCADE;

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
CREATE INDEX idx_disease_chinese ON disease_library(chinese_name);
CREATE INDEX idx_disease_active ON disease_library(is_active);
CREATE INDEX idx_disease_fulltext ON disease_library USING GIN(to_tsvector('chinese', chinese_name || ' ' || causes));

-- ============================================
-- 7. 建立檢測記錄表
-- ============================================

DROP TABLE IF EXISTS detection_records CASCADE;

CREATE TABLE detection_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    disease_name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    confidence NUMERIC(5, 4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    image_path VARCHAR(500) NOT NULL,
    image_hash VARCHAR(64) UNIQUE,
    image_size INTEGER,
    image_source VARCHAR(20) DEFAULT 'upload', -- 'camera', 'gallery', 'upload'
    image_resized BOOLEAN DEFAULT FALSE, -- 是否已 resize 640x640
    raw_model_output JSONB,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed', -- completed, processing, failed, duplicate, unrecognized
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 圖片存儲欄位（壓縮存儲到資料庫）
    image_data BYTEA, -- 壓縮後的圖片二進位資料（JPEG 格式，品質 75）
    image_data_size INTEGER, -- 壓縮後圖片的大小（位元組）
    image_compressed BOOLEAN DEFAULT FALSE, -- 是否已將圖片壓縮存儲在資料庫中
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_severity CHECK (severity IN ('Mild', 'Moderate', 'Severe', 'Healthy', 'Unknown')),
    CONSTRAINT chk_status CHECK (status IN ('completed', 'processing', 'failed', 'duplicate', 'unrecognized')),
    CONSTRAINT chk_image_source CHECK (image_source IN ('camera', 'gallery', 'upload'))
);

CREATE INDEX idx_records_user ON detection_records(user_id);
CREATE INDEX idx_records_disease ON detection_records(disease_name);
CREATE INDEX idx_records_created ON detection_records(created_at DESC);
CREATE INDEX idx_records_status ON detection_records(status);
CREATE INDEX idx_records_user_date ON detection_records(user_id, created_at DESC);
CREATE INDEX idx_records_confidence ON detection_records(confidence DESC);
CREATE INDEX idx_records_compressed ON detection_records(image_compressed); -- 圖片存儲索引

-- ============================================
-- 8. 建立活動日誌表
-- ============================================

DROP TABLE IF EXISTS activity_logs CASCADE;

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
    CONSTRAINT chk_action_type CHECK (action_type IN (
        'login', 'logout', 'upload', 'download', 'view', 'edit', 'delete',
        'password_change', 'profile_update', 'permission_change', 'user_created', 'system_event',
        'register_failed', 'register_success', 'login_failed', 'upload_failed', 'predict_failed'
    ))
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_action ON activity_logs(action_type);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_user_date ON activity_logs(user_id, created_at DESC);

-- ============================================
-- 9. 建立錯誤日誌表
-- ============================================

DROP TABLE IF EXISTS error_logs CASCADE;

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

-- ============================================
-- 10. 建立審計日誌表
-- ============================================

DROP TABLE IF EXISTS audit_logs CASCADE;

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

-- ============================================
-- 11. 建立 API 日誌表
-- ============================================

DROP TABLE IF EXISTS api_logs CASCADE;

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
    
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'))
);

CREATE INDEX idx_api_user ON api_logs(user_id);
CREATE INDEX idx_api_endpoint ON api_logs(endpoint);
CREATE INDEX idx_api_method ON api_logs(method);
CREATE INDEX idx_api_status ON api_logs(status_code);
CREATE INDEX idx_api_created ON api_logs(created_at DESC);
CREATE INDEX idx_api_perf ON api_logs(execution_time_ms DESC);

-- ============================================
-- 12. 建立性能日誌表
-- ============================================

DROP TABLE IF EXISTS performance_logs CASCADE;

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

CREATE INDEX idx_perf_operation ON performance_logs(operation_name);
CREATE INDEX idx_perf_time ON performance_logs(execution_time_ms DESC);
CREATE INDEX idx_perf_created ON performance_logs(created_at DESC);

-- ============================================
-- 13. 建立視圖 - 使用者統計
-- ============================================

DROP VIEW IF EXISTS user_statistics CASCADE;

CREATE VIEW user_statistics AS
SELECT
    u.id as user_id,
    u.email,
    u.full_name,
    r.role_name,
    COUNT(DISTINCT dr.id) as total_detections,
    COUNT(DISTINCT dr.disease_name) as unique_diseases,
    MAX(dr.created_at) as last_detection_at,
    ROUND(AVG(dr.confidence)::numeric, 4) as avg_confidence,
    u.login_count,
    u.last_login,
    u.created_at
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN detection_records dr ON u.id = dr.user_id AND dr.status = 'completed'
GROUP BY u.id, r.role_name;

-- ============================================
-- 14. 建立視圖 - 錯誤統計
-- ============================================

DROP VIEW IF EXISTS error_statistics CASCADE;

CREATE VIEW error_statistics AS
SELECT
    error_type,
    severity,
    COUNT(*) as count,
    COUNT(CASE WHEN is_resolved = FALSE THEN 1 END) as unresolved_count,
    MAX(created_at) as last_error_at
FROM error_logs
GROUP BY error_type, severity;

-- ============================================
-- 15. 建立視圖 - API 效能統計
-- ============================================

DROP VIEW IF EXISTS api_performance_stats CASCADE;

CREATE VIEW api_performance_stats AS
SELECT
    endpoint,
    method,
    COUNT(*) as call_count,
    ROUND(AVG(execution_time_ms)::numeric) as avg_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    MIN(execution_time_ms) as min_time_ms,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
    ROUND(100.0 * COUNT(CASE WHEN status_code >= 400 THEN 1 END) / COUNT(*), 2) as error_rate
FROM api_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint, method;

-- ============================================
-- 16. 建立儲存函數 - 檢查使用者權限
-- ============================================

DROP FUNCTION IF EXISTS has_permission(INTEGER, VARCHAR);

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
        AND u.is_active = TRUE
    ) INTO v_has_perm;
    
    RETURN v_has_perm;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 17. 建立儲存函數 - 記錄活動日誌
-- ============================================

DROP FUNCTION IF EXISTS log_activity(INTEGER, VARCHAR, VARCHAR, INTEGER, JSONB, INET, TEXT);

CREATE OR REPLACE FUNCTION log_activity(
    p_user_id INTEGER,
    p_action_type VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id INTEGER DEFAULT NULL,
    p_action_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_log_id INTEGER;
BEGIN
    INSERT INTO activity_logs (
        user_id, action_type, resource_type, resource_id,
        action_details, ip_address, user_agent, created_at
    ) VALUES (
        p_user_id, p_action_type, p_resource_type, p_resource_id,
        p_action_details, p_ip_address, p_user_agent, NOW()
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 18. 建立觸發函數 - 自動更新 updated_at
-- ============================================

DROP FUNCTION IF EXISTS update_timestamp();

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 19. 為表建立觸發器
-- ============================================

-- users 表觸發器
DROP TRIGGER IF EXISTS users_update_timestamp ON users;
CREATE TRIGGER users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- detection_records 表觸發器
DROP TRIGGER IF EXISTS detection_records_update_timestamp ON detection_records;
CREATE TRIGGER detection_records_update_timestamp
BEFORE UPDATE ON detection_records
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- disease_library 表觸發器
DROP TRIGGER IF EXISTS disease_library_update_timestamp ON disease_library;
CREATE TRIGGER disease_library_update_timestamp
BEFORE UPDATE ON disease_library
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================
-- 完成訊息
-- ============================================

\echo '✅ 資料庫初始化完成！'
\echo ''
\echo '建立的表:'
\echo '  - roles (角色)'
\echo '  - permissions (權限)'
\echo '  - role_permissions (角色-權限關聯)'
\echo '  - users (使用者)'
\echo '  - sessions (會話)'
\echo '  - disease_library (病害資訊庫)'
\echo '  - detection_records (檢測記錄，包含圖片存儲欄位)'
\echo '  - activity_logs (活動日誌)'
\echo '  - error_logs (錯誤日誌)'
\echo '  - audit_logs (審計日誌)'
\echo '  - api_logs (API 日誌)'
\echo '  - performance_logs (性能日誌)'
\echo ''
\echo '建立的視圖:'
\echo '  - user_statistics (使用者統計)'
\echo '  - error_statistics (錯誤統計)'
\echo '  - api_performance_stats (API 性能統計)'
\echo ''
\echo '建立的函數:'
\echo '  - has_permission() (檢查使用者權限)'
\echo '  - log_activity() (記錄活動日誌)'
\echo '  - update_timestamp() (自動更新時間戳)'
\echo ''
\echo '建立的觸發器:'
\echo '  - users_update_timestamp (自動更新 users.updated_at)'
\echo '  - detection_records_update_timestamp (自動更新 detection_records.updated_at)'
\echo '  - disease_library_update_timestamp (自動更新 disease_library.updated_at)'
\echo ''
\echo '✅ 所有資料庫結構已創建完成！'

-- ============================================
-- SQL 語句參考說明
-- ============================================
-- 
-- 本文檔包含所有資料庫表結構、視圖、函數和觸發器定義。
-- 專案中使用的 SQL 語句請參考 database/SQL_REFERENCE.md
--
-- 主要 SQL 操作位置：
-- 1. backend/src/core/user_manager.py - 使用者相關 SQL
-- 2. backend/src/services/detection_service.py - 檢測記錄相關 SQL
-- 3. backend/src/core/db_manager.py - 日誌相關 SQL
--
-- 所有 SQL 語句都使用參數化查詢，避免 SQL 注入攻擊
-- 所有資料庫操作都包含錯誤檢查和詳細的錯誤提示
--
-- ============================================
