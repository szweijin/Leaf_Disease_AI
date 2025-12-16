import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { parseUnicodeInObject } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import CameraView from "@/components/CameraView";
import ImageCropper from "@/components/ImageCropper";
import LeafDetectionView from "@/components/LeafDetectionView";
import { Upload, Camera, Loader2 } from "lucide-react";

type Mode = "idle" | "camera" | "processing" | "result" | "crop";

interface DiseaseInfo {
    id?: number;
    chinese_name?: string;
    english_name?: string;
    causes?: string;
    features?: string;
    symptoms?: string | string[];
    pesticides?: string | string[];
    management_measures?: string | string[];
    target_crops?: string;
    severity_levels?: string;
    prevention_tips?: string | string[];
    reference_links?: string | string[];
}

interface PredictionResult {
    status?: "success" | "error" | "need_crop";
    workflow?: string;
    prediction_id: string;
    cnn_result?: {
        mean_score?: number;
        best_class?: string;
        best_score?: number;
        all_scores?: Record<string, number>;
    };
    disease?: string;
    confidence?: number;
    severity?: string;
    final_status: "yolo_detected" | "need_crop" | "not_plant";
    image_path?: string;
    predict_img_url?: string;
    image_stored_in_db?: boolean;
    yolo_result?: {
        detected: boolean;
        detections?: Array<{
            class: string;
            confidence: number;
            bbox: number[];
        }>;
    };
    error?: string;
    message?: string;
    processing_time_ms?: number;
    cnn_time_ms?: number;
    yolo_time_ms?: number;
    disease_info?: DiseaseInfo;
    crop_count?: number;
    max_crop_count?: number;
}

function PredictPage() {
    const [mode, setMode] = useState<Mode>("idle");
    const [image, setImage] = useState<string | null>(null);
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [cropCount, setCropCount] = useState<number>(1); // 追蹤 crop 次數
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

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

            let data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "檢測失敗");
                setMode("idle");
                return;
            }

            // 解析 Unicode 轉義序列為中文
            data = parseUnicodeInObject(data);

            // 檢查是否需要裁切（後端返回 final_status === 'need_crop'）
            if (data.final_status === "need_crop") {
                setResult(data);
                setCropCount(1); // 首次 crop，重置為 1
                setMode("crop");
            } else if (data.final_status === "not_plant") {
                // 非植物影像
                toast.error(data.error || "非植物影像，請上傳植物葉片圖片");
                setMode("idle");
                setCropCount(1); // 重置 crop 次數
            } else {
                setResult(data);
                setCropCount(1); // 重置 crop 次數
                setMode("result");
                // 首次預測不顯示錯誤，只有在第二次裁切後才顯示
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "網絡錯誤");
            setMode("idle");
        }
    };

    // 處理裁切完成
    const handleCropComplete = async (
        croppedImage: string,
        coordinates: { x: number; y: number; width: number; height: number }
    ) => {
        if (!result) {
            toast.error("缺少預測結果");
            return;
        }

        setMode("processing");

        try {
            const base64Data = croppedImage.includes(",") ? croppedImage.split(",")[1] : croppedImage;

            const res = await apiFetch("/api/predict-crop", {
                method: "POST",
                body: JSON.stringify({
                    prediction_id: result.prediction_id,
                    crop_coordinates: coordinates,
                    cropped_image: base64Data,
                    crop_count: cropCount, // 傳遞當前 crop 次數
                }),
            });

            let data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "檢測失敗");
                setMode("crop");
                return;
            }

            // 解析 Unicode 轉義序列為中文
            data = parseUnicodeInObject(data);

            // 檢查是否需要繼續 crop
            if (data.final_status === "need_crop" && data.status === "need_crop") {
                // 還未達到最大次數，需要繼續 crop
                const nextCropCount = cropCount + 1;
                setCropCount(nextCropCount);
                setResult(data);
                setMode("crop");
                // 顯示提示信息
                if (data.message) {
                    toast.info(data.message);
                } else {
                    toast.info(`請繼續裁切圖片中的葉片區域 (${nextCropCount}/3)`);
                }
            } else {
                // 檢測完成或達到最大次數
                setResult(data);
                setCropCount(1); // 重置 crop 次數
                setMode("result");
                // 只在 CNN 檢測時檢查（final_status 不是 "yolo_detected"）
                const isCNNDetection = data.final_status !== "yolo_detected";
                if (isCNNDetection) {
                    const disease = data.disease?.toLowerCase();
                    const bestClass = data.cnn_result?.best_class?.toLowerCase();
                    if (
                        disease === "other" ||
                        disease === "whole_plant" ||
                        bestClass === "other" ||
                        bestClass === "whole_plant" ||
                        bestClass === "others"
                    ) {
                        toast.warning("非植物葉片或解析度過低");
                    }
                } else if (data.final_status === "not_plant" && cropCount >= 3) {
                    toast.warning("已達到最大裁切次數，無法識別為植物葉片");
                }
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "網絡錯誤");
            setMode("crop");
        }
    };

    // 重置
    const handleReset = () => {
        setMode("idle");
        setImage(null);
        setResult(null);
        setCropCount(1); // 重置 crop 次數
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // 拖曳處理（用於局部拖曳區域）
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "idle") {
            setIsDragging(true);
        }
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

    // 全頁面拖曳上傳（僅在 idle 模式時啟用）
    useEffect(() => {
        const container = pageContainerRef.current;
        if (!container || mode !== "idle") {
            return;
        }

        let dragCounter = 0; // 用於追蹤拖曳進入/離開的嵌套層級

        const dragEnterHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (dragCounter === 1) {
                setIsDragging(true);
            }
        };

        const dragLeaveHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter === 0) {
                setIsDragging(false);
            }
        };

        const dragOverHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const dropHandler = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            setIsDragging(false);

            const file = e.dataTransfer?.files[0];
            if (file) {
                // 直接調用 handleFileSelect，因為它在組件作用域內
                handleFileSelect(file);
            }
        };

        container.addEventListener("dragenter", dragEnterHandler);
        container.addEventListener("dragleave", dragLeaveHandler);
        container.addEventListener("dragover", dragOverHandler);
        container.addEventListener("drop", dropHandler);

        return () => {
            container.removeEventListener("dragenter", dragEnterHandler);
            container.removeEventListener("dragleave", dragLeaveHandler);
            container.removeEventListener("dragover", dragOverHandler);
            container.removeEventListener("drop", dropHandler);
            // 清理時重置拖曳狀態
            if (dragCounter > 0) {
                setIsDragging(false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    // 相機模式
    if (mode === "camera") {
        return <CameraView onCapture={handleCameraCapture} onCancel={() => setMode("idle")} />;
    }

    // 裁切模式
    if (mode === "crop" && result && image) {
        return (
            <ImageCropper
                image={image}
                cropCount={cropCount}
                maxCropCount={result.max_crop_count || 3}
                onCropComplete={handleCropComplete}
                onCancel={handleReset}
            />
        );
    }

    // 結果模式
    if (mode === "result" && result) {
        // 只在 CNN 檢測時檢查（final_status 不是 "yolo_detected"）
        let errorMessage: string | undefined;
        const isCNNDetection = result.final_status !== "yolo_detected";
        if (isCNNDetection) {
            const disease = result.disease?.toLowerCase();
            const bestClass = result.cnn_result?.best_class?.toLowerCase();
            if (
                disease === "other" ||
                disease === "whole_plant" ||
                bestClass === "other" ||
                bestClass === "whole_plant" ||
                bestClass === "others"
            ) {
                errorMessage = "非植物葉片或解析度過低";
            }
        }

        return (
            <LeafDetectionView
                result={{
                    disease: result.disease,
                    severity: result.severity,
                    confidence: result.confidence,
                    image_path: result.image_path,
                    predict_img_url: result.predict_img_url,
                    disease_info: result.disease_info,
                    errorMessage: errorMessage,
                    cnn_result: result.cnn_result,
                    final_status: result.final_status,
                    crop_count: result.crop_count,
                }}
                onReset={handleReset}
            />
        );
    }

    // 主頁面
    return (
        <div
            ref={pageContainerRef}
            className='w-full p-4 md:p-6 lg:p-8 h-[calc(100vh-4rem)] md:h-[calc(100vh-3.5rem)] overflow-hidden flex items-center bg-gradient-to-b from-white to-emerald-50'
        >
            <Card
                className={`w-screen h-full flex flex-col border-none ${
                    isMobile
                        ? "bg-gradient-to-b from-white to-emerald-50 min-h-screen min-w-screen fixed top-0 left-0 z-10 w-full"
                        : "bg-transparent mx-auto flex justify-center max-w-4xl"
                }`}
            >
                <CardHeader>
                    {!isMobile && <CardTitle className='text-2xl md:text-3xl'>葉片病害檢測</CardTitle>}
                    {!isMobile && (
                        <CardDescription className='text-base md:text-lg'>上傳圖片進行病害檢測</CardDescription>
                    )}
                </CardHeader>
                <CardContent className='flex-1 flex flex-col justify-center space-y-6 overflow-hidden'>
                    {mode === "processing" && (
                        <div className='text-center flex flex-col items-center justify-center flex-1'>
                            <Loader2 className='w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
                            <p className='text-lg text-neutral-600'>識別中...</p>
                        </div>
                    )}

                    {mode === "idle" && (
                        <div className='space-y-6 flex flex-col justify-center flex-1'>
                            {/* 拖曳上傳區域（僅桌面版） */}
                            {!isMobile && (
                                <>
                                    {/* 全螢幕拖曳區域（透明覆蓋） */}
                                    <div
                                        ref={dropZoneRef}
                                        onDragEnter={handleDragEnter}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`fixed inset-0 z-40 pointer-events-none transition-colors duration-200 h-full w-full ${
                                            isDragging ? "bg-emerald-50/80 border-8 border-emerald-400" : ""
                                        }`}
                                        style={{ display: isDragging ? "block" : "none" }}
                                    >
                                        <div className='flex items-center justify-center w-full h-full'>
                                            <div className='bg-white/95 rounded-xl p-10 shadow-xl text-center'>
                                                <Upload className='w-16 h-16 mx-auto mb-6 text-emerald-600 animate-bounce' />
                                                <p className='text-2xl font-semibold text-emerald-700 mb-2'>
                                                    拖曳圖片到此處上傳
                                                </p>
                                                <p className='text-base text-neutral-600 mb-4'>鬆開滑鼠即可上傳圖片</p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* 原本的可見卡片內拖曳與按鈕區 */}
                                    <div
                                        onDragEnter={handleDragEnter}
                                        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                                            isDragging
                                                ? "border-emerald-500 bg-emerald-50"
                                                : "border-neutral-300 bg-white/50 hover:border-emerald-400 hover:bg-white/95"
                                        }`}
                                    >
                                        <Upload className='w-12 h-12 mx-auto mb-4 text-emerald-600' />
                                        <p className='text-lg font-medium text-neutral-700 mb-2'>拖曳圖片到此處上傳</p>
                                        <p className='text-sm text-neutral-500 mb-4'>或點擊下方按鈕選擇文件</p>
                                        <Button onClick={() => fileInputRef.current?.click()}>選擇圖片</Button>
                                    </div>
                                </>
                            )}

                            {/* 按鈕組（手機版和桌面版，統一外觀） */}
                            <div
                                className={`flex flex-col items-center ${
                                    isMobile ? "gap-5" : "grid grid-cols-2 gap-4"
                                }`}
                            >
                                {isMobile && (
                                    <img
                                        src='./public/Logo_V.png'
                                        alt='Logo'
                                        className='w-auto h-44 sm:h-48 md:h-52 mx-auto mb-2'
                                    />
                                )}
                                {isMobile && (
                                    <div className='flex flex-col w-3/4 gap-4 mt-2'>
                                        <Button
                                            onClick={() => setMode("camera")}
                                            className='h-14 sm:h-16 md:h-20 text-base sm:text-lg md:text-xl flex items-center justify-center gap-2 rounded-lg font-medium w-full'
                                            variant='outline'
                                        >
                                            <Camera className='h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8' />
                                            <span>拍攝照片</span>
                                        </Button>
                                        <Button
                                            onClick={() => fileInputRef.current?.click()}
                                            className='h-14 sm:h-16 md:h-20 text-base sm:text-lg md:text-xl flex items-center justify-center gap-2 rounded-lg font-medium w-full'
                                            variant='default'
                                        >
                                            <Upload className='h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8' />
                                            <span>選擇圖片</span>
                                        </Button>
                                    </div>
                                )}
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
