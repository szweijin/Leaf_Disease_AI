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
--       - prediction_log 表（CNN + YOLO 流程）
--       - 病害資訊資料
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
    login_failed_count INTEGER DEFAULT 0,
    
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
CREATE INDEX idx_disease_fulltext ON disease_library USING GIN(to_tsvector('simple', chinese_name || ' ' || causes));

-- ============================================
-- 7. 建立 prediction_log 表（CNN + YOLO 流程）
-- ============================================

DROP TABLE IF EXISTS prediction_log CASCADE;

CREATE TABLE prediction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 圖片資訊
    image_path TEXT NOT NULL,
    image_hash VARCHAR(64),
    image_size INTEGER,
    image_source VARCHAR(20) DEFAULT 'upload',
    image_data BYTEA,
    image_data_size INTEGER,
    image_compressed BOOLEAN DEFAULT FALSE,
    
    -- CNN 分類結果
    cnn_mean_score FLOAT,
    cnn_best_class VARCHAR(50),
    cnn_best_score FLOAT,
    cnn_all_scores JSONB,
    
    -- YOLO 檢測結果（如有執行）
    yolo_result JSONB,
    yolo_detected BOOLEAN DEFAULT FALSE,
    
    -- 流程狀態
    final_status VARCHAR(50) NOT NULL,
    workflow_step VARCHAR(50),
    
    -- 裁切相關（如需要）
    crop_coordinates JSONB,
    cropped_image_path TEXT,
    
    -- 圖片 URL（用於外部存儲）
    original_image_url TEXT,
    predict_img_url TEXT,
    
    -- 時間戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prediction_user_id ON prediction_log(user_id);
CREATE INDEX idx_prediction_status ON prediction_log(final_status);
CREATE INDEX idx_prediction_created_at ON prediction_log(created_at);
CREATE INDEX idx_prediction_image_hash ON prediction_log(image_hash);
CREATE INDEX idx_prediction_workflow_step ON prediction_log(workflow_step);

COMMENT ON TABLE prediction_log IS 'CNN + YOLO 完整預測流程記錄表';
COMMENT ON COLUMN prediction_log.cnn_mean_score IS 'CNN 平均分數（所有類別的平均）';
COMMENT ON COLUMN prediction_log.cnn_best_class IS 'CNN 最佳分類類別';
COMMENT ON COLUMN prediction_log.cnn_best_score IS 'CNN 最佳分類分數';
COMMENT ON COLUMN prediction_log.cnn_all_scores IS 'CNN 所有類別的分數（JSONB）';
COMMENT ON COLUMN prediction_log.yolo_result IS 'YOLO 檢測結果列表（JSONB）';
COMMENT ON COLUMN prediction_log.final_status IS '最終狀態：yolo_detected, need_crop, not_plant';
COMMENT ON COLUMN prediction_log.workflow_step IS '工作流程步驟：cnn_only, cnn_yolo, crop_required';
COMMENT ON COLUMN prediction_log.original_image_url IS '原始圖片 URL（Cloudinary 或其他外部存儲）';
COMMENT ON COLUMN prediction_log.predict_img_url IS '帶檢測框的預測結果圖片 URL（Cloudinary）';

-- ============================================
-- 8. 建立檢測記錄表
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
    image_source VARCHAR(20) DEFAULT 'upload',
    image_resized BOOLEAN DEFAULT FALSE,
    raw_model_output JSONB,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    image_data BYTEA,
    image_data_size INTEGER,
    image_compressed BOOLEAN DEFAULT FALSE,
    prediction_log_id UUID REFERENCES prediction_log(id) ON DELETE SET NULL,
    
    -- 圖片 URL（用於歷史記錄顯示）
    original_image_url TEXT,
    annotated_image_url TEXT,
    
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
CREATE INDEX idx_records_compressed ON detection_records(image_compressed);
CREATE INDEX idx_detection_prediction_log_id ON detection_records(prediction_log_id);
CREATE INDEX idx_detection_original_image_url ON detection_records(original_image_url) WHERE original_image_url IS NOT NULL;
CREATE INDEX idx_detection_annotated_image_url ON detection_records(annotated_image_url) WHERE annotated_image_url IS NOT NULL;

-- 為 prediction_log 的 original_image_url 創建索引
CREATE INDEX idx_prediction_original_image_url ON prediction_log(original_image_url) WHERE original_image_url IS NOT NULL;

-- 為 detection_records 的圖片 URL 欄位添加註釋
COMMENT ON COLUMN detection_records.original_image_url IS '原始圖片 URL（用於歷史記錄顯示）';
COMMENT ON COLUMN detection_records.annotated_image_url IS '帶檢測框的圖片 URL（用於歷史記錄顯示）';

-- ============================================
-- 9. 建立活動日誌表
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
        'register_failed', 'register_success', 'login_failed', 'upload_failed', 'predict_failed', 'prediction'
    ))
);

CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_action ON activity_logs(action_type);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_user_date ON activity_logs(user_id, created_at DESC);

-- ============================================
-- 10. 建立錯誤日誌表
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
        'AuthorizationError', 'FileError', 'NetworkError', 'SystemError', 'UnknownError', 'IntegratedPredictionError'
    )),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_error_severity ON error_logs(severity);
CREATE INDEX idx_error_type ON error_logs(error_type);
CREATE INDEX idx_error_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_resolved ON error_logs(is_resolved);
CREATE INDEX idx_error_user ON error_logs(user_id);

-- ============================================
-- 11. 建立審計日誌表
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
-- 12. 建立 API 日誌表
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
-- 13. 建立性能日誌表
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
-- 14. 建立視圖 - 使用者統計
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
-- 15. 建立視圖 - 錯誤統計
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
-- 16. 建立視圖 - API 效能統計
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
-- 17. 建立儲存函數 - 檢查使用者權限
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
-- 18. 建立儲存函數 - 記錄活動日誌
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
-- 19. 建立觸發函數 - 自動更新 updated_at
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
-- 20. 為表建立觸發器
-- ============================================

DROP TRIGGER IF EXISTS users_update_timestamp ON users;
CREATE TRIGGER users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS detection_records_update_timestamp ON detection_records;
CREATE TRIGGER detection_records_update_timestamp
BEFORE UPDATE ON detection_records
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS disease_library_update_timestamp ON disease_library;
CREATE TRIGGER disease_library_update_timestamp
BEFORE UPDATE ON disease_library
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================
-- 21. 插入病害資訊資料
-- ============================================

-- 1. 番茄早疫病 (Tomato_early_blight)
INSERT INTO disease_library (
    disease_name, chinese_name, english_name, causes, features,
    pesticides, management_measures, target_crops, is_active, created_at, updated_at
) VALUES (
    'Tomato__early_blight', '番茄早疫病', 'early blight',
    '真菌性疾病（Alternaria solani）',
    '本病會感染葉、莖、果實，形成褐色同心輪紋並伴隨黃暈。嚴重時葉片轉黃乾枯、果實凹陷腐敗。可由病果、種子及分生孢子傳播，透過風雨、流水與農具等散播，並從氣孔或角質層侵入。25–30℃的高溫多濕環境最有利病害迅速發展。',
    '["58% 松香酯銅（稀釋1500倍）；每隔 7 天施藥一次，共三次。", "81.3% 嘉賜銅（稀釋1000倍）；安全採收期3天；每隔 7 天施藥一次，共三次。"]'::jsonb,
    '["發病初期開始噴藥", "及時清除病株殘體", "保持通風良好、降低濕度", "實施輪作減少病原殘留"]'::jsonb,
    '["番茄"]'::jsonb,
    TRUE, NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    target_crops = EXCLUDED.target_crops,
    updated_at = NOW();

-- 2. 番茄晚疫病 (Tomato_late_blight)
INSERT INTO disease_library (
    disease_name, chinese_name, english_name, causes, features,
    pesticides, management_measures, target_crops, is_active, created_at, updated_at
) VALUES (
    'Tomato__late_blight', '番茄晚疫病', 'late blight',
    '卵菌綱疾病（Phytophthora infestans）',
    '危害葉片、新梢、莖與果實。初呈水浸狀後轉深褐並迅速擴大，嚴重時植株死亡。果實腐爛落果，高濕時病斑出現白色黴狀物。病菌存於土壤並於高濕環境釋放游走子藉水傳播。常於天氣轉涼、高濕、10–22℃時最為嚴重。',
    '["52.5% 凡殺克絕（稀釋2500倍）；安全採收期6天；每隔 7 天施藥一次，共四次。", "80% 免得爛（稀釋500倍）；安全採收期7天；每隔5～7天施藥一次。"]'::jsonb,
    '["發病初期與雨季前開始噴藥", "避免畦溝積水，做好水分管理", "清除嚴重感染植株", "避免夜間灌溉"]'::jsonb,
    '["番茄"]'::jsonb,
    TRUE, NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    target_crops = EXCLUDED.target_crops,
    updated_at = NOW();

-- 3. 番茄細菌性斑點病 (Tomato_bacterial_spot)
INSERT INTO disease_library (
    disease_name, chinese_name, english_name, causes, features,
    pesticides, management_measures, target_crops, is_active, created_at, updated_at
) VALUES (
    'Tomato__bacterial_spot', '番茄細菌性斑點病', 'bacterial spot',
    '細菌性疾病（Xanthomonas axonopodis）',
    '危害葉、莖、花序與果實。初呈水浸狀小斑點，後變深褐壞疽易穿孔；果實黑褐凹陷呈瘡痂狀。由病種子、病殘體及中間寄主傳播。24–30℃及連續風雨最易發病，雨水飛濺加速擴散。',
    '["81.3% 嘉賜銅（稀釋1000倍）；安全採收期6天；每隔 7 天施藥一次，共三次。", "53.8% 氫氧化銅水分散性粒劑（稀釋2000倍）；安全採收期6天；每隔 7 天施藥一次，共三次。"]'::jsonb,
    '["發病初期與雨季前開始噴藥", "保持通風、降低濕度", "確保工具消毒", "拔除感染源"]'::jsonb,
    '["番茄"]'::jsonb,
    TRUE, NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    target_crops = EXCLUDED.target_crops,
    updated_at = NOW();

-- 4. 馬鈴薯早疫病 (Potato_early_blight)
INSERT INTO disease_library (
    disease_name, chinese_name, english_name, causes, features,
    pesticides, management_measures, target_crops, is_active, created_at, updated_at
) VALUES (
    'Potato__early_blight', '馬鈴薯早疫病', 'early blight',
    '真菌性疾病（Alternaria solani）',
    '感染葉、莖，形成褐色同心輪紋並伴隨黃暈。嚴重時葉片轉黃乾枯，並由病果、種子與孢子傳播。25–30℃高溫多濕最利病害發生。',
    '["液化澱粉芽孢桿菌 YCMA1（稀釋600倍）；每隔7天施藥一次，共三次。", "9% 滅特座（稀釋1000倍）；安全採收期7天；必要時隔7天施藥一次。"]'::jsonb,
    '["發病初期噴藥", "清除病株殘體", "保持通風、降低濕度", "輪作減少病原殘留"]'::jsonb,
    '["馬鈴薯"]'::jsonb,
    TRUE, NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    target_crops = EXCLUDED.target_crops,
    updated_at = NOW();

-- 5. 馬鈴薯晚疫病 (Potato_late_blight)
INSERT INTO disease_library (
    disease_name, chinese_name, english_name, causes, features,
    pesticides, management_measures, target_crops, is_active, created_at, updated_at
) VALUES (
    'Potato__late_blight', '馬鈴薯晚疫病', 'late blight',
    '卵菌綱疾病（Phytophthora infestans）',
    '危害葉片、莖與塊莖。初呈水浸狀後轉深褐並迅速擴大，嚴重時整株死亡。高濕時病斑出現白色菌絲，病菌於土壤越冬並藉水傳播。',
    '["52.5% 凡殺克絕（稀釋2500倍）；安全採收期6天；每隔7天施藥一次，共四次。", "33% 鋅錳乃浦（稀釋600倍）；安全採收期12天；每隔7天施藥一次，共四次。"]'::jsonb,
    '["發病初期與雨季前施藥", "避免積水及保持良好排水", "清除感染植株", "避免夜間灌溉"]'::jsonb,
    '["馬鈴薯"]'::jsonb,
    TRUE, NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    target_crops = EXCLUDED.target_crops,
    updated_at = NOW();

-- 6. 甜椒細菌性斑點病 (Bell_pepper_bacterial_spot)
INSERT INTO disease_library (
    disease_name, chinese_name, english_name, causes, features,
    pesticides, management_measures, target_crops, is_active, created_at, updated_at
) VALUES (
    'Bell_pepper__bacterial_spot', '甜椒細菌性斑點病', 'bacterial spot',
    '細菌性疾病（Xanthomonas axonopodis）',
    '危害葉、莖、花序與果實。初呈小型水浸斑，後轉深褐壞疽並出現穿孔；果實黑褐凹陷呈瘡痂狀。病源可由病種子、病殘體及寄主傳播。24–30℃與連續風雨最易快速擴散。',
    '["81.3% 嘉賜銅（稀釋1000倍）；安全採收期3天；每隔7天施藥一次，共三次。", "27.12% 三元硫酸銅（稀釋500倍）；安全採收期3天；每隔7天施藥一次，共三次。"]'::jsonb,
    '["幼苗期、發病初期及雨季前開始噴藥", "保持通風、降低濕度", "工具消毒", "拔除感染源"]'::jsonb,
    '["甜椒"]'::jsonb,
    TRUE, NOW(), NOW()
)
ON CONFLICT (disease_name) DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    target_crops = EXCLUDED.target_crops,
    updated_at = NOW();

-- ============================================
-- 10. Cloudinary 優化：添加註釋和索引
-- ============================================

-- 為 detection_records 表添加註釋
COMMENT ON COLUMN detection_records.image_data IS '已棄用：圖片現在儲存在 Cloudinary，此欄位不再使用（保留以維持向後兼容）';
COMMENT ON COLUMN detection_records.image_data_size IS '已棄用：圖片現在儲存在 Cloudinary，此欄位不再使用（保留以維持向後兼容）';
COMMENT ON COLUMN detection_records.image_compressed IS '已棄用：圖片現在儲存在 Cloudinary，此欄位不再使用（保留以維持向後兼容）';
COMMENT ON COLUMN detection_records.image_path IS '圖片 URL：Cloudinary URL（https://...）或本地路徑（/image/xxx）';

-- 為 prediction_log 表添加註釋
COMMENT ON COLUMN prediction_log.image_data IS '已棄用：圖片現在儲存在 Cloudinary，此欄位不再使用（保留以維持向後兼容）';
COMMENT ON COLUMN prediction_log.image_data_size IS '已棄用：圖片現在儲存在 Cloudinary，此欄位不再使用（保留以維持向後兼容）';
COMMENT ON COLUMN prediction_log.image_compressed IS '已棄用：圖片現在儲存在 Cloudinary，此欄位不再使用（保留以維持向後兼容）';
COMMENT ON COLUMN prediction_log.image_path IS '圖片 URL：Cloudinary URL（https://...）或本地路徑（/image/prediction/xxx）';

-- 為 image_path 添加索引（用於快速查找 Cloudinary URL）
DO $$
BEGIN
    -- detection_records 表
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'detection_records' 
        AND indexname = 'idx_records_image_path'
    ) THEN
        CREATE INDEX idx_records_image_path ON detection_records(image_path);
        RAISE NOTICE '已創建索引: idx_records_image_path';
    ELSE
        RAISE NOTICE '索引已存在: idx_records_image_path';
    END IF;
    
    -- prediction_log 表
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'prediction_log' 
        AND indexname = 'idx_prediction_image_path'
    ) THEN
        CREATE INDEX idx_prediction_image_path ON prediction_log(image_path);
        RAISE NOTICE '已創建索引: idx_prediction_image_path';
    ELSE
        RAISE NOTICE '索引已存在: idx_prediction_image_path';
    END IF;
END $$;

-- 添加檢查約束（確保 image_path 格式正確）
DO $$
BEGIN
    -- detection_records 表
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_image_path_format'
    ) THEN
        ALTER TABLE detection_records
        ADD CONSTRAINT chk_image_path_format 
        CHECK (
            image_path IS NULL OR
            image_path LIKE 'http://%' OR 
            image_path LIKE 'https://%' OR 
            image_path LIKE '/image/%'
        );
        RAISE NOTICE '已添加約束: chk_image_path_format';
    ELSE
        RAISE NOTICE '約束已存在: chk_image_path_format';
    END IF;
    
    -- prediction_log 表
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_prediction_image_path_format'
    ) THEN
        ALTER TABLE prediction_log
        ADD CONSTRAINT chk_prediction_image_path_format 
        CHECK (
            image_path IS NULL OR
            image_path LIKE 'http://%' OR 
            image_path LIKE 'https://%' OR 
            image_path LIKE '/image/%'
        );
        RAISE NOTICE '已添加約束: chk_prediction_image_path_format';
    ELSE
        RAISE NOTICE '約束已存在: chk_prediction_image_path_format';
    END IF;
END $$;

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
\echo '  - disease_library (病害資訊庫，已插入6筆資料)'
\echo '  - detection_records (檢測記錄，圖片儲存在 Cloudinary)'
\echo '  - prediction_log (CNN + YOLO 預測流程記錄，圖片儲存在 Cloudinary)'
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
\echo '優化項目:'
\echo '  - 圖片儲存：完全使用 Cloudinary，資料庫只儲存 URL'
\echo '  - 索引優化：為 image_path 添加索引'
\echo '  - 資料驗證：添加 image_path 格式檢查約束'
\echo ''
\echo '✅ 所有資料庫結構已創建完成！'
