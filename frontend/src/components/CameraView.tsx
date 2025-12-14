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
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx && videoRef.current) {
                ctx.drawImage(videoRef.current, 0, 0);
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
            <div className='flex-1 relative'>
                <video ref={videoRef} autoPlay playsInline className='w-full h-full object-cover' />
                {/* 取景框 */}
                <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='border-4 border-emerald-500 rounded-lg w-64 h-64' />
                </div>
            </div>
            <Card className='bg-black/80 border-0 rounded-none'>
                <CardContent className='p-4 flex items-center justify-center gap-4'>
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
