# 多階段構建 Dockerfile（優化版本，減少映像大小）
# 用於 Railway 部署，確保同時安裝 Node.js 和 Python

# 階段 1: 構建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 設置 npm 配置以加快安裝速度
ENV NPM_CONFIG_PRODUCTION=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false

# 複製前端文件並安裝依賴（構建需要 devDependencies）
COPY frontend/package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund && \
    npm cache clean --force

# 複製前端源代碼
COPY frontend/ ./

# 構建前端（設置環境變數以加快構建）
ENV NODE_ENV=production
RUN npm run build

# 清理構建時不需要的文件（保留 dist 目錄）
RUN rm -rf node_modules src public *.json *.js *.ts *.config.* README.md .vite

# 階段 2: Python 後端（使用更小的基礎映像）
FROM python:3.11-slim

WORKDIR /app

# 安裝系統依賴（最小化，包含 bash 和 OpenCV 所需的庫）
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    bash \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 升級 pip 並設置環境變數（提前設置以優化後續安裝）
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# 先安裝 pip 和基礎工具
RUN pip install --upgrade pip setuptools wheel

# 分階段安裝依賴以利用構建緩存
# 先安裝輕量級依賴
COPY requirements.txt .
RUN pip install --no-cache-dir \
    Flask \
    flask-cors \
    psycopg2-binary \
    python-dotenv \
    werkzeug \
    Pillow \
    numpy \
    cloudinary \
    requests \
    redis \
    flask-caching \
    flask-swagger-ui \
    flasgger \
    gunicorn

# 再安裝深度學習框架（使用 CPU 版本，更小更快）
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

# 最後安裝其他依賴
RUN pip install --no-cache-dir \
    ultralytics \
    opencv-python-headless \
    timm

# 注意：開發依賴（pytest, pytest-cov, black, flake8）已排除，生產環境不需要

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

# 驗證模型文件是否正確複製（檢查文件大小和格式）
RUN python3 -c " \
import os; \
yolo_path = './model/yolov11/YOLOv11_v1_20251212/weights/best.pt'; \
print(f'🔍 驗證 YOLO 模型文件: {yolo_path}'); \
if not os.path.exists(yolo_path): \
    raise FileNotFoundError(f'YOLO 模型文件不存在: {yolo_path}'); \
size = os.path.getsize(yolo_path); \
print(f'   文件大小: {size / 1024 / 1024:.2f} MB ({size} bytes)'); \
if size < 1024 * 1024: \
    raise ValueError(f'YOLO 模型文件大小異常（{size} bytes），模型文件通常應該大於 1MB'); \
with open(yolo_path, 'rb') as f: \
    header = f.read(16); \
    header_preview = header[:4]; \
    header_hex = header.hex()[:8]; \
    print(f'   文件頭: {header_hex} ({repr(header_preview)})'); \
    if header_preview.startswith(b'v'): \
        f.seek(0); \
        try: \
            first_line = f.readline(100).decode('utf-8', errors='ignore').strip(); \
            raise ValueError(f'YOLO 模型文件格式異常，文件以 \\'v\\' 開頭，可能是文本文件而非模型文件\\n文件開頭內容: {first_line[:100]}'); \
        except: \
            raise ValueError(f'YOLO 模型文件格式異常，文件以 \\'v\\' 開頭，可能是文本文件而非模型文件'); \
    if header_preview.startswith(b'PK'): \
        print(f'   ✅ 文件頭格式正確（ZIP/PyTorch 格式）'); \
    else: \
        print(f'   ⚠️  文件頭不是標準的 ZIP 格式（\\'PK\\'），但繼續...'); \
print(f'✅ YOLO 模型文件驗證通過: {yolo_path} (大小: {size / 1024 / 1024:.2f} MB)'); \
" && \
python3 -c " \
import os; \
cnn_path = './model/CNN/CNN_v1.1_20251210/best_mobilenetv3_large.pth'; \
print(f'🔍 驗證 CNN 模型文件: {cnn_path}'); \
if not os.path.exists(cnn_path): \
    raise FileNotFoundError(f'CNN 模型文件不存在: {cnn_path}'); \
size = os.path.getsize(cnn_path); \
print(f'   文件大小: {size / 1024 / 1024:.2f} MB ({size} bytes)'); \
if size < 1024 * 1024: \
    raise ValueError(f'CNN 模型文件大小異常（{size} bytes），模型文件通常應該大於 1MB'); \
print(f'✅ CNN 模型文件驗證通過: {cnn_path} (大小: {size / 1024 / 1024:.2f} MB)'); \
"

# 注意：SR 模型和其他模型文件已排除，如需使用請在 .env 中配置並取消註釋
# SR 模型是可選的，如果 ENABLE_SR=false 或 SR_MODEL_PATH_RELATIVE 未設置，則不需要

# 從前端構建階段複製構建產物
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 複製其他必要文件
COPY railway-init.sh ./
COPY start.sh ./
RUN chmod +x railway-init.sh start.sh

# 設置應用環境變數
ENV FLASK_APP=backend/app.py

# 清理不必要的文件
RUN find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true && \
    find . -type f -name "*.pyc" -delete && \
    find . -type f -name "*.pyo" -delete

# 暴露端口
EXPOSE ${PORT:-5000}

# 簡化啟動命令，將邏輯移入 start.sh
CMD ["/bin/bash", "/app/start.sh"]

