// LeafDetectionView.jsx
// 葉片檢測視圖（裁切確認）

import React, { useRef, useEffect, useState } from "react";

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
        <div className='fixed inset-0 bg-black/90 z-[1000] flex flex-col items-center justify-center p-5'>
            <div className='bg-white p-5 rounded-xl max-w-[90%] max-h-[90%] flex flex-col items-center'>
                {/* 返回按鈕 */}
                <button
                    onClick={onCancel}
                    className='self-start w-10 h-10 rounded-full bg-black/10 border-none cursor-pointer flex items-center justify-center text-xl mb-4 hover:bg-black/20 transition-colors'
                >
                    ←
                </button>

                {/* 圖片和檢測框 */}
                <div className='relative mb-5 border-2 border-primary-500 rounded-xl overflow-hidden'>
                    <canvas ref={canvasRef} className='block max-w-full max-h-[60vh]' />
                </div>

                {/* 提示文字 */}
                <p className='m-0 mb-5 text-base text-neutral-800 text-center'>
                    Check if the leaf is correctly detected.
                </p>

                {/* 操作按鈕 */}
                <div className='flex gap-2.5 w-full'>
                    <button
                        onClick={onCancel}
                        className='flex-1 py-3 px-4 bg-neutral-100 text-neutral-800 border border-neutral-300 rounded-lg cursor-pointer text-base hover:bg-neutral-200 transition-colors'
                    >
                        重新拍攝
                    </button>
                    <button
                        onClick={handleConfirm}
                        className='flex-1 py-3 px-4 bg-primary-500 text-white border-none rounded-lg cursor-pointer text-base flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors'
                    >
                        確認 →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LeafDetectionView;
