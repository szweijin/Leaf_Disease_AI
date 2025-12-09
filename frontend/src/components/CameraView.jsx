// CameraView.jsx
// 相機視圖組件

import React, { useRef, useEffect, useState } from "react";

function CameraView({ onCapture, onClose, onSwitchToGallery }) {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [facingMode, setFacingMode] = useState("environment"); // 'user' 或 'environment'
    const [flashEnabled, setFlashEnabled] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, [facingMode]);

    const startCamera = async () => {
        try {
            // 停止現有的串流
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            setStream(mediaStream);
            
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setError(null);
        } catch (err) {
            console.error("無法訪問相機:", err);
            setError("無法訪問相機，請檢查權限設定");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const handleCapture = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement('canvas');
        const video = videoRef.current;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // 轉換為 base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // 停止相機
        stopCamera();
        
        // 回傳圖片
        onCapture(dataUrl);
    };

    const handleSwitchCamera = () => {
        setFacingMode(prev => prev === "user" ? "environment" : "user");
    };

    const handleToggleFlash = () => {
        setFlashEnabled(prev => !prev);
        // 注意：瀏覽器 API 不直接支援閃光燈控制
        // 這裡只是 UI 狀態，實際閃光燈需要硬體支援
    };

    if (error) {
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
                color: 'white',
                padding: '20px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
                    <h3 style={{ marginBottom: '10px' }}>無法訪問相機</h3>
                    <p style={{ color: '#ccc', marginBottom: '20px' }}>{error}</p>
                    <p style={{ color: '#999', fontSize: '14px' }}>
                        請確保已授予相機權限，並在 HTTPS 環境下使用
                    </p>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    返回
                </button>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* 頂部控制欄 */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
            }}>
                <button
                    onClick={onClose}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        border: 'none',
                        color: 'white',
                        fontSize: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ✕
                </button>
                <button
                    onClick={handleToggleFlash}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: flashEnabled ? 'rgba(255,255,0,0.5)' : 'rgba(255,255,255,0.3)',
                        border: 'none',
                        color: 'white',
                        fontSize: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ⚡
                </button>
            </div>

            {/* 相機視圖 */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />

                {/* 取景框 */}
                <div style={{
                    position: 'absolute',
                    width: '80%',
                    height: '60%',
                    border: '4px solid white',
                    borderRadius: '20px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
                }}>
                    {/* 角落標記 */}
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        left: '-2px',
                        width: '30px',
                        height: '30px',
                        borderTop: '4px solid white',
                        borderLeft: '4px solid white'
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '30px',
                        height: '30px',
                        borderTop: '4px solid white',
                        borderRight: '4px solid white'
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        left: '-2px',
                        width: '30px',
                        height: '30px',
                        borderBottom: '4px solid white',
                        borderLeft: '4px solid white'
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '30px',
                        height: '30px',
                        borderBottom: '4px solid white',
                        borderRight: '4px solid white'
                    }} />
                </div>

                {/* 提示文字 */}
                <div style={{
                    position: 'absolute',
                    bottom: '120px',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: '500',
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                    Frame the plant's leaf within the box
                </div>
            </div>

            {/* 底部控制欄 */}
            <div style={{
                padding: '20px',
                backgroundColor: 'rgba(0,0,0,0.7)',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center'
            }}>
                {/* 相簿按鈕 */}
                <button
                    onClick={onSwitchToGallery}
                    style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'transparent',
                        border: '2px solid white',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                    }}
                >
                    📷
                </button>

                {/* 快門按鈕 */}
                <button
                    onClick={handleCapture}
                    style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: '4px solid rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        border: '2px solid #333'
                    }} />
                </button>

                {/* 切換相機按鈕 */}
                <button
                    onClick={handleSwitchCamera}
                    style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'transparent',
                        border: '2px solid white',
                        borderRadius: '8px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                    }}
                >
                    🔄
                </button>
            </div>
        </div>
    );
}

export default CameraView;

