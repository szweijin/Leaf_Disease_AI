import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import CameraView from "@/components/CameraView";
import ImageCropper from "@/components/ImageCropper";
import LeafDetectionView from "@/components/LeafDetectionView";
import { Upload, Camera, Loader2 } from "lucide-react";

type Mode = "idle" | "camera" | "processing" | "result" | "crop";

function PredictPage() {
    const [mode, setMode] = useState<Mode>("idle");
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    useEffect(() => {
        if (error) {
            toast.error(error);
            setError(""); // 清除錯誤，避免重複顯示
        }
    }, [error]);

    // 處理文件選擇
    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("請選擇圖片文件");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target?.result as string;
            setImage(imageData);
            setMode("processing");
            handlePredict(imageData);
        };
        reader.readAsDataURL(file);
    };

    // 處理文件輸入
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    // 處理相機拍攝
    const handleCameraCapture = (imageData: string) => {
        setImage(imageData);
        setMode("processing");
        handlePredict(imageData);
    };

    // 處理預測
    const handlePredict = async (imageData: string) => {
        setError("");

        try {
            // 移除 data URL 前綴（如果有的話）
            const base64Data = imageData.includes(",") ? imageData.split(",")[1] : imageData;

            const res = await apiFetch("/api/predict", {
                method: "POST",
                body: JSON.stringify({
                    image: base64Data,
                    source: "upload",
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "檢測失敗");
                setMode("idle");
                return;
            }

            // 檢查是否需要裁切（後端返回 final_status === 'need_crop'）
            if (data.final_status === "need_crop") {
                setResult(data);
                setMode("crop");
            } else if (data.final_status === "not_plant") {
                // 非植物影像
                setError(data.error || "非植物影像，請上傳植物葉片圖片");
                setMode("idle");
            } else {
                setResult(data);
                setMode("result");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
            setMode("idle");
        }
    };

    // 處理裁切完成
    const handleCropComplete = async (
        croppedImage: string,
        coordinates: { x: number; y: number; width: number; height: number }
    ) => {
        setMode("processing");
        setError("");

        try {
            const base64Data = croppedImage.includes(",") ? croppedImage.split(",")[1] : croppedImage;

            const res = await apiFetch("/api/predict-crop", {
                method: "POST",
                body: JSON.stringify({
                    prediction_id: result.prediction_id,
                    crop_coordinates: coordinates,
                    cropped_image: base64Data,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "檢測失敗");
                setMode("crop");
                return;
            }

            setResult(data);
            setMode("result");
        } catch (err) {
            setError(err instanceof Error ? err.message : "網絡錯誤");
            setMode("crop");
        }
    };

    // 重置
    const handleReset = () => {
        setMode("idle");
        setImage(null);
        setResult(null);
        setError("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // 拖曳處理
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (mode !== "idle") return;

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    // 相機模式
    if (mode === "camera") {
        return <CameraView onCapture={handleCameraCapture} onCancel={() => setMode("idle")} />;
    }

    // 裁切模式
    if (mode === "crop" && result && image) {
        return (
            <ImageCropper image={image} result={result} onCropComplete={handleCropComplete} onCancel={handleReset} />
        );
    }

    // 結果模式
    if (mode === "result" && result) {
        return <LeafDetectionView result={result} onReset={handleReset} />;
    }

    // 主頁面
    return (
        <div className='container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl'>
            <Card>
                <CardHeader>
                    <CardTitle className='text-2xl md:text-3xl'>葉片病害檢測</CardTitle>
                    <CardDescription className='text-base md:text-lg'>
                        上傳圖片或使用相機拍攝進行病害檢測
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                    {mode === "processing" && (
                        <div className='text-center py-12'>
                            <Loader2 className='w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
                            <p className='text-lg text-neutral-600'>識別中...</p>
                        </div>
                    )}

                    {mode === "idle" && (
                        <div className='space-y-6'>
                            {/* 拖曳上傳區域（僅桌面版） */}
                            {!isMobile && (
                                <div
                                    ref={dropZoneRef}
                                    onDragEnter={handleDragEnter}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                                        isDragging
                                            ? "border-emerald-500 bg-emerald-50"
                                            : "border-neutral-300 bg-neutral-50 hover:border-emerald-400 hover:bg-emerald-50/50"
                                    }`}
                                >
                                    <Upload className='w-12 h-12 mx-auto mb-4 text-emerald-600' />
                                    <p className='text-lg font-medium text-neutral-700 mb-2'>拖曳圖片到此處上傳</p>
                                    <p className='text-sm text-neutral-500 mb-4'>或點擊下方按鈕選擇文件</p>
                                    <Button onClick={() => fileInputRef.current?.click()}>選擇圖片</Button>
                                </div>
                            )}

                            {/* 按鈕組（手機版和桌面版） */}
                            <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
                                {/* 相機按鈕（僅手機版顯示） */}
                                {isMobile && (
                                    <Button onClick={() => setMode("camera")} className='h-24 md:h-32 text-lg'>
                                        <Camera className='h-6 w-6 mr-2' />
                                        拍攝照片
                                    </Button>
                                )}

                                {/* 上傳按鈕 */}
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    variant={isMobile ? "default" : "outline"}
                                    className='h-24 md:h-32 text-lg'
                                >
                                    <Upload className='h-6 w-6 mr-2' />
                                    上傳圖片
                                </Button>
                            </div>

                            {/* 隱藏的文件輸入 */}
                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='image/*'
                                onChange={handleFileInputChange}
                                className='hidden'
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default PredictPage;
