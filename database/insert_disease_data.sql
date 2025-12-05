-- ============================================
-- 病害資訊資料插入腳本
-- PostgreSQL 13+
-- 執行: psql -U postgres -d leaf_disease_ai -f insert_disease_data.sql
-- 
-- 注意: 此腳本會將病害資訊插入到 disease_library 表中
--       如果資料已存在（根據 disease_name），會先刪除再插入
-- ============================================

-- 清除現有資料（可選，如果需要重新插入）
-- DELETE FROM disease_library WHERE disease_name IN (
--     'Tomato_early_blight',
--     'Tomato_late_blight',
--     'Tomato_bacterial_spot',
--     'Potato_early_blight',
--     'Potato_late_blight',
--     'Bell_pepper_bacterial_spot'
-- );

-- 使用 INSERT ... ON CONFLICT 來處理重複資料
-- 如果 disease_name 已存在，則更新資料；否則插入新資料

-- 1. 番茄早疫病 (Tomato_early_blight)
INSERT INTO disease_library (
    disease_name,
    chinese_name,
    english_name,
    causes,
    features,
    pesticides,
    management_measures,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Tomato_early_blight',
    '番茄早疫病',
    'early blight',
    '真菌性疾病（Alternaria solani）',
    '本病會感染葉、莖、果實，形成褐色同心輪紋並伴隨黃暈。嚴重時葉片轉黃乾枯、果實凹陷腐敗。可由病果、種子及分生孢子傳播，透過風雨、流水與農具等散播，並從氣孔或角質層侵入。25–30℃的高溫多濕環境最有利病害迅速發展。',
    '["58% 松香酯銅（稀釋1500倍）；每隔 7 天施藥一次，共三次。", "81.3% 嘉賜銅（稀釋1000倍）；安全採收期3天；每隔 7 天施藥一次，共三次。"]'::jsonb,
    '["發病初期開始噴藥", "及時清除病株殘體", "保持通風良好、降低濕度", "實施輪作減少病原殘留"]'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (disease_name) 
DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    updated_at = NOW();

-- 2. 番茄晚疫病 (Tomato_late_blight)
INSERT INTO disease_library (
    disease_name,
    chinese_name,
    english_name,
    causes,
    features,
    pesticides,
    management_measures,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Tomato_late_blight',
    '番茄晚疫病',
    'late blight',
    '卵菌綱疾病（Phytophthora infestans）',
    '危害葉片、新梢、莖與果實。初呈水浸狀後轉深褐並迅速擴大，嚴重時植株死亡。果實腐爛落果，高濕時病斑出現白色黴狀物。病菌存於土壤並於高濕環境釋放游走子藉水傳播。常於天氣轉涼、高濕、10–22℃時最為嚴重。',
    '["52.5% 凡殺克絕（稀釋2500倍）；安全採收期6天；每隔 7 天施藥一次，共四次。", "80% 免得爛（稀釋500倍）；安全採收期7天；每隔5～7天施藥一次。"]'::jsonb,
    '["發病初期與雨季前開始噴藥", "避免畦溝積水，做好水分管理", "清除嚴重感染植株", "避免夜間灌溉"]'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (disease_name) 
DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    updated_at = NOW();

-- 3. 番茄細菌性斑點病 (Tomato_bacterial_spot)
INSERT INTO disease_library (
    disease_name,
    chinese_name,
    english_name,
    causes,
    features,
    pesticides,
    management_measures,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Tomato_bacterial_spot',
    '番茄細菌性斑點病',
    'bacterial spot',
    '細菌性疾病（Xanthomonas axonopodis）',
    '危害葉、莖、花序與果實。初呈水浸狀小斑點，後變深褐壞疽易穿孔；果實黑褐凹陷呈瘡痂狀。由病種子、病殘體及中間寄主傳播。24–30℃及連續風雨最易發病，雨水飛濺加速擴散。',
    '["81.3% 嘉賜銅（稀釋1000倍）；安全採收期6天；每隔 7 天施藥一次，共三次。", "53.8% 氫氧化銅水分散性粒劑（稀釋2000倍）；安全採收期6天；每隔 7 天施藥一次，共三次。"]'::jsonb,
    '["發病初期與雨季前開始噴藥", "保持通風、降低濕度", "確保工具消毒", "拔除感染源"]'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (disease_name) 
DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    updated_at = NOW();

-- 4. 馬鈴薯早疫病 (Potato_early_blight)
INSERT INTO disease_library (
    disease_name,
    chinese_name,
    english_name,
    causes,
    features,
    pesticides,
    management_measures,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Potato_early_blight',
    '馬鈴薯早疫病',
    'early blight',
    '真菌性疾病（Alternaria solani）',
    '感染葉、莖，形成褐色同心輪紋並伴隨黃暈。嚴重時葉片轉黃乾枯，並由病果、種子與孢子傳播。25–30℃高溫多濕最利病害發生。',
    '["液化澱粉芽孢桿菌 YCMA1（稀釋600倍）；每隔7天施藥一次，共三次。", "9% 滅特座（稀釋1000倍）；安全採收期7天；必要時隔7天施藥一次。"]'::jsonb,
    '["發病初期噴藥", "清除病株殘體", "保持通風、降低濕度", "輪作減少病原殘留"]'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (disease_name) 
DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    updated_at = NOW();

-- 5. 馬鈴薯晚疫病 (Potato_late_blight)
INSERT INTO disease_library (
    disease_name,
    chinese_name,
    english_name,
    causes,
    features,
    pesticides,
    management_measures,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Potato_late_blight',
    '馬鈴薯晚疫病',
    'late blight',
    '卵菌綱疾病（Phytophthora infestans）',
    '危害葉片、莖與塊莖。初呈水浸狀後轉深褐並迅速擴大，嚴重時整株死亡。高濕時病斑出現白色菌絲，病菌於土壤越冬並藉水傳播。',
    '["52.5% 凡殺克絕（稀釋2500倍）；安全採收期6天；每隔7天施藥一次，共四次。", "33% 鋅錳乃浦（稀釋600倍）；安全採收期12天；每隔7天施藥一次，共四次。"]'::jsonb,
    '["發病初期與雨季前施藥", "避免積水及保持良好排水", "清除感染植株", "避免夜間灌溉"]'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (disease_name) 
DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    updated_at = NOW();

-- 6. 甜椒細菌性斑點病 (Bell_pepper_bacterial_spot)
INSERT INTO disease_library (
    disease_name,
    chinese_name,
    english_name,
    causes,
    features,
    pesticides,
    management_measures,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Bell_pepper_bacterial_spot',
    '甜椒細菌性斑點病',
    'bacterial spot',
    '細菌性疾病（Xanthomonas axonopodis）',
    '危害葉、莖、花序與果實。初呈小型水浸斑，後轉深褐壞疽並出現穿孔；果實黑褐凹陷呈瘡痂狀。病源可由病種子、病殘體及寄主傳播。24–30℃與連續風雨最易快速擴散。',
    '["81.3% 嘉賜銅（稀釋1000倍）；安全採收期3天；每隔7天施藥一次，共三次。", "27.12% 三元硫酸銅（稀釋500倍）；安全採收期3天；每隔7天施藥一次，共三次。"]'::jsonb,
    '["幼苗期、發病初期及雨季前開始噴藥", "保持通風、降低濕度", "工具消毒", "拔除感染源"]'::jsonb,
    TRUE,
    NOW(),
    NOW()
)
ON CONFLICT (disease_name) 
DO UPDATE SET
    chinese_name = EXCLUDED.chinese_name,
    english_name = EXCLUDED.english_name,
    causes = EXCLUDED.causes,
    features = EXCLUDED.features,
    pesticides = EXCLUDED.pesticides,
    management_measures = EXCLUDED.management_measures,
    updated_at = NOW();

-- ============================================
-- 完成訊息
-- ============================================

\echo '✅ 病害資訊資料插入完成！'
\echo ''
\echo '已插入/更新的病害:'
\echo '  1. 番茄早疫病 (Tomato_early_blight)'
\echo '  2. 番茄晚疫病 (Tomato_late_blight)'
\echo '  3. 番茄細菌性斑點病 (Tomato_bacterial_spot)'
\echo '  4. 馬鈴薯早疫病 (Potato_early_blight)'
\echo '  5. 馬鈴薯晚疫病 (Potato_late_blight)'
\echo '  6. 甜椒細菌性斑點病 (Bell_pepper_bacterial_spot)'
\echo ''
\echo '查詢資料:'
\echo '  SELECT * FROM disease_library WHERE is_active = TRUE;'
\echo ''

