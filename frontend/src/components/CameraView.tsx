import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, X, RotateCcw } from "lucide-react";

interface CameraViewProps {
    onCapture: (imageData: string) => void;
    onCancel: () => void;
}

export default function CameraView({ onCapture, onCancel }: CameraViewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment"); // environment = 後置, user = 前置

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode },
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (err) {
            console.error("無法訪問相機:", err);
            alert("無法訪問相機，請檢查權限設定");
        }
    }, [facingMode]);

    useEffect(() => {
        startCamera();

        return () => {
            stopCamera();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facingMode]); // 只在 facingMode 改變時重新啟動相機

    const capturePhoto = () => {
        if (videoRef.current) {
            const video = videoRef.current;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // 獲取視頻在屏幕上的實際顯示尺寸
            const videoRect = video.getBoundingClientRect();
            const displayWidth = videoRect.width;
            const displayHeight = videoRect.height;

            // 計算視頻的縮放比例（考慮 object-cover 的效果）
            // object-cover 會保持寬高比並填滿容器，可能會裁剪部分內容
            const videoAspect = videoWidth / videoHeight;
            const displayAspect = displayWidth / displayHeight;

            // 計算統一的縮放比例（object-cover 保持寬高比）
            let scale: number;
            let offsetX = 0;
            let offsetY = 0;

            if (videoAspect > displayAspect) {
                // 視頻更寬，以高度為準縮放（左右會被裁剪）
                scale = videoHeight / displayHeight;
                const scaledWidth = displayWidth * scale;
                offsetX = (videoWidth - scaledWidth) / 2;
            } else {
                // 視頻更高，以寬度為準縮放（上下會被裁剪）
                scale = videoWidth / displayWidth;
                const scaledHeight = displayHeight * scale;
                offsetY = (videoHeight - scaledHeight) / 2;
            }

            // 計算取景框在屏幕上的位置和大小（1:1 正方形，90% 的較小邊）
            const frameSize = Math.min(displayWidth, displayHeight) * 0.9;
            const frameLeft = (displayWidth - frameSize) / 2;
            const frameTop = (displayHeight - frameSize) / 2;

            // 將取景框的屏幕座標轉換為視頻座標
            const cropX = frameLeft * scale + offsetX;
            const cropY = frameTop * scale + offsetY;
            const cropSize = frameSize * scale;

            // 確保截取區域在視頻範圍內
            const finalCropX = Math.max(0, Math.min(cropX, videoWidth - cropSize));
            const finalCropY = Math.max(0, Math.min(cropY, videoHeight - cropSize));
            const finalCropSize = Math.min(cropSize, videoWidth - finalCropX, videoHeight - finalCropY);

            // 創建 canvas 並截取對應區域
            const canvas = document.createElement("canvas");
            canvas.width = finalCropSize;
            canvas.height = finalCropSize;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(
                    video,
                    finalCropX,
                    finalCropY,
                    finalCropSize,
                    finalCropSize, // 從視頻中截取對應取景框的區域
                    0,
                    0,
                    finalCropSize,
                    finalCropSize // 繪製到 canvas
                );
                const imageData = canvas.toDataURL("image/jpeg");
                stopCamera();
                onCapture(imageData);
            }
        }
    };

    const switchCamera = () => {
        setFacingMode(facingMode === "environment" ? "user" : "environment");
    };

    return (
        <div className='fixed inset-0 bg-black z-50 flex flex-col'>
            <div className='flex-1 relative overflow-hidden'>
                <video ref={videoRef} autoPlay playsInline className='w-full h-full object-cover' />
                {/* 遮罩層 - 只在取景框區域顯示視頻 */}
                <div className='absolute inset-0 pointer-events-none'>
                    {/* 上方遮罩 */}
                    <div
                        className='absolute top-0 left-0 right-0 bg-black/70'
                        style={{
                            height: "calc(50% - min(45vw, 45vh))",
                        }}
                    />
                    {/* 下方遮罩 */}
                    <div
                        className='absolute bottom-0 left-0 right-0 bg-black/70'
                        style={{
                            height: "calc(50% - min(45vw, 45vh))",
                        }}
                    />
                    {/* 左方遮罩 */}
                    <div
                        className='absolute left-0 bg-black/70'
                        style={{
                            top: "calc(50% - min(45vw, 45vh))",
                            bottom: "calc(50% - min(45vw, 45vh))",
                            width: "calc(50% - min(45vw, 45vh))",
                        }}
                    />
                    {/* 右方遮罩 */}
                    <div
                        className='absolute right-0 bg-black/70'
                        style={{
                            top: "calc(50% - min(45vw, 45vh))",
                            bottom: "calc(50% - min(45vw, 45vh))",
                            width: "calc(50% - min(45vw, 45vh))",
                        }}
                    />
                </div>
                {/* 取景框邊框 - 1:1 置中 */}
                <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                    <div
                        className='border-6 border-emerald-500 aspect-square'
                        style={{
                            width: "min(90vw, 90vh)",
                            height: "min(90vw, 90vh)",
                        }}
                    />
                    {/* 葉子圖示SVG */}
                    <span
                        className='absolute'
                        style={{
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -60%) scale(5) rotate(180deg)",
                            pointerEvents: "none",
                            zIndex: 1,
                        }}
                    >
                        <svg
                            width={64}
                            height={64}
                            viewBox='0 0 512 512'
                            fill='none'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <path
                                d='M431.58 32.35a5.93 5.93 0 0 0-6.53-2.24C248.25 82.58 138 157.69 97.48 253.36c-33.9 80-6.33 145.74-.61 157.86-14.52 39.23-17.47 63.67-17.54 64.32a6 6 0 0 0 5.3 6.57l.63 0a6 6 0 0 0 5.93-5.33c.07-.62 2.88-23.4 16.33-60.17 9.37.62 18.63 1.09 27.57 1.09C265.81 417.73 349 352 365.16 234.05 382 111.18 431.13 40 431.62 39.26A6 6 0 0 0 431.58 32.35ZM353.36 232.44C330.81 396.69 183.25 409.08 111.93 405.1c26.47-66.66 85.64-171 216.14-274.67a6 6 0 0 0-7.42-9.35C192.08 223.25 131.48 326.46 103.24 395a190.72 190.72 0 0 1 5.22-137C146.41 168.49 249 97.25 413.31 46.13 398 72.66 366.49 136.72 353.36 232.44Z'
                                fill='#16a34a'
                                stroke='#16a34a'
                                strokeWidth={1}
                            />
                        </svg>
                    </span>
                    <span className='text-white text-xl font-bold absolute bottom-5 left-1/2 -translate-x-1/2 -translate-y-1/2'>
                        請對準葉片拍攝
                    </span>
                </div>
            </div>
            <Card className='bg-white border-0 rounded-none'>
                <CardContent className='p-4 flex items-center justify-center gap-10'>
                    <Button variant='ghost' size='icon' onClick={onCancel}>
                        <X className='h-6 w-6' />
                    </Button>
                    <Button size='lg' onClick={capturePhoto} className='rounded-full w-16 h-16'>
                        <Camera className='h-8 w-8' />
                    </Button>
                    <Button variant='ghost' size='icon' onClick={switchCamera}>
                        <RotateCcw className='h-6 w-6' />
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
