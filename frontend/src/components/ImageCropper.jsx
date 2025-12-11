// ImageCropper.jsx
// 圖片裁切組件（使用 react-image-crop 函式庫）

import React, { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

/**
 * 將裁切區域轉換為實際的圖片資料
 * @param {HTMLImageElement} image - 原始圖片元素
 * @param {object} pixelCrop - 裁切區域在像素上的座標和尺寸
 * @returns {Promise<string>} - 返回 Base64 格式的裁切後圖片資料
 */
const getCroppedImage = (image, pixelCrop) => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // 設定 Canvas 尺寸為裁切區域的尺寸
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    const ctx = canvas.getContext("2d");

    // 在 Canvas 上繪製裁切後的圖片
    ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // 將 Canvas 內容轉換為 Base64 格式的圖片資料
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Canvas is empty"));
                    return;
                }
                // 將 Blob 轉換為 data URL (base64)
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            },
            "image/jpeg",
            0.9
        ); // 輸出格式為 JPEG，品質 0.9
    });
};

function ImageCropper({ imageUrl, onCrop, onCancel }) {
    const [imageRef, setImageRef] = useState(null); // 圖片元素 (HTMLImageElement)
    const [crop, setCrop] = useState(); // 裁切框的座標/尺寸狀態
    const [completedCrop, setCompletedCrop] = useState(null); // 裁切完成後的像素座標
    const [isProcessing, setIsProcessing] = useState(false);

    // 圖片載入完成 (取得圖片元素)
    const onImageLoad = (e) => {
        setImageRef(e.currentTarget);
        const { width, height } = e.currentTarget;

        // 設定預設裁切框為中央 80%，不固定長寬比
        const initialCrop = centerCrop(
            makeAspectCrop(
                {
                    unit: "%", // 使用百分比單位
                    width: 80, // 初始寬度 80%
                },
                width,
                height
            ),
            width,
            height
        );

        setCrop(initialCrop);
    };

    // 執行裁切並產生結果圖
    const handleCropImage = async () => {
        if (!imageRef || !completedCrop) {
            alert("請先選擇裁切區域");
            return;
        }

        try {
            setIsProcessing(true);

            // 獲取裁切後的圖片（base64）
            const croppedImageBase64 = await getCroppedImage(imageRef, completedCrop);

            // 計算實際裁切座標（相對於原始圖片）
            const scaleX = imageRef.naturalWidth / imageRef.width;
            const scaleY = imageRef.naturalHeight / imageRef.height;

            const cropCoordinates = {
                x: Math.round(completedCrop.x * scaleX),
                y: Math.round(completedCrop.y * scaleY),
                width: Math.round(completedCrop.width * scaleX),
                height: Math.round(completedCrop.height * scaleY),
            };

            // 回傳裁切結果（與現有 API 格式兼容）
            onCrop({
                cropped_image: croppedImageBase64,
                crop_coordinates: cropCoordinates,
            });
        } catch (error) {
            console.error("裁切圖片時發生錯誤:", error);
            alert("裁切圖片失敗，請重試");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!imageUrl) {
        return (
            <div className='fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center'>
                <div className='text-white'>載入圖片中...</div>
            </div>
        );
    }

    return (
        <div className='fixed inset-0 bg-black/80 z-[1000] flex flex-col items-center justify-center p-5'>
            <div className='bg-white p-5 rounded-lg max-w-[90%] max-h-[90%] overflow-auto'>
                <h3 className='mt-0 mb-4 text-lg font-bold'>✂️ 請裁切圖片中的葉片區域</h3>

                <div className='relative border-2 border-primary-500 rounded overflow-hidden mb-4 inline-block max-w-full'>
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={undefined} // 不固定長寬比，允許自由裁切
                        minWidth={50} // 最小寬度
                        minHeight={50} // 最小高度
                    >
                        <img
                            src={imageUrl}
                            onLoad={onImageLoad}
                            alt='待裁切圖片'
                            className='max-w-full max-h-[70vh] h-auto block'
                        />
                    </ReactCrop>
                </div>

                <div className='flex gap-2.5 justify-center'>
                    <button
                        onClick={handleCropImage}
                        disabled={!completedCrop || isProcessing}
                        className={`px-5 py-2.5 text-white border-none rounded text-base min-w-[120px] transition-colors ${
                            completedCrop && !isProcessing
                                ? "bg-primary-500 hover:bg-primary-600 cursor-pointer"
                                : "bg-neutral-400 cursor-not-allowed"
                        }`}
                    >
                        {isProcessing ? "處理中..." : "✅ 確認裁切"}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className={`px-5 py-2.5 text-white border-none rounded text-base min-w-[120px] transition-colors ${
                            isProcessing
                                ? "bg-neutral-400 cursor-not-allowed"
                                : "bg-error hover:bg-error-dark cursor-pointer"
                        }`}
                    >
                        ❌ 取消
                    </button>
                </div>

                <p className='mt-2.5 text-xs text-neutral-600 text-center'>提示：拖動綠色框來移動和調整裁切區域</p>
            </div>
        </div>
    );
}

export default ImageCropper;
