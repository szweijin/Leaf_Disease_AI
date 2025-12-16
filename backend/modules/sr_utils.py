"""
超解析度工具模組
包含超解析度模型的架構定義和工具函數

參考文獻:
Lim, B., Son, S., Kim, H., Nah, S., & Lee, K. M. (2017).
Enhanced Deep Residual Networks for Single Image Super-Resolution.
In Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR) Workshops.

模型實現參考: https://github.com/sanghyun-son/EDSR-PyTorch
"""

import torch
import torch.nn as nn
import logging

logger = logging.getLogger(__name__)


class EDSRBlock(nn.Module):
    """EDSR 基本塊（用於標準 EDSR）"""
    
    def __init__(self, num_features=64, kernel_size=3, res_scale=0.1):
        super(EDSRBlock, self).__init__()
        self.res_scale = res_scale
        
        self.conv1 = nn.Conv2d(num_features, num_features, kernel_size, padding=kernel_size//2)
        self.conv2 = nn.Conv2d(num_features, num_features, kernel_size, padding=kernel_size//2)
        self.relu = nn.ReLU(inplace=True)
    
    def forward(self, x):
        residual = x
        out = self.relu(self.conv1(x))
        out = self.conv2(out)
        out = out * self.res_scale
        return out + residual


class EDSRBlock_Son(nn.Module):
    """EDSR 基本塊（用於 sanghyun-son/EDSR-PyTorch 實現）"""
    
    def __init__(self, num_features=256, kernel_size=3):
        super(EDSRBlock_Son, self).__init__()
        self.body = nn.Sequential(
            nn.Conv2d(num_features, num_features, kernel_size, padding=kernel_size//2),
            nn.ReLU(inplace=True),
            nn.Conv2d(num_features, num_features, kernel_size, padding=kernel_size//2)
        )
    
    def forward(self, x):
        return x + self.body(x)


class EDSR(nn.Module):
    """EDSR (Enhanced Deep Super-Resolution) 模型 - 標準實現"""
    
    def __init__(self, num_channels=3, num_features=64, num_blocks=16, scale=2, res_scale=0.1):
        super(EDSR, self).__init__()
        self.scale = scale
        
        # 輸入層
        self.head = nn.Conv2d(num_channels, num_features, kernel_size=3, padding=1)
        
        # 殘差塊
        self.body = nn.Sequential(*[
            EDSRBlock(num_features, kernel_size=3, res_scale=res_scale)
            for _ in range(num_blocks)
        ])
        
        # 輸出層
        self.tail = nn.Sequential(
            nn.Conv2d(num_features, num_features, kernel_size=3, padding=1),
            nn.Conv2d(num_features, num_channels * (scale ** 2), kernel_size=3, padding=1)
        )
        
        # 上採樣層
        self.upsample = nn.PixelShuffle(scale)
    
    def forward(self, x):
        # 特徵提取
        x = self.head(x)
        residual = x
        
        # 殘差塊
        x = self.body(x)
        x = x + residual
        
        # 上採樣
        x = self.tail(x)
        x = self.upsample(x)
        
        return x


class EDSR_Son(nn.Module):
    """EDSR (Enhanced Deep Super-Resolution) 模型 - sanghyun-son/EDSR-PyTorch 實現"""
    
    def __init__(self, num_channels=3, num_features=256, num_blocks=32, scale=2):
        super(EDSR_Son, self).__init__()
        self.scale = scale
        
        # 均值減法和加法層（用於正規化）
        self.sub_mean = MeanShift()
        self.add_mean = MeanShift(sign=1)
        
        # 輸入層 (head.0)
        self.head = nn.Sequential(
            nn.Conv2d(num_channels, num_features, kernel_size=3, padding=1)
        )
        
        # 殘差塊 (body.0 到 body.31)
        body_blocks = [EDSRBlock_Son(num_features, kernel_size=3) for _ in range(num_blocks)]
        
        # 額外的卷積層 (body.32) - 需要作為 body 的一部分
        body_blocks.append(nn.Conv2d(num_features, num_features, kernel_size=3, padding=1))
        
        self.body = nn.Sequential(*body_blocks)
        
        # 輸出層
        # tail.0 是一個 Sequential，包含 tail.0.0 (256 -> 1024)
        # tail.1 是一個單獨的 Conv2d (256 -> 3)
        self.tail = nn.ModuleList([
            nn.Sequential(
                nn.Conv2d(num_features, num_features * (scale ** 2), kernel_size=3, padding=1)  # tail.0.0
            ),
            nn.Conv2d(num_features, num_channels, kernel_size=3, padding=1)  # tail.1
        ])
        
        # 上採樣層
        self.upsample = nn.PixelShuffle(scale)
    
    def forward(self, x):
        # 均值減法
        x = self.sub_mean(x)
        
        # 特徵提取
        x = self.head(x)
        residual = x
        
        # 殘差塊（包括 body.32）
        x = self.body(x)
        x = x + residual
        
        # 上採樣：通過 tail[0][0] (256 -> 1024) 然後 PixelShuffle
        x = self.tail[0][0](x)  # 256 -> 1024 (256 * 4)
        x = self.upsample(x)  # 上採樣並減少通道數 (1024 -> 256)
        
        # 輸出：通過 tail[1] (256 -> 3)
        out = self.tail[1](x)
        
        # 均值加法
        out = self.add_mean(out)
        
        return out


class MeanShift(nn.Module):
    """均值偏移層（用於正規化）"""
    
    def __init__(self, mean_rgb=(0.4488, 0.4371, 0.4040), sign=-1):
        super(MeanShift, self).__init__()
        self.sign = sign
        r = mean_rgb[0] * sign
        g = mean_rgb[1] * sign
        b = mean_rgb[2] * sign
        
        # 權重形狀應該是 [3, 3, 1, 1] 用於卷積操作
        # 這是一個 1x1 卷積，用於對每個通道進行均值偏移
        weight = torch.eye(3).view(3, 3, 1, 1) * sign
        bias = torch.Tensor([r, g, b]) * sign
        
        self.register_buffer('weight', weight)
        self.register_buffer('bias', bias)
    
    def forward(self, x):
        # 使用卷積操作進行均值偏移
        return torch.nn.functional.conv2d(x, self.weight, self.bias, padding=0)


class RCANBlock(nn.Module):
    """RCAN 通道注意力塊"""
    
    def __init__(self, num_features=64, reduction=16):
        super(RCANBlock, self).__init__()
        self.conv1 = nn.Conv2d(num_features, num_features, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(num_features, num_features, kernel_size=3, padding=1)
        self.relu = nn.ReLU(inplace=True)
        
        # 通道注意力
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(num_features, num_features // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(num_features // reduction, num_features, bias=False),
            nn.Sigmoid()
        )
    
    def forward(self, x):
        residual = x
        out = self.relu(self.conv1(x))
        out = self.conv2(out)
        
        # 通道注意力
        b, c, _, _ = out.size()
        y = self.avg_pool(out).view(b, c)
        y = self.fc(y).view(b, c, 1, 1)
        out = out * y
        
        return out + residual


class RCAN(nn.Module):
    """RCAN (Residual Channel Attention Network) 模型"""
    
    def __init__(self, num_channels=3, num_features=64, num_blocks=10, num_groups=5, scale=2, reduction=16):
        super(RCAN, self).__init__()
        self.scale = scale
        
        # 輸入層
        self.head = nn.Conv2d(num_channels, num_features, kernel_size=3, padding=1)
        
        # 殘差組
        self.body = nn.Sequential(*[
            nn.Sequential(*[
                RCANBlock(num_features, reduction)
                for _ in range(num_blocks)
            ])
            for _ in range(num_groups)
        ])
        
        # 輸出層
        self.tail = nn.Sequential(
            nn.Conv2d(num_features, num_features, kernel_size=3, padding=1),
            nn.Conv2d(num_features, num_channels * (scale ** 2), kernel_size=3, padding=1)
        )
        
        # 上採樣層
        self.upsample = nn.PixelShuffle(scale)
    
    def forward(self, x):
        # 特徵提取
        x = self.head(x)
        residual = x
        
        # 殘差組
        x = self.body(x)
        x = x + residual
        
        # 上採樣
        x = self.tail(x)
        x = self.upsample(x)
        
        return x


def create_edsr_model(scale=2, num_channels=3, num_features=64, num_blocks=16, use_son_implementation=False):
    """
    創建 EDSR 模型
    
    Args:
        scale: 放大倍數
        num_channels: 輸入通道數
        num_features: 特徵數
        num_blocks: 殘差塊數量
        use_son_implementation: 是否使用 sanghyun-son/EDSR-PyTorch 實現（匹配預訓練模型）
    
    Returns:
        EDSR 模型
    """
    if use_son_implementation:
        return EDSR_Son(
            num_channels=num_channels,
            num_features=256,  # sanghyun-son 實現使用 256 特徵
            num_blocks=32,  # sanghyun-son 實現使用 32 塊
            scale=scale
        )
    else:
        return EDSR(
            num_channels=num_channels,
            num_features=num_features,
            num_blocks=num_blocks,
            scale=scale
        )


def create_rcan_model(scale=2, num_channels=3, num_features=64, num_blocks=10, num_groups=5):
    """
    創建 RCAN 模型
    
    Args:
        scale: 放大倍數
        num_channels: 輸入通道數
        num_features: 特徵數
        num_blocks: 每個組的塊數量
        num_groups: 組數量
    
    Returns:
        RCAN 模型
    """
    return RCAN(
        num_channels=num_channels,
        num_features=num_features,
        num_blocks=num_blocks,
        num_groups=num_groups,
        scale=scale
    )


def prepare_image_for_sr(image_tensor: torch.Tensor, device: str = 'cpu') -> torch.Tensor:
    """
    準備圖片張量用於超解析度處理
    
    Args:
        image_tensor: 輸入圖片張量 (C, H, W) 或 (B, C, H, W)
        device: 設備類型
    
    Returns:
        準備好的圖片張量
    """
    # 確保是 4D 張量 (B, C, H, W)
    if image_tensor.dim() == 3:
        image_tensor = image_tensor.unsqueeze(0)
    
    # 確保在正確的設備上
    image_tensor = image_tensor.to(device)
    
    # 確保值在 [0, 1] 範圍內
    if image_tensor.max() > 1.0:
        image_tensor = image_tensor / 255.0
    
    return image_tensor


def postprocess_sr_output(output_tensor: torch.Tensor) -> torch.Tensor:
    """
    後處理超解析度輸出
    
    Args:
        output_tensor: 模型輸出張量
    
    Returns:
        後處理後的張量
    """
    # 確保值在 [0, 1] 範圍內
    output_tensor = torch.clamp(output_tensor, 0.0, 1.0)
    
    # 如果需要，轉換回 [0, 255] 範圍
    # output_tensor = output_tensor * 255.0
    
    return output_tensor

