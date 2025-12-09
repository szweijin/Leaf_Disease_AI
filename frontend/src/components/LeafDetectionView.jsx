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

        const ctx = canvas.getContext('2d');
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

        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        // 繪製葉片形狀（簡化的心形+橢圓）
        ctx.ellipse(centerX, centerY, leafWidth / 2, leafHeight / 2, 0, 0, Math.PI * 2);
        
        // 添加葉柄
        ctx.moveTo(centerX + leafWidth / 2 * 0.3, centerY - leafHeight / 2);
        ctx.lineTo(centerX + leafWidth / 2 * 0.5, centerY - leafHeight / 2 - 20);
        
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
            crop_coordinates: null
        });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '12px',
                maxWidth: '90%',
                maxHeight: '90%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                {/* 返回按鈕 */}
                <button
                    onClick={onCancel}
                    style={{
                        alignSelf: 'flex-start',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        marginBottom: '15px'
                    }}
                >
                    ←
                </button>

                {/* 圖片和檢測框 */}
                <div style={{
                    position: 'relative',
                    marginBottom: '20px',
                    border: '2px solid #4CAF50',
                    borderRadius: '12px',
                    overflow: 'hidden'
                }}>
                    <canvas
                        ref={canvasRef}
                        style={{
                            display: 'block',
                            maxWidth: '100%',
                            maxHeight: '60vh'
                        }}
                    />
                </div>

                {/* 提示文字 */}
                <p style={{
                    margin: '0 0 20px 0',
                    fontSize: '16px',
                    color: '#333',
                    textAlign: 'center'
                }}>
                    Check if the leaf is correctly detected.
                </p>

                {/* 操作按鈕 */}
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    width: '100%'
                }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: '#f5f5f5',
                            color: '#333',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        重新拍攝
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        確認 →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default LeafDetectionView;

