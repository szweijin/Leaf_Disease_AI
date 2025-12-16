# 超解析度 (Super-Resolution) 預處理模組

## 概述

此模組提供 PyTorch 超解析度模型作為獨立的預處理模組，在進入 CNN 分類前對圖片進行解析度提升。

## 參考文獻

本模組使用的 EDSR 模型基於以下論文：

```bibtex
@InProceedings{Lim_2017_CVPR_Workshops,
  author = {Lim, Bee and Son, Sanghyun and Kim, Heewon and Nah, Seungjun and Lee, Kyoung Mu},
  title = {Enhanced Deep Residual Networks for Single Image Super-Resolution},
  booktitle = {The IEEE Conference on Computer Vision and Pattern Recognition (CVPR) Workshops},
  month = {July},
  year = {2017}
}
```

**論文標題**: Enhanced Deep Residual Networks for Single Image Super-Resolution  
**作者**: Bee Lim, Sanghyun Son, Heewon Kim, Seungjun Nah, Kyoung Mu Lee  
**會議**: CVPR 2017 Workshops

模型實現參考自 [sanghyun-son/EDSR-PyTorch](https://github.com/sanghyun-son/EDSR-PyTorch)

## 模組結構

-   **sr_load.py**: 超解析度模型加載器
-   **sr_utils.py**: 超解析度模型架構定義和工具函數
-   **sr_preprocess.py**: 超解析度預處理功能

## 功能特點

1. **支持多種模型架構**:

    - EDSR (Enhanced Deep Super-Resolution)
    - RCAN (Residual Channel Attention Network)

2. **可配置的放大倍數**: 支持 2x、4x、8x 放大

3. **自動設備選擇**: 自動使用 GPU (CUDA) 或 CPU

4. **可選的預訓練模型**: 支持加載預訓練權重或使用預設架構

## 使用方法

### 1. 環境變數配置

在 `.env` 文件中添加以下配置（可選）：

```env
# 啟用超解析度預處理（預設為 true）
ENABLE_SR=true

# 超解析度模型路徑（可選，如果為空則使用預設架構）
SR_MODEL_PATH_RELATIVE=model/SR/edsr_x2.pth

# 超解析度模型類型（預設為 'edsr'）
SR_MODEL_TYPE=edsr

# 超解析度放大倍數（預設為 2）
SR_SCALE=2
```

### 2. 程式碼使用

超解析度預處理已整合到 `IntegratedDetectionService` 中，會自動在 CNN 分類前執行：

```python
from src.services.service_integrated import IntegratedDetectionService

# 初始化服務（超解析度會自動啟用）
service = IntegratedDetectionService(
    cnn_model_path='model/CNN/...',
    yolo_model_path='model/yolov11/...',
    sr_model_path='model/SR/edsr_x2.pth',  # 可選
    sr_model_type='edsr',  # 可選
    sr_scale=2,  # 可選
    enable_sr=True  # 可選，預設為 True
)

# 執行預測（超解析度會自動應用）
result = service.predict(image_path='path/to/image.jpg', user_id=1)
```

### 3. 手動使用超解析度模組

如果需要單獨使用超解析度功能：

```python
from modules.sr_load import load_sr_model
from modules.sr_preprocess import enhance_image_with_sr
import torch

# 加載模型
model = load_sr_model(
    model_path='model/SR/edsr_x2.pth',  # 可選
    model_type='edsr',
    scale=2,
    device='cuda'  # 或 'cpu'
)

# 增強圖片
enhanced_path = enhance_image_with_sr(
    image_path='input.jpg',
    model=model,
    device='cuda',
    scale=2,
    output_path='output_sr.jpg'
)
```

## 模型架構

### EDSR (Enhanced Deep Super-Resolution)

-   **特點**: 簡化的殘差塊，移除批量正規化層
-   **適用場景**: 通用超解析度任務
-   **參數**: 可配置殘差塊數量（預設 16）

### RCAN (Residual Channel Attention Network)

-   **特點**: 通道注意力機制，更好的特徵提取
-   **適用場景**: 需要更精細特徵的超解析度任務
-   **參數**: 可配置組數和每組塊數

## 性能考量

1. **處理時間**: 超解析度處理會增加約 100-500ms 的處理時間（取決於圖片大小和設備）

2. **記憶體使用**: 放大後的圖片會佔用更多記憶體，建議監控系統資源

3. **GPU 加速**: 強烈建議使用 GPU 進行超解析度處理以獲得更好的性能

## 注意事項

1. **模型權重**: 如果沒有提供預訓練模型路徑，系統會使用未訓練的預設架構。建議使用預訓練模型以獲得最佳效果。

2. **圖片尺寸**: 超解析度會顯著增加圖片尺寸，確保後續處理流程能夠處理放大後的圖片。

3. **臨時文件**: 超解析度處理會創建臨時文件，處理完成後會自動清理。

## 故障排除

### 問題：超解析度模型加載失敗

**解決方案**:

-   檢查模型文件路徑是否正確
-   如果模型文件不存在，系統會使用預設架構（無預訓練權重）
-   查看日誌以獲取詳細錯誤信息

### 問題：記憶體不足

**解決方案**:

-   降低 `SR_SCALE` 值（例如從 4 改為 2）
-   使用 CPU 模式（較慢但記憶體需求較低）
-   減少圖片輸入尺寸

### 問題：處理速度慢

**解決方案**:

-   確保使用 GPU (CUDA)
-   考慮使用較小的模型架構
-   降低放大倍數

## 未來改進

-   [ ] 支持更多超解析度模型架構（ESRGAN、Real-ESRGAN 等）
-   [ ] 支持自適應放大倍數選擇
-   [ ] 添加超解析度質量評估指標
-   [ ] 支持批量處理優化
