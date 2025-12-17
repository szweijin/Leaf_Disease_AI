# 多階段構建 Dockerfile
# 用於 Railway 部署，確保同時安裝 Node.js 和 Python

# 階段 1: 構建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 複製前端文件
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# 階段 2: Python 後端
FROM python:3.11-slim

WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 複製 requirements.txt 並安裝 Python 依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製後端代碼和配置
COPY backend/ ./backend/
COPY config/ ./config/
COPY database/ ./database/
COPY model/ ./model/

# 從前端構建階段複製構建產物
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 複製其他必要文件
COPY railway-init.sh ./
COPY build.sh ./
RUN chmod +x railway-init.sh build.sh

# 設置環境變數
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=backend/app.py

# 暴露端口
EXPOSE $PORT

# 啟動命令（使用 shell 形式以支援 &&）
CMD ./railway-init.sh && cd backend && gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 2 --timeout 120 --access-logfile - --error-logfile -

