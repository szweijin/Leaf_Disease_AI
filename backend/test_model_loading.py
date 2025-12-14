#!/usr/bin/env python3
"""
測試模型載入腳本
用於診斷整合檢測服務載入問題
"""

import os
import sys
from pathlib import Path

# 添加專案根目錄到 Python 路徑
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 載入環境變數
from dotenv import load_dotenv
load_dotenv()

from config.development import DevelopmentConfig

def test_model_paths():
    """測試模型路徑配置"""
    print("=" * 60)
    print("📦 檢查模型路徑配置")
    print("=" * 60)
    
    base_dir = project_root
    cnn_path_rel = getattr(DevelopmentConfig, 'CNN_MODEL_PATH_RELATIVE', 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth')
    yolo_path_rel = getattr(DevelopmentConfig, 'YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')
    
    cnn_path = os.path.join(base_dir, cnn_path_rel)
    yolo_path = os.path.join(base_dir, yolo_path_rel)
    
    print(f"\n📋 配置信息：")
    print(f"   專案根目錄: {base_dir}")
    print(f"   CNN 模型路徑（相對）: {cnn_path_rel}")
    print(f"   YOLO 模型路徑（相對）: {yolo_path_rel}")
    print(f"   CNN 模型路徑（絕對）: {cnn_path}")
    print(f"   YOLO 模型路徑（絕對）: {yolo_path}")
    
    # 檢查文件是否存在
    print(f"\n🔍 檢查模型文件：")
    cnn_exists = os.path.exists(cnn_path)
    yolo_exists = os.path.exists(yolo_path)
    
    print(f"   CNN 模型: {'✅ 存在' if cnn_exists else '❌ 不存在'}")
    if cnn_exists:
        size = os.path.getsize(cnn_path) / (1024 * 1024)  # MB
        print(f"      大小: {size:.2f} MB")
    else:
        print(f"      ⚠️  請檢查路徑或確保模型文件存在")
    
    print(f"   YOLO 模型: {'✅ 存在' if yolo_exists else '❌ 不存在'}")
    if yolo_exists:
        size = os.path.getsize(yolo_path) / (1024 * 1024)  # MB
        print(f"      大小: {size:.2f} MB")
    else:
        print(f"      ⚠️  請檢查路徑或確保模型文件存在")
    
    return cnn_exists and yolo_exists


def test_cnn_loading():
    """測試 CNN 模型載入"""
    print("\n" + "=" * 60)
    print("🧠 測試 CNN 模型載入")
    print("=" * 60)
    
    try:
        from modules.cnn_load import load_cnn_model
        from modules.cnn_utils import CNN_CLASSES
        
        base_dir = project_root
        cnn_path_rel = getattr(DevelopmentConfig, 'CNN_MODEL_PATH_RELATIVE', 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth')
        cnn_path = os.path.join(base_dir, cnn_path_rel)
        
        if not os.path.exists(cnn_path):
            print(f"❌ CNN 模型文件不存在: {cnn_path}")
            return False
        
        print(f"📦 載入 CNN 模型: {cnn_path}")
        num_classes = len(CNN_CLASSES)
        device = 'cuda' if __import__('torch').cuda.is_available() else 'cpu'
        print(f"   設備: {device}")
        print(f"   類別數: {num_classes}")
        
        model = load_cnn_model(cnn_path, num_classes, device)
        print(f"✅ CNN 模型載入成功")
        return True
        
    except Exception as e:
        print(f"❌ CNN 模型載入失敗: {str(e)}")
        import traceback
        print(f"   錯誤堆疊:\n{traceback.format_exc()}")
        return False


def test_yolo_loading():
    """測試 YOLO 模型載入"""
    print("\n" + "=" * 60)
    print("🎯 測試 YOLO 模型載入")
    print("=" * 60)
    
    try:
        from modules.yolo_load import load_yolo_model
        
        base_dir = project_root
        yolo_path_rel = getattr(DevelopmentConfig, 'YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')
        yolo_path = os.path.join(base_dir, yolo_path_rel)
        
        if not os.path.exists(yolo_path):
            print(f"❌ YOLO 模型文件不存在: {yolo_path}")
            return False
        
        print(f"📦 載入 YOLO 模型: {yolo_path}")
        
        model = load_yolo_model(yolo_path)
        print(f"✅ YOLO 模型載入成功")
        return True
        
    except Exception as e:
        print(f"❌ YOLO 模型載入失敗: {str(e)}")
        import traceback
        print(f"   錯誤堆疊:\n{traceback.format_exc()}")
        return False


def test_integrated_service():
    """測試整合檢測服務載入"""
    print("\n" + "=" * 60)
    print("🔗 測試整合檢測服務載入")
    print("=" * 60)
    
    try:
        from src.services.service_integrated import IntegratedDetectionService
        
        base_dir = project_root
        cnn_path_rel = getattr(DevelopmentConfig, 'CNN_MODEL_PATH_RELATIVE', 'model/CNN/CNN_v1.0_20251204/best_mobilenetv3_large.pth')
        yolo_path_rel = getattr(DevelopmentConfig, 'YOLO_MODEL_PATH_RELATIVE', 'model/yolov11/best_v1_50.pt')
        
        cnn_path = os.path.join(base_dir, cnn_path_rel)
        yolo_path = os.path.join(base_dir, yolo_path_rel)
        
        print(f"📦 初始化整合檢測服務...")
        print(f"   CNN: {cnn_path}")
        print(f"   YOLO: {yolo_path}")
        
        service = IntegratedDetectionService(cnn_path, yolo_path)
        print(f"✅ 整合檢測服務載入成功")
        return True
        
    except Exception as e:
        print(f"❌ 整合檢測服務載入失敗: {str(e)}")
        import traceback
        print(f"   錯誤堆疊:\n{traceback.format_exc()}")
        return False


def main():
    """主函數"""
    print("\n" + "=" * 60)
    print("🔍 整合檢測服務載入診斷工具")
    print("=" * 60)
    
    # 測試模型路徑
    paths_ok = test_model_paths()
    
    if not paths_ok:
        print("\n❌ 模型文件路徑檢查失敗，請先修復路徑問題")
        return
    
    # 測試 CNN 載入
    cnn_ok = test_cnn_loading()
    
    # 測試 YOLO 載入
    yolo_ok = test_yolo_loading()
    
    # 測試整合服務
    if cnn_ok and yolo_ok:
        integrated_ok = test_integrated_service()
    else:
        print("\n⚠️  跳過整合服務測試（單個模型載入失敗）")
        integrated_ok = False
    
    # 總結
    print("\n" + "=" * 60)
    print("📊 測試總結")
    print("=" * 60)
    print(f"   模型路徑: {'✅' if paths_ok else '❌'}")
    print(f"   CNN 載入: {'✅' if cnn_ok else '❌'}")
    print(f"   YOLO 載入: {'✅' if yolo_ok else '❌'}")
    print(f"   整合服務: {'✅' if integrated_ok else '❌'}")
    
    if integrated_ok:
        print("\n✅ 所有測試通過！整合檢測服務應該可以正常載入")
    else:
        print("\n❌ 部分測試失敗，請檢查上述錯誤信息")


if __name__ == "__main__":
    main()

