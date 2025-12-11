"""
CNN 工具函數模組
提供類別定義、狀態判斷等工具函數
"""

# CNN 類別定義
CNN_CLASSES = ['others', 'pepper_bell', 'potato', 'tomato', 'whole_plant']


def should_run_yolo(best_class: str) -> bool:
    """
    判斷是否應該執行 YOLO 檢測
    
    Args:
        best_class: CNN 最佳分類類別
    
    Returns:
        True 如果應該執行 YOLO，False 否則
    """
    return best_class in ['pepper_bell', 'potato', 'tomato']


def get_final_status(best_class: str) -> str:
    """
    根據 CNN 分類結果獲取最終狀態
    
    Args:
        best_class: CNN 最佳分類類別
    
    Returns:
        最終狀態：'yolo_detected', 'need_crop', 'not_plant'
    """
    if best_class in ['pepper_bell', 'potato', 'tomato']:
        return 'yolo_detected'  # 會執行 YOLO，最終狀態在 YOLO 完成後確定
    elif best_class == 'whole_plant':
        return 'need_crop'
    elif best_class == 'others':
        return 'not_plant'
    else:
        return 'unknown'
