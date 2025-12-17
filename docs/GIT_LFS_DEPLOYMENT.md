# Git LFS 部署指南

## 問題說明

本專案使用 **Git LFS (Large File Storage)** 管理模型文件（`.pt` 和 `.pth` 文件）。在部署到 Railway 時，如果構建環境沒有正確處理 LFS 文件，可能會只複製 LFS 的「指標文件（Pointer file）」（通常只有 133 bytes），而不是實際的模型文件（通常數十 MB）。

## 識別問題

如果構建時出現以下錯誤：

```
ValueError: YOLO 模型文件大小異常（133 bytes），模型文件通常應該大於 1MB
```

或者錯誤信息中包含：

```
Git LFS 指標文件（133 bytes）
文件內容:
version https://git-lfs.github.com/spec/v1
```

這表示構建時複製的是 LFS 指標文件，而不是實際的模型文件。

## 解決方案

### 方案 A：確保 LFS 文件已正確上傳（推薦）

1. **在本地檢查 LFS 文件狀態**：

```bash
# 檢查 LFS 文件是否已正確拉取
git lfs ls-files

# 檢查本地文件大小
ls -lh model/yolov11/YOLOv11_v1_20251212/weights/best.pt
ls -lh model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
```

2. **確保本地文件是真實的模型文件**（不是指標文件）：

```bash
# 如果文件只有 133 bytes，執行：
git lfs pull

# 再次檢查文件大小（應該為數十 MB）
ls -lh model/yolov11/YOLOv11_v1_20251212/weights/best.pt
```

3. **確保 LFS 文件已上傳到遠端**：

```bash
# 檢查 LFS 文件是否已推送到遠端
git lfs push origin main

# 或者推送到當前分支
git push origin $(git branch --show-current)
```

4. **驗證 GitHub 上的文件**：

- 訪問 GitHub 倉庫
- 檢查模型文件的大小（應該為數十 MB，而不是 133 bytes）
- 如果文件大小不對，需要重新上傳 LFS 文件

### 方案 B：使用 Railway Volume（推薦用於生產環境）

1. **在 Railway 專案中添加 Volume 服務**：

   - 在 Railway 專案中點擊 **"New"** → **"Volume"**
   - 創建一個名為 `model-storage` 的 Volume
   - 掛載到 `/app/model`

2. **手動上傳模型文件**：

```bash
# 使用 Railway CLI
railway volume create model-storage
railway volume mount model-storage /app/model

# 上傳模型文件
railway run bash
# 在容器中執行：
mkdir -p /app/model/CNN/CNN_v1.1_20251210
mkdir -p /app/model/yolov11/YOLOv11_v1_20251212/weights
# 然後使用 scp 或其他方式上傳文件
```

3. **更新環境變數**：

```bash
CNN_MODEL_PATH_RELATIVE=/app/model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
YOLO_MODEL_PATH_RELATIVE=/app/model/yolov11/YOLOv11_v1_20251212/weights/best.pt
```

### 方案 C：使用遠端下載（適合臨時解決）

如果 LFS 文件無法正確上傳，可以將模型文件上傳到雲端存儲（如 Google Drive、Dropbox、GitHub Release），然後在 Dockerfile 中下載。

1. **上傳模型文件到雲端**：

   - 上傳到 Google Drive、Dropbox 或其他雲端存儲
   - 獲取直接下載鏈接（需要公開訪問）

2. **修改 Dockerfile**：

在 `COPY model/...` 之前添加：

```dockerfile
# 安裝 wget
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# 創建目錄
RUN mkdir -p /app/model/CNN/CNN_v1.1_20251210 /app/model/yolov11/YOLOv11_v1_20251212/weights

# 從遠端下載模型文件（替換為實際的 URL）
RUN wget -O /app/model/yolov11/YOLOv11_v1_20251212/weights/best.pt \
    https://your-storage-link.com/best.pt && \
    wget -O /app/model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth \
    https://your-storage-link.com/best_mobilenetv3_large.pth
```

### 方案 D：取消 LFS 追蹤（不推薦，僅用於小文件）

如果模型文件不大（< 50MB），可以取消 LFS 追蹤，直接提交原始文件：

```bash
# 取消 LFS 追蹤
git lfs untrack "model/yolov11/YOLOv11_v1_20251212/weights/best.pt"
git lfs untrack "model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth"

# 重新添加文件（不使用 LFS）
git add --renormalize model/

# 提交更改
git commit -m "取消模型文件的 LFS 追蹤"
git push
```

**注意**：此方法會增加 Git 倉庫大小，不推薦用於大文件。

## 驗證步驟

部署後，檢查模型文件是否正確：

1. **查看構建日誌**：

   - 在 Railway 專案中查看 **"Deployments"** 標籤
   - 檢查模型文件驗證步驟的輸出
   - 確認文件大小正確（應該為數十 MB）

2. **檢查應用日誌**：

   - 查看應用啟動日誌
   - 確認模型載入成功
   - 如果出現模型載入錯誤，檢查模型路徑和文件大小

## 預防措施

1. **在 `.gitattributes` 中明確配置 LFS**：

```gitattributes
*.pt filter=lfs diff=lfs merge=lfs -text
*.pth filter=lfs diff=lfs merge=lfs -text
```

2. **在 CI/CD 中添加 LFS 檢查**：

```bash
# 在構建前檢查 LFS 文件
git lfs pull
ls -lh model/**/*.pt model/**/*.pth
```

3. **文檔化 LFS 使用**：

   - 在 README 中說明使用 LFS
   - 提供 LFS 設置和故障排除指南

## 相關資源

- [Git LFS 官方文檔](https://git-lfs.github.com/)
- [Railway Volume 文檔](https://docs.railway.app/develop/volumes)
- [Git LFS 故障排除](https://github.com/git-lfs/git-lfs/wiki/Troubleshooting)

