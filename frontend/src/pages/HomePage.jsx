import React, { useState } from "react";
import { apiFetch, apiUrl } from "../api.js";
import ImageCropper from "../components/ImageCropper.jsx";
import CameraView from "../components/CameraView.jsx";
import LeafDetectionView from "../components/LeafDetectionView.jsx";

/**
 * HOME 頁面 - 檢測功能及單次檢測結果顯示
 */
function HomePage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [base64Image, setBase64Image] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingImage, setLoadingImage] = useState(false);
    const [result, setResult] = useState(null);
    const [showCropper, setShowCropper] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [showLeafDetection, setShowLeafDetection] = useState(false);
    const [cropPredictionId, setCropPredictionId] = useState(null);
    const [identifying, setIdentifying] = useState(false);

    // 處理檔案選擇
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setLoadingImage(false);
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert(`圖片太大！請選擇小於 ${maxSize / 1024 / 1024}MB 的圖片`);
            setLoadingImage(false);
            return;
        }

        setSelectedFile(file);
        setLoadingImage(true);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const v = ev.target?.result;
            if (typeof v === "string") {
                setPreviewUrl(v);
                setBase64Image(v);
                setLoadingImage(false);
            } else {
                setLoadingImage(false);
                alert("讀取圖片失敗");
            }
        };
        reader.onerror = () => {
            setLoadingImage(false);
            alert("讀取圖片失敗，請重試");
        };
        reader.readAsDataURL(file);
    };

    // 處理相機拍攝
    const handleCameraCapture = (capturedImage) => {
        setBase64Image(capturedImage);
        setPreviewUrl(capturedImage);
        setShowCamera(false);
    };

    // 處理葉片檢測確認
    const handleLeafDetectionConfirm = (data) => {
        setShowLeafDetection(false);
        if (data.cropped_image) {
            setBase64Image(data.cropped_image);
            setPreviewUrl(data.cropped_image);
        }
    };

    // 執行預測
    const handlePredict = async (imageSource = "upload") => {
        if (!base64Image) {
            if (selectedFile) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const v = ev.target?.result;
                    if (typeof v === "string") {
                        setBase64Image(v);
                        setPreviewUrl(v);
                        setTimeout(() => handlePredict(imageSource), 100);
                    } else {
                        alert("請先上傳圖片！無法讀取圖片資料。");
                    }
                };
                reader.onerror = () => {
                    alert("讀取圖片失敗，請重新選擇圖片");
                };
                reader.readAsDataURL(selectedFile);
                return;
            }
            alert("請先上傳圖片！");
            return;
        }

        try {
            setSubmitting(true);
            setIdentifying(true);
            setResult(null);

            const res = await apiFetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: base64Image,
                    source: imageSource,
                }),
            });

            const data = await res.json();
            setIdentifying(false);

            if (res.ok) {
                if (data.final_status === "need_crop") {
                    setCropPredictionId(data.prediction_id);
                    setShowCropper(true);
                    setResult(data);
                } else if (data.final_status === "not_plant") {
                    alert(data.error || "非植物影像，請上傳植物葉片圖片");
                    setResult(data);
                } else {
                    setResult(data);
                }
            } else {
                alert("預測失敗: " + (data.error || "未知錯誤"));
            }
        } catch (e) {
            console.error(e);
            setIdentifying(false);
            alert("系統發生錯誤");
        } finally {
            setSubmitting(false);
        }
    };

    // 處理裁切
    const handleCrop = async (cropData) => {
        if (!cropPredictionId) {
            alert("缺少預測記錄 ID");
            return;
        }

        try {
            setSubmitting(true);
            setShowCropper(false);
            setIdentifying(true);

            const res = await apiFetch("/api/predict-crop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prediction_id: cropPredictionId,
                    crop_coordinates: cropData.crop_coordinates,
                    cropped_image: cropData.cropped_image,
                }),
            });

            const data = await res.json();
            setIdentifying(false);

            if (res.ok) {
                setPreviewUrl(cropData.cropped_image);
                setBase64Image(cropData.cropped_image);
                setResult(data);
                setCropPredictionId(null);
            } else {
                alert("裁切後檢測失敗: " + (data.error || "未知錯誤"));
            }
        } catch (e) {
            console.error(e);
            setIdentifying(false);
            alert("系統發生錯誤");
        } finally {
            setSubmitting(false);
        }
    };

    // 識別中畫面
    if (identifying) {
        return (
            <div className='min-h-screen flex flex-col items-center justify-center bg-neutral-100 p-5'>
                <div className='bg-white rounded-4xl p-10 max-w-md w-full text-center shadow-medium'>
                    {previewUrl && (
                        <div className='w-full aspect-square border-2 border-neutral-300 rounded-xl mb-8 overflow-hidden bg-neutral-50 flex items-center justify-center'>
                            <img src={previewUrl} alt='預覽' className='w-full h-full object-contain' />
                        </div>
                    )}
                    <h2 className='mb-4 text-neutral-800 text-2xl font-bold'>Identifying your plant...</h2>
                    <p className='text-neutral-600 mb-8 text-sm leading-relaxed'>
                        This may take a few moments. Please don't close the app.
                    </p>
                    <div className='w-full h-1 bg-neutral-300 rounded-sm overflow-hidden mb-5'>
                        <div className='w-full h-full bg-primary-500 animate-pulse-custom' />
                    </div>
                    <button
                        onClick={() => {
                            setIdentifying(false);
                            setSubmitting(false);
                        }}
                        className='px-6 py-3 bg-white border border-neutral-300 rounded-lg cursor-pointer text-base text-neutral-800 hover:bg-neutral-50 transition-colors'
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* 相機視圖 */}
            {showCamera && (
                <CameraView
                    onCapture={handleCameraCapture}
                    onClose={() => setShowCamera(false)}
                    onSwitchToGallery={() => {
                        setShowCamera(false);
                        document.getElementById("imageInput-react")?.click();
                    }}
                />
            )}

            {/* 葉片檢測視圖 */}
            {showLeafDetection && previewUrl && (
                <LeafDetectionView
                    imageUrl={previewUrl}
                    onConfirm={handleLeafDetectionConfirm}
                    onCancel={() => {
                        setShowLeafDetection(false);
                        setPreviewUrl("");
                        setBase64Image("");
                    }}
                />
            )}

            {/* 裁切介面 */}
            {showCropper && previewUrl && (
                <ImageCropper
                    imageUrl={previewUrl}
                    onCrop={handleCrop}
                    onCancel={() => {
                        setShowCropper(false);
                        setCropPredictionId(null);
                    }}
                />
            )}

            {/* 主頁面 */}
            <div className='section-card'>
                <div className='section-header'>
                    <h2>🖼️ 圖像檢測</h2>
                </div>
                <div className='section-body detection-container'>
                    {/* 主操作按鈕區域 */}
                    {!previewUrl && (
                        <div className='flex flex-col gap-4 mb-5'>
                            <button
                                onClick={() => setShowCamera(true)}
                                className='w-full py-4.5 px-6 bg-white border-2 border-neutral-800 rounded-xl cursor-pointer text-lg font-medium text-neutral-800 flex items-center justify-center gap-2.5 transition-all duration-300 hover:bg-neutral-50'
                            >
                                📷 Take Photo
                            </button>
                            <button
                                onClick={() => document.getElementById("imageInput-react")?.click()}
                                className='w-full py-4.5 px-6 bg-white border-2 border-neutral-800 rounded-xl cursor-pointer text-lg font-medium text-neutral-800 flex items-center justify-center gap-2.5 transition-all duration-300 hover:bg-neutral-50'
                            >
                                📁 Upload Image
                            </button>
                            <input
                                id='imageInput-react'
                                type='file'
                                accept='image/*'
                                onChange={handleFileChange}
                                className='hidden'
                            />
                        </div>
                    )}

                    {/* 預覽區域 */}
                    {previewUrl && (
                        <div className='mb-5 text-center'>
                            <div className='w-full max-w-md mx-auto border-2 border-neutral-300 rounded-xl overflow-hidden bg-neutral-50'>
                                <img src={previewUrl} alt='預覽' className='w-full h-auto block' />
                            </div>
                            <div className='flex gap-2.5 justify-center mt-4'>
                                <button
                                    onClick={() => {
                                        setPreviewUrl("");
                                        setBase64Image("");
                                        setResult(null);
                                    }}
                                    className='px-5 py-2.5 bg-neutral-100 border border-neutral-300 rounded-lg cursor-pointer text-sm text-neutral-800 hover:bg-neutral-200 transition-colors'
                                >
                                    重新選擇
                                </button>
                                <button
                                    onClick={() =>
                                        handlePredict(base64Image.includes("data:image") ? "camera" : "upload")
                                    }
                                    disabled={submitting || loadingImage}
                                    className={`px-5 py-2.5 bg-primary-500 border-none rounded-lg text-sm text-white transition-all ${
                                        submitting || loadingImage
                                            ? "opacity-60 cursor-not-allowed"
                                            : "cursor-pointer hover:bg-primary-600"
                                    }`}
                                >
                                    {submitting ? "⏳ 分析中..." : "🚀 開始分析"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 檢測結果顯示 */}
            {result && (
                <div className='section-card mt-3'>
                    <div className='section-header'>
                        <h2>🌱 檢測結果</h2>
                    </div>
                    <div className='section-body'>
                        {/* CNN 分類結果 */}
                        {result.cnn_result && (
                            <div className='mb-5 p-4 bg-neutral-100 rounded-lg'>
                                <h4 className='mt-0 mb-3 font-bold text-lg'>🔍 CNN 分類結果</h4>
                                <p className='mb-2'>
                                    <strong>最佳分類：</strong>
                                    {result.cnn_result.best_class}
                                </p>
                                <p className='mb-2'>
                                    <strong>分數：</strong>
                                    {(result.cnn_result.best_score * 100).toFixed(1)}%
                                </p>
                                <p className='mb-2'>
                                    <strong>平均分數：</strong>
                                    {(result.cnn_result.mean_score * 100).toFixed(1)}%
                                </p>
                                {result.cnn_result.all_scores && (
                                    <div className='mt-2.5'>
                                        <strong>所有類別分數：</strong>
                                        <ul className='mt-1.5 pl-5 list-disc'>
                                            {Object.entries(result.cnn_result.all_scores).map(([cls, score]) => (
                                                <li key={cls}>
                                                    {cls}: {(score * 100).toFixed(1)}%
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 需要裁切提示 */}
                        {result.final_status === "need_crop" && (
                            <div className='p-4 bg-warning-light rounded-lg mb-4'>
                                <p className='m-0 font-bold'>✂️ {result.message || "請裁切圖片中的葉片區域"}</p>
                            </div>
                        )}

                        {/* 非植物錯誤 */}
                        {result.final_status === "not_plant" && (
                            <div className='p-4 bg-error-light rounded-lg mb-4'>
                                <p className='m-0 font-bold text-error-dark'>
                                    ❌ {result.error || "非植物影像，請上傳植物葉片圖片"}
                                </p>
                            </div>
                        )}

                        {/* YOLO 檢測結果 */}
                        {result.yolo_result && (
                            <div className='mb-5'>
                                <h4 className='mb-3 font-bold text-lg'>🎯 YOLO 病害檢測結果</h4>
                                {result.yolo_result.detected &&
                                result.yolo_result.detections &&
                                result.yolo_result.detections.length > 0 ? (
                                    <div className='grid gap-2.5'>
                                        {result.yolo_result.detections.map((detection, idx) => (
                                            <div
                                                key={idx}
                                                className='p-4 bg-primary-50 rounded-lg border border-primary-500'
                                            >
                                                <p className='m-0 font-bold text-neutral-800'>
                                                    {detection.class || "Unknown"}
                                                </p>
                                                <p className='mt-1.5 mb-0 text-neutral-600'>
                                                    置信度: {(detection.confidence * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className='text-neutral-600'>未檢測到病害（健康）</p>
                                )}
                            </div>
                        )}

                        {/* 圖片顯示 */}
                        {result.image_path && (
                            <div className='mt-5 text-center'>
                                <img
                                    src={apiUrl(result.image_path)}
                                    alt='結果圖像'
                                    className='max-h-96 max-w-full rounded-lg'
                                    onError={(e) => {
                                        console.error("結果圖片載入失敗:", result.image_path);
                                        e.target.style.display = "none";
                                    }}
                                />
                            </div>
                        )}

                        {/* 處理時間 */}
                        {result.processing_time_ms && (
                            <p className='mt-4 text-xs text-neutral-600'>
                                處理時間: {result.processing_time_ms}ms
                                {result.cnn_time_ms && ` (CNN: ${result.cnn_time_ms}ms)`}
                                {result.yolo_time_ms && ` (YOLO: ${result.yolo_time_ms}ms)`}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default HomePage;
