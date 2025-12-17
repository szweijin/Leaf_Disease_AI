# 多階段構建 Dockerfile（優化版本，減少映像大小）
# 用於 Railway 部署，確保同時安裝 Node.js 和 Python

# 階段 1: 構建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 複製前端文件並安裝依賴（構建需要 devDependencies）
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# 複製前端源代碼
COPY frontend/ ./

# 構建前端
RUN npm run build

# 清理構建時不需要的文件（保留 dist 目錄）
RUN rm -rf node_modules src public *.json *.js *.ts *.config.* README.md .vite

# 階段 2: Python 後端（使用更小的基礎映像）
FROM python:3.11-slim

WORKDIR /app

# 安裝系統依賴（最小化）
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 只複製 requirements.txt 並安裝 Python 依賴（使用緩存優化）
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip cache purge

# 複製後端代碼和配置（排除不必要的文件）
COPY backend/ ./backend/
COPY config/ ./config/
COPY database/ ./database/

# 只複製 .env 中指定的模型文件（預設模型）
# 創建模型目錄結構
RUN mkdir -p ./model/CNN/CNN_v1.1_20251210 ./model/yolov11/YOLOv11_v1_20251212/weights

# 只複製預設使用的模型（根據 .env 配置）
# CNN 模型：model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth
# YOLO 模型：model/yolov11/YOLOv11_v1_20251212/weights/best.pt
COPY model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth ./model/CNN/CNN_v1.1_20251210/
COPY model/yolov11/YOLOv11_v1_20251212/weights/best.pt ./model/yolov11/YOLOv11_v1_20251212/weights/

# 注意：SR 模型和其他模型文件已排除，如需使用請在 .env 中配置並取消註釋
# SR 模型是可選的，如果 ENABLE_SR=false 或 SR_MODEL_PATH_RELATIVE 未設置，則不需要

# 從前端構建階段複製構建產物
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 複製其他必要文件
COPY railway-init.sh ./
RUN chmod +x railway-init.sh

# 設置環境變數
ENV PYTHONUNBUFFERED=1 \
    FLASK_APP=backend/app.py \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 清理不必要的文件
RUN find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true && \
    find . -type f -name "*.pyc" -delete && \
    find . -type f -name "*.pyo" -delete

# 暴露端口
EXPOSE ${PORT:-5000}

# 啟動命令（使用 shell 形式以支援 &&）
CMD ./railway-init.sh && cd backend && gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 2 --timeout 120 --access-logfile - --error-logfile -

