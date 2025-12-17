import { useEffect, useRef } from "react";
import { toast } from "sonner";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ImageCropperProps {
    image: string;
    result: string;
    cropCount?: number;
    maxCropCount?: number;
    onCropComplete: (
        croppedImage: string,
        coordinates: { x: number; y: number; width: number; height: number }
    ) => void;
    onCancel: () => void;
}

function ImageCropper({
    image,
    cropCount = 1,
    maxCropCount = 3,
    onCropComplete,
    onCancel,
}: Omit<ImageCropperProps, "result">) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cropperRef = useRef<any>(null);
    const lastCropCountRef = useRef<number>(cropCount);
    const isMobile = useIsMobile();

    // 根據 crop 次數顯示不同的提示信息
    useEffect(() => {
        // 只在 crop 次數變化時顯示提示
        if (lastCropCountRef.current !== cropCount) {
            if (cropCount === 1) {
                toast.info("檢測到整株植物圖片，請裁切出葉片區域進行檢測");
            } else {
                toast.info(`第 ${cropCount}/${maxCropCount} 次裁切，請重新裁切葉片區域`);
            }
            lastCropCountRef.current = cropCount;
        }
    }, [cropCount, maxCropCount]);

    // 處理 Cropper 準備就緒
    const handleReady = () => {
        const cropper = cropperRef.current?.cropper;
        if (cropper) {
            // 設置初始裁切區域為圖片中心 80% 的區域
            cropper.setCropBoxData({
                width: cropper.getImageData().naturalWidth * 0.8,
                height: cropper.getImageData().naturalHeight * 0.8,
                left: cropper.getImageData().naturalWidth * 0.1,
                top: cropper.getImageData().naturalHeight * 0.1,
            });
        }
    };

    const handleCrop = () => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper) {
            toast.error("請先選擇裁切區域");
            return;
        }

        try {
            const croppedCanvas = cropper.getCroppedCanvas({
                width: 800,
                height: 800,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: "high",
            });

            if (!croppedCanvas) {
                toast.error("無法獲取裁切後的圖片");
                return;
            }

            const croppedImage = croppedCanvas.toDataURL("image/jpeg", 0.9);
            const cropData = cropper.getData();

            onCropComplete(croppedImage, {
                x: cropData.x,
                y: cropData.y,
                width: cropData.width,
                height: cropData.height,
            });
        } catch (error) {
            console.error("裁切失敗:", error);
            toast.error("裁切失敗，請重試");
        }
    };

    return (
        <div
            className={`container mx-auto ${isMobile ? "p-2" : "p-4"} max-w-4xl ${
                isMobile ? "h-[calc(100vh-4rem)]" : "h-[calc(100vh-3.5rem)]"
            } flex flex-col`}
        >
            <Card className='h-full flex flex-col border-none '>
                <CardHeader>
                    <CardTitle className={isMobile ? "text-lg" : ""}>裁切圖片</CardTitle>
                    <CardDescription className={isMobile ? "text-sm" : ""}>
                        {cropCount > 1
                            ? `第 ${cropCount}/${maxCropCount} 次裁切 - 請拖動綠色框選擇要檢測的葉片區域`
                            : "請拖動綠色框選擇要檢測的葉片區域"}
                    </CardDescription>
                </CardHeader>
                <CardContent className={`space-y-4 flex-1 flex flex-col overflow-hidden`}>
                    <div
                        className='relative border rounded-lg overflow-hidden bg-neutral-100 flex-1 min-h-0'
                        style={{
                            position: "relative",
                        }}
                    >
                        <Cropper
                            ref={cropperRef}
                            src={image}
                            style={{ height: "100%", width: "100%", display: "block" }}
                            aspectRatio={1}
                            guides={true}
                            viewMode={1}
                            dragMode='move'
                            cropBoxMovable={true}
                            cropBoxResizable={true}
                            toggleDragModeOnDblclick={false}
                            zoomable={true}
                            scalable={true}
                            rotatable={false}
                            responsive={true}
                            restore={false}
                            autoCropArea={0.8}
                            ready={handleReady}
                            background={false}
                        />
                    </div>
                    <div className={`flex ${isMobile ? "flex-col" : "flex-row"} gap-4 flex-shrink-0`}>
                        <Button onClick={handleCrop} className='flex-1'>
                            確認裁切
                        </Button>
                        <Button variant='destructive' onClick={onCancel} className={isMobile ? "w-full" : ""}>
                            <X className={`${isMobile ? "h-4 w-4" : "h-4 w-4"} mr-2`} />
                            取消
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default ImageCropper;
