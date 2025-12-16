import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import type { Area } from "react-easy-crop";

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
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const lastCropCountRef = useRef<number>(cropCount);

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

    const onCropChange = useCallback((crop: { x: number; y: number }) => {
        setCrop(crop);
    }, []);

    const onZoomChange = useCallback((zoom: number) => {
        setZoom(zoom);
    }, []);

    const onCropCompleteCallback = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener("load", () => resolve(image));
            image.addEventListener("error", (error) => reject(error));
            image.src = url;
        });

    const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("無法獲取 canvas context");
        }

        const maxSize = Math.max(image.width, image.height);
        const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

        canvas.width = safeArea;
        canvas.height = safeArea;

        ctx.drawImage(image, safeArea / 2 - image.width * 0.5, safeArea / 2 - image.height * 0.5);

        const data = ctx.getImageData(0, 0, safeArea, safeArea);

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.putImageData(
            data,
            Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
            Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Canvas is empty"));
                    return;
                }
                const reader = new FileReader();
                reader.addEventListener("load", () => {
                    resolve(reader.result as string);
                });
                reader.addEventListener("error", reject);
                reader.readAsDataURL(blob);
            }, "image/jpeg");
        });
    };

    const handleCrop = async () => {
        if (!croppedAreaPixels) {
            toast.error("請先選擇裁切區域");
            return;
        }

        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            onCropComplete(croppedImage, {
                x: croppedAreaPixels.x,
                y: croppedAreaPixels.y,
                width: croppedAreaPixels.width,
                height: croppedAreaPixels.height,
            });
        } catch (error) {
            console.error("裁切失敗:", error);
            toast.error("裁切失敗，請重試");
        }
    };

    return (
        <div className='container mx-auto p-4 max-w-4xl'>
            <Card>
                <CardHeader>
                    <CardTitle>裁切圖片</CardTitle>
                    <CardDescription>
                        {cropCount > 1
                            ? `第 ${cropCount}/${maxCropCount} 次裁切 - 請拖動綠色框選擇要檢測的葉片區域`
                            : "請拖動綠色框選擇要檢測的葉片區域"}
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div
                        className='relative border rounded-lg overflow-hidden bg-neutral-100'
                        style={{ height: "400px", position: "relative" }}
                    >
                        <Cropper
                            image={image}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={onCropChange}
                            onZoomChange={onZoomChange}
                            onCropComplete={onCropCompleteCallback}
                            cropShape='rect'
                            showGrid={true}
                            style={{
                                containerStyle: {
                                    width: "100%",
                                    height: "100%",
                                    position: "relative",
                                },
                            }}
                        />
                    </div>
                    <div className='flex flex-col sm:flex-row gap-4'>
                        <div className='flex-1 space-y-2'>
                            <label className='text-sm font-medium'>縮放</label>
                            <input
                                type='range'
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className='w-full'
                            />
                        </div>
                        <div className='flex gap-4'>
                            <Button onClick={handleCrop} className='flex-1'>
                                確認裁切
                            </Button>
                            <Button variant='outline' onClick={onCancel}>
                                <X className='h-4 w-4 mr-2' />
                                取消
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default ImageCropper;
