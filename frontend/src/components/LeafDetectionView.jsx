// LeafDetectionView.jsx
// 葉片檢測視圖（裁切確認）

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function LeafDetectionView({ imageUrl, onConfirm, onCancel }) {
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const [imageLoaded, setImageLoaded] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            imageRef.current = img;
            setImageLoaded(true);
            drawCanvas();
        };
        img.src = imageUrl;
    }, [imageUrl]);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imageRef.current || !imageLoaded) return;

        const ctx = canvas.getContext("2d");
        const img = imageRef.current;

        // 設置 canvas 尺寸
        const maxWidth = 600;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // 繪製圖片
        ctx.drawImage(img, 0, 0, width, height);

        // 繪製葉片形狀檢測框（簡化版，使用橢圓形）
        const centerX = width / 2;
        const centerY = height / 2;
        const leafWidth = width * 0.6;
        const leafHeight = height * 0.7;

        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 3;
        ctx.beginPath();

        // 繪製葉片形狀（簡化的心形+橢圓）
        ctx.ellipse(centerX, centerY, leafWidth / 2, leafHeight / 2, 0, 0, Math.PI * 2);

        // 添加葉柄
        ctx.moveTo(centerX + (leafWidth / 2) * 0.3, centerY - leafHeight / 2);
        ctx.lineTo(centerX + (leafWidth / 2) * 0.5, centerY - leafHeight / 2 - 20);

        ctx.stroke();
    };

    useEffect(() => {
        if (imageLoaded) {
            drawCanvas();
        }
    }, [imageLoaded]);

    const handleConfirm = () => {
        // 直接使用原圖進行檢測（不裁切）
        onConfirm({
            cropped_image: imageUrl,
            crop_coordinates: null,
        });
    };

    return (
        <Dialog open={true} onOpenChange={onCancel}>
            <DialogContent className='bg-white p-5 max-w-[90%] max-h-[90%] flex flex-col items-center'>
                {/* 返回按鈕 */}
                <Button
                    variant='ghost'
                    size='icon'
                    onClick={onCancel}
                    className='self-start w-10 h-10 rounded-full mb-4'
                >
                    ←
                </Button>

                {/* 圖片和檢測框 */}
                <div className='relative mb-5 border-2 border-neutral-900 rounded-xl overflow-hidden'>
                    <canvas ref={canvasRef} className='block max-w-full max-h-[60vh]' />
                </div>

                {/* 提示文字 */}
                <p className='m-0 mb-5 text-base text-neutral-800 text-center'>
                    Check if the leaf is correctly detected.
                </p>

                {/* 操作按鈕 */}
                <div className='flex gap-2.5 w-full'>
                    <Button variant='outline' onClick={onCancel} className='flex-1'>
                        重新拍攝
                    </Button>
                    <Button onClick={handleConfirm} className='flex-1'>
                        確認 →
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default LeafDetectionView;
