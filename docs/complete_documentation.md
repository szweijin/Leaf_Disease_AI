# 🌿 葉片疾病分析系統 - 完整文檔

## 📋 目錄

1. [系統概述](#系統概述)
2. [系統架構設計](#系統架構設計)
3. [CNN + YOLO 推論流程](#cnn--yolo-推論流程)
4. [資料庫 Schema 設計](#資料庫-schema-設計)
5. [API 設計](#api-設計)
6. [前端實作](#前端實作)
7. [相機功能](#相機功能)
8. [實作指南](#實作指南)
9. [故障排除](#故障排除)

---

## 🎯 系統概述

本系統採用 **CNN 分類 + YOLO 檢測** 的兩階段架構：

1. **第一階段（CNN）**：分類圖片類型（植物種類或非植物）
2. **第二階段（YOLO）**：針對特定植物種類進行病害檢測

### 核心組件

- **CNN 分類模型**：MobileNetV3-Large，5 類分類
- **YOLO 檢測模型**：YOLOv11，病害檢測
- **分流邏輯**：根據 CNN 結果決定後續流程
- **資料庫**：PostgreSQL，記錄完整預測流程

---

## 🏗️ 系統架構設計

### 完整流程圖

```
┌─────────────────┐
│  使用者上傳圖片    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  圖片預處理       │
│  (resize, hash)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CNN 分類推論    │
│  (5 classes)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────┐
│計算分數│  │最佳分類│
│mean   │  │best   │
└──────┘  └──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│pepper   │ │whole    │ │others   │
│potato   │ │plant    │ │         │
│tomato   │ │         │ │         │
└────┬────┘ └────┬────┘ └────┬────┘
     │          │          │
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│進入 YOLO│ │要求裁切  │ │停止預測  │
│檢測     │ │介面     │ │錯誤訊息  │
└────┬────┘ └────┬────┘ └─────────┘
     │          │
     ▼          │
┌─────────┐     │
│YOLO 推論│     │
│病害檢測  │     │
└────┬────┘     │
     │          │
     ▼          │
┌─────────┐     │
│收集所有  │     │
│類別+分數 │     │
└────┬────┘     │
     │          │
     └────┬─────┘
          │
          ▼
    ┌─────────┐
    │寫入資料庫 │
    │prediction│
    │_log     │
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │回傳結果  │
    │給前端    │
    └─────────┘
```

---

## 🧠 CNN + YOLO 推論流程

### 階段 1: CNN 分類

**模型資訊：**
- **路徑**：`model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth`
- **類別**：`['others', 'pepper_bell', 'potato', 'tomato', 'whole_plant']`
- **輸出**：Softmax 機率分數

**處理邏輯：**
```python
# 1. 執行 CNN 推論
cnn_output = cnn_model(image)  # shape: [1, 5]
probs = softmax(cnn_output)    # shape: [5]

# 2. 計算平均分數
mean_score = probs.mean()

# 3. 找出最佳分類
best_class_idx = probs.argmax()
best_class = classes[best_class_idx]
best_score = probs[best_class_idx]
```

### 階段 2: 分流邏輯

#### 路徑 A: 進入 YOLO（pepper_bell, potato, tomato）

```python
if best_class in ['pepper_bell', 'potato', 'tomato']:
    # 執行 YOLO 檢測
    yolo_results = yolo_model(image)
    
    # 收集所有檢測結果
    yolo_detections = []
    for box in yolo_results.boxes:
        yolo_detections.append({
            'class': box.cls_name,
            'confidence': float(box.conf),
            'bbox': box.xyxy.tolist()
        })
    
    final_status = 'yolo_detected'
```

#### 路徑 B: 要求裁切（whole_plant）

```python
if best_class == 'whole_plant':
    # 不執行 YOLO
    # 前端顯示裁切介面
    final_status = 'need_crop'
    
    # 使用者裁切後，重新回到 CNN 推論
    # （使用裁切後的圖片）
```

#### 路徑 C: 非植物（others）

```python
if best_class == 'others':
    # 停止預測流程
    final_status = 'not_plant'
    
    # 前端顯示錯誤訊息
    error_message = "非植物影像，請上傳植物葉片圖片"
```

### 階段 3: 資料庫儲存

所有預測結果寫入 `prediction_log` 表：

```sql
INSERT INTO prediction_log (
    id, image_path, cnn_mean_score, cnn_best_class, 
    cnn_best_score, yolo_result, final_status, created_at
) VALUES (...);
```

---

## 🗄️ 資料庫 Schema 設計

### prediction_log 表

```sql
CREATE TABLE prediction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 圖片資訊
    image_path TEXT NOT NULL,
    image_hash VARCHAR(64),
    image_size INTEGER,
    image_source VARCHAR(20) DEFAULT 'upload',
    
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
    
    -- 時間戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### detection_records 表更新

```sql
ALTER TABLE detection_records 
ADD COLUMN prediction_log_id UUID REFERENCES prediction_log(id) ON DELETE SET NULL;
```

---

## 🔌 API 設計

### 1. 主要檢測端點：`POST /api/predict`

**請求：**
```json
{
  "image": "data:image/jpeg;base64,...",
  "source": "upload"
}
```

**回應（YOLO 檢測）：**
```json
{
  "status": "success",
  "workflow": "cnn_yolo",
  "cnn_result": {
    "mean_score": 0.85,
    "best_class": "tomato",
    "best_score": 0.92,
    "all_scores": {...}
  },
  "yolo_result": {
    "detected": true,
    "detections": [
      {
        "class": "Tomato_early_blight",
        "confidence": 0.95,
        "bbox": [100, 150, 300, 400]
      }
    ]
  },
  "final_status": "yolo_detected",
  "prediction_id": "uuid-here"
}
```

### 2. 裁切後重新檢測：`POST /api/predict-crop`

**請求：**
```json
{
  "prediction_id": "uuid-from-previous-request",
  "crop_coordinates": {
    "x": 100,
    "y": 150,
    "width": 400,
    "height": 400
  },
  "cropped_image": "data:image/jpeg;base64,..."
}
```

---

## 🎨 前端實作

### 新增組件

#### `ImageCropper.jsx` - 圖片裁切組件
- 當 CNN 分類為 `whole_plant` 時顯示裁切介面
- Canvas 繪製裁切區域
- 可拖動調整裁切框
- 自動計算裁切座標

#### `CameraView.jsx` - 相機視圖組件
- 使用瀏覽器 `getUserMedia` API 訪問相機
- 支援前後鏡頭切換
- 取景框引導使用者對準葉片

#### `LeafDetectionView.jsx` - 葉片檢測視圖
- 顯示綠色葉片形狀檢測框
- 確認或重新拍攝

### 更新組件

#### `DetectionPage.jsx` - 檢測頁面
- 主頁面顯示 "Take Photo" 和 "Upload Image" 按鈕
- 整合相機功能
- 識別中畫面（符合圖片設計）
- 顯示 CNN 分類結果
- 顯示多個 YOLO 檢測結果

---

## 📷 相機功能

### 功能特性

1. **相機拍攝功能**
   - 使用瀏覽器 `getUserMedia` API
   - 支援前後鏡頭切換
   - 取景框引導

2. **識別中畫面**
   - 符合圖片設計的載入畫面
   - 顯示預覽圖片
   - 進度條動畫

3. **葉片檢測視圖**
   - 顯示綠色葉片形狀檢測框
   - 確認或重新拍攝

### 使用流程

```
主頁面
  ↓
點擊 "Take Photo" 或 "Upload Image"
  ↓
相機介面 / 選擇圖片
  ↓
識別中畫面
  ↓
檢測結果
```

---

## 🚀 實作指南

### 1. 資料庫初始化

使用資料庫管理腳本：

```bash
python database/database_manager.py init
```

腳本會自動執行：
- 創建資料庫（如果不存在）
- 執行完整資料庫初始化（`database/init_database.sql`）
  - 包含：表結構、視圖、函數、觸發器、prediction_log 表、病害資訊資料

### 2. 安裝依賴

```bash
pip install torch torchvision pillow
```

### 3. 配置模型路徑

確認 `config/base.py` 中的模型路徑正確：

```python
CNN_MODEL_PATH_RELATIVE = 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth'
YOLO_MODEL_PATH_RELATIVE = 'model/yolov11/best_v1_50.pt'
```

### 4. 啟動服務

```bash
cd backend
python app.py
```

---

## 🔧 故障排除

### CNN 模型載入失敗

**問題：** `❌ CNN 模型載入失敗`

**解決方案：**
1. 確認模型檔案路徑正確
2. 確認 PyTorch 已正確安裝
3. 檢查模型檔案是否完整

### YOLO 模型載入失敗

**問題：** `❌ YOLO 模型載入失敗`

**解決方案：**
1. 確認 YOLO 模型路徑正確
2. 確認 ultralytics 已安裝：`pip install ultralytics`

### 資料庫表不存在

**問題：** `relation "prediction_log" does not exist`

**解決方案：**
```bash
python database/database_manager.py init
```

### 相機無法訪問

**問題：** 相機功能無法使用

**解決方案：**
1. 確保在 HTTPS 環境下使用（localhost 除外）
2. 檢查瀏覽器權限設定
3. 確認瀏覽器支援 `getUserMedia` API

---

## 📝 開發注意事項

1. **向後兼容**：舊的 `/predict` 端點仍然可用
2. **快取機制**：相同 hash 的圖片會使用快取結果
3. **錯誤處理**：所有錯誤都會記錄到資料庫和日誌
4. **性能監控**：每個階段的處理時間都會記錄

---

## 📚 相關文檔

- [資料庫 Schema SQL](../database/init_database.sql)
- [API 文檔](../backend/app.py)
- [序列圖](./sequences_diagram.md)
- [前端組件](../frontend/src/components/)

