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
                stream.getTracks().forEach((track) => track.stop());
            }

            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
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
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
    };

    const handleCapture = () => {
        if (!videoRef.current) return;

        const canvas = document.createElement("canvas");
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        // 轉換為 base64
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

        // 停止相機
        stopCamera();

        // 回傳圖片
        onCapture(dataUrl);
    };

    const handleSwitchCamera = () => {
        setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    };

    const handleToggleFlash = () => {
        setFlashEnabled((prev) => !prev);
        // 注意：瀏覽器 API 不直接支援閃光燈控制
        // 這裡只是 UI 狀態，實際閃光燈需要硬體支援
    };

    if (error) {
        return (
            <div className='fixed inset-0 bg-black/90 z-[1000] flex flex-col items-center justify-center text-white p-5'>
                <div className='text-center mb-5'>
                    <div className='text-5xl mb-5'>⚠️</div>
                    <h3 className='mb-2.5 text-xl font-bold'>無法訪問相機</h3>
                    <p className='text-neutral-300 mb-5'>{error}</p>
                    <p className='text-neutral-500 text-sm'>請確保已授予相機權限，並在 HTTPS 環境下使用</p>
                </div>
                <button
                    onClick={onClose}
                    className='px-6 py-3 bg-primary-500 text-white border-none rounded-lg cursor-pointer text-base hover:bg-primary-600 transition-colors'
                >
                    返回
                </button>
            </div>
        );
    }

    return (
        <div className='fixed inset-0 bg-black z-[1000] flex flex-col'>
            {/* 頂部控制欄 */}
            <div className='absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10'>
                <button
                    onClick={onClose}
                    className='w-10 h-10 rounded-full bg-white/30 border-none text-white text-xl cursor-pointer flex items-center justify-center hover:bg-white/40 transition-colors'
                >
                    ✕
                </button>
                <button
                    onClick={handleToggleFlash}
                    className={`w-10 h-10 rounded-full border-none text-white text-xl cursor-pointer flex items-center justify-center transition-colors ${
                        flashEnabled ? "bg-yellow-500/50 hover:bg-yellow-500/60" : "bg-white/30 hover:bg-white/40"
                    }`}
                >
                    ⚡
                </button>
            </div>

            {/* 相機視圖 */}
            <div className='flex-1 relative flex items-center justify-center overflow-hidden'>
                <video ref={videoRef} autoPlay playsInline className='w-full h-full object-cover' />

                {/* 取景框 */}
                <div
                    style={{
                        position: "absolute",
                        width: "80%",
                        height: "60%",
                        border: "4px solid white",
                        borderRadius: "20px",
                        pointerEvents: "none",
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                    }}
                >
                    {/* 角落標記 */}
                    <div
                        style={{
                            position: "absolute",
                            top: "-2px",
                            left: "-2px",
                            width: "30px",
                            height: "30px",
                            borderTop: "4px solid white",
                            borderLeft: "4px solid white",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: "-2px",
                            right: "-2px",
                            width: "30px",
                            height: "30px",
                            borderTop: "4px solid white",
                            borderRight: "4px solid white",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: "-2px",
                            left: "-2px",
                            width: "30px",
                            height: "30px",
                            borderBottom: "4px solid white",
                            borderLeft: "4px solid white",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: "-2px",
                            right: "-2px",
                            width: "30px",
                            height: "30px",
                            borderBottom: "4px solid white",
                            borderRight: "4px solid white",
                        }}
                    />
                </div>

                {/* 提示文字 */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "120px",
                        left: 0,
                        right: 0,
                        textAlign: "center",
                        color: "white",
                        fontSize: "16px",
                        fontWeight: "500",
                        textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                    }}
                >
                    Frame the plant's leaf within the box
                </div>
            </div>

            {/* 底部控制欄 */}
            <div
                style={{
                    padding: "20px",
                    backgroundColor: "rgba(0,0,0,0.7)",
                    display: "flex",
                    justifyContent: "space-around",
                    alignItems: "center",
                }}
            >
                {/* 相簿按鈕 */}
                <button
                    onClick={onSwitchToGallery}
                    style={{
                        width: "50px",
                        height: "50px",
                        backgroundColor: "transparent",
                        border: "2px solid white",
                        borderRadius: "8px",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                    }}
                >
                    📷
                </button>

                {/* 快門按鈕 */}
                <button
                    onClick={handleCapture}
                    style={{
                        width: "70px",
                        height: "70px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                        border: "4px solid rgba(255,255,255,0.5)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <div
                        style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            backgroundColor: "white",
                            border: "2px solid #333",
                        }}
                    />
                </button>

                {/* 切換相機按鈕 */}
                <button
                    onClick={handleSwitchCamera}
                    style={{
                        width: "50px",
                        height: "50px",
                        backgroundColor: "transparent",
                        border: "2px solid white",
                        borderRadius: "8px",
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "24px",
                    }}
                >
                    🔄
                </button>
            </div>
        </div>
    );
}

export default CameraView;
