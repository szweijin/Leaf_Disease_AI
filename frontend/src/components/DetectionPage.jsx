import React, { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "../api.js";
import ImageCropper from "./ImageCropper.jsx";
import CameraView from "./CameraView.jsx";
import LeafDetectionView from "./LeafDetectionView.jsx";

function DetectionPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [base64Image, setBase64Image] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingImage, setLoadingImage] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPagination, setHistoryPagination] = useState({
        page: 1,
        per_page: 20,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
    });
    const [historyFilters, setHistoryFilters] = useState({
        disease: '',
        min_confidence: null,
        order_by: 'created_at',
        order_dir: 'DESC'
    });
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
        // 可以選擇直接進入葉片檢測視圖或直接檢測
        // 這裡先直接檢測，如果需要可以改為顯示 LeafDetectionView
        // setShowLeafDetection(true);
    };

    // 處理葉片檢測確認
    const handleLeafDetectionConfirm = (data) => {
        setShowLeafDetection(false);
        // 使用確認的圖片進行檢測
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
                    // 即使是非植物影像，也要存儲到資料庫並顯示在歷史記錄中
                    alert(data.error || "非植物影像，請上傳植物葉片圖片");
                    setResult(data);
                    await loadHistory(); // 載入歷史記錄，包括 "others" 類別
                } else {
                    setResult(data);
                    await loadHistory();
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
                // 使用裁切後的圖片替換原始預覽圖片
                setPreviewUrl(cropData.cropped_image);
                setBase64Image(cropData.cropped_image);
                
                // 設置檢測結果
                setResult(data);
                
                // 清除裁切相關狀態
                setCropPredictionId(null);
                
                // 重新載入歷史記錄
                await loadHistory();
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

    const loadHistory = async (page = 1, resetFilters = false) => {
        try {
            setHistoryLoading(true);
            const filters = resetFilters ? {
                disease: '',
                min_confidence: null,
                order_by: 'created_at',
                order_dir: 'DESC'
            } : historyFilters;
            
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: historyPagination.per_page.toString(),
                order_by: filters.order_by,
                order_dir: filters.order_dir
            });
            
            if (filters.disease) {
                params.append('disease', filters.disease);
            }
            if (filters.min_confidence !== null) {
                params.append('min_confidence', filters.min_confidence.toString());
            }
            
            const url = `/history?${params.toString()}`;
            console.log(`🔍 請求歷史記錄: ${url}`);
            const res = await apiFetch(url);
            
            console.log(`📡 響應狀態: ${res.status} ${res.statusText}`);
            
            if (res.ok) {
                const data = await res.json();
                console.log(`📦 原始響應數據:`, data);
                
                // 處理響應格式（支持新舊兩種格式）
                let records = [];
                let pagination = {
                    page: 1,
                    per_page: 20,
                    total: 0,
                    total_pages: 0,
                    has_next: false,
                    has_prev: false
                };
                
                if (Array.isArray(data)) {
                    // 舊格式：直接返回數組
                    console.log("📋 使用舊格式（數組）");
                    records = data;
                    pagination.total = data.length;
                } else if (data.records) {
                    // 新格式：包含 records 和 pagination
                    console.log("📋 使用新格式（records + pagination）");
                    records = data.records || [];
                    pagination = data.pagination || pagination;
                    console.log(`📊 分頁信息:`, pagination);
                } else {
                    console.warn("⚠️ 未知的歷史記錄格式:", data);
                    records = [];
                }
                
                console.log(`✅ 載入歷史記錄: ${records.length} 筆`, records);
                if (records.length > 0) {
                    console.log(`📝 第一筆記錄樣本:`, records[0]);
                    console.log(`📝 記錄字段:`, Object.keys(records[0]));
                } else {
                    console.warn("⚠️ 歷史記錄為空，可能原因：");
                    console.warn("  1. 資料庫中沒有檢測記錄");
                    console.warn("  2. 當前用戶沒有檢測記錄");
                    console.warn("  3. 查詢參數過濾掉了所有記錄");
                }
                setHistory(records);
                setHistoryPagination(pagination);
            } else {
                const errorData = await res.json().catch(() => ({}));
                console.error("❌ 載入歷史記錄失敗:", res.status, errorData);
                console.error("   響應狀態:", res.status, res.statusText);
                setHistory([]);
                setHistoryPagination({
                    page: 1,
                    per_page: 20,
                    total: 0,
                    total_pages: 0,
                    has_next: false,
                    has_prev: false
                });
            }
        } catch (e) {
            console.error("❌ 載入歷史記錄時發生錯誤:", e);
            console.error("   錯誤詳情:", e.message);
            console.error("   堆疊:", e.stack);
            setHistory([]);
            setHistoryPagination({
                page: 1,
                per_page: 20,
                total: 0,
                total_pages: 0,
                has_next: false,
                has_prev: false
            });
        } finally {
            setHistoryLoading(false);
        }
    };
    
    const handleHistoryPageChange = (newPage) => {
        loadHistory(newPage);
    };
    
    const handleHistoryFilterChange = (filterName, value) => {
        setHistoryFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
    };
    
    const applyHistoryFilters = () => {
        loadHistory(1);
    };

    useEffect(() => {
        // 組件載入時自動載入歷史記錄
        loadHistory(1);
    }, []);

    // 識別中畫面
    if (identifying) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
                padding: '20px'
            }}>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '20px',
                    padding: '40px',
                    maxWidth: '400px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                }}>
                    {previewUrl && (
                        <div style={{
                            width: '100%',
                            aspectRatio: '1',
                            border: '2px solid #ddd',
                            borderRadius: '12px',
                            marginBottom: '30px',
                            overflow: 'hidden',
                            backgroundColor: '#f9f9f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <img 
                                src={previewUrl} 
                                alt="預覽" 
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>
                    )}
                    <h2 style={{ 
                        marginBottom: '15px', 
                        color: '#333',
                        fontSize: '24px'
                    }}>
                        Identifying your plant...
                    </h2>
                    <p style={{ 
                        color: '#666', 
                        marginBottom: '30px',
                        fontSize: '14px',
                        lineHeight: '1.6'
                    }}>
                        This may take a few moments. Please don't close the app.
                    </p>
                    <div style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#4CAF50',
                            animation: 'pulse 1.5s ease-in-out infinite'
                        }} />
                    </div>
                    <button
                        onClick={() => {
                            setIdentifying(false);
                            setSubmitting(false);
                        }}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            color: '#333'
                        }}
                    >
                        Cancel
                    </button>
                </div>
                <style>{`
                    @keyframes pulse {
                        0%, 100% { opacity: 0.6; }
                        50% { opacity: 1; }
                    }
                `}</style>
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
                    {/* 主操作按鈕區域 - 按照圖片設計 */}
                    {!previewUrl && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px',
                            marginBottom: '20px'
                        }}>
                            <button
                                onClick={() => setShowCamera(true)}
                                style={{
                                    width: '100%',
                                    padding: '18px 24px',
                                    backgroundColor: 'white',
                                    border: '2px solid #333',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    fontWeight: '500',
                                    color: '#333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.target.style.backgroundColor = '#f5f5f5';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.backgroundColor = 'white';
                                }}
                            >
                                📷 Take Photo
                            </button>
                            <button
                                onClick={() => document.getElementById("imageInput-react")?.click()}
                                style={{
                                    width: '100%',
                                    padding: '18px 24px',
                                    backgroundColor: 'white',
                                    border: '2px solid #333',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    fontWeight: '500',
                                    color: '#333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseOver={(e) => {
                                    e.target.style.backgroundColor = '#f5f5f5';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.backgroundColor = 'white';
                                }}
                            >
                                📁 Upload Image
                            </button>
                            <input
                                id='imageInput-react'
                                type='file'
                                accept='image/*'
                                onChange={handleFileChange}
                                style={{ display: "none" }}
                            />
                        </div>
                    )}

                    {/* 預覽區域 */}
                    {previewUrl && (
                        <div style={{
                            marginBottom: '20px',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                width: '100%',
                                maxWidth: '400px',
                                margin: '0 auto',
                                border: '2px solid #ddd',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                backgroundColor: '#f9f9f9'
                            }}>
                                <img 
                                    src={previewUrl} 
                                    alt='預覽' 
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        display: 'block'
                                    }}
                                />
                            </div>
                            <div style={{
                                display: 'flex',
                                gap: '10px',
                                justifyContent: 'center',
                                marginTop: '15px'
                            }}>
                                <button
                                    onClick={() => {
                                        setPreviewUrl("");
                                        setBase64Image("");
                                        setResult(null);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#f5f5f5',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: '#333'
                                    }}
                                >
                                    重新選擇
                                </button>
                                <button
                                    onClick={() => handlePredict(base64Image.includes("data:image") ? "camera" : "upload")}
                                    disabled={submitting || loadingImage}
                                    style={{
                                        padding: '10px 20px',
                                        backgroundColor: '#4CAF50',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        color: 'white',
                                        opacity: submitting ? 0.6 : 1
                                    }}
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
                            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                                <h4 style={{ marginTop: 0 }}>🔍 CNN 分類結果</h4>
                                <p><strong>最佳分類：</strong>{result.cnn_result.best_class}</p>
                                <p><strong>分數：</strong>{(result.cnn_result.best_score * 100).toFixed(1)}%</p>
                                <p><strong>平均分數：</strong>{(result.cnn_result.mean_score * 100).toFixed(1)}%</p>
                                {result.cnn_result.all_scores && (
                                    <div style={{ marginTop: '10px' }}>
                                        <strong>所有類別分數：</strong>
                                        <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                                            {Object.entries(result.cnn_result.all_scores).map(([cls, score]) => (
                                                <li key={cls}>{cls}: {(score * 100).toFixed(1)}%</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 需要裁切提示 */}
                        {result.final_status === "need_crop" && (
                            <div style={{ 
                                padding: '15px', 
                                backgroundColor: '#fff3cd', 
                                borderRadius: '8px',
                                marginBottom: '15px'
                            }}>
                                <p style={{ margin: 0, fontWeight: 'bold' }}>
                                    ✂️ {result.message || "請裁切圖片中的葉片區域"}
                                </p>
                            </div>
                        )}

                        {/* 非植物錯誤 */}
                        {result.final_status === "not_plant" && (
                            <div style={{ 
                                padding: '15px', 
                                backgroundColor: '#f8d7da', 
                                borderRadius: '8px',
                                marginBottom: '15px'
                            }}>
                                <p style={{ margin: 0, fontWeight: 'bold', color: '#721c24' }}>
                                    ❌ {result.error || "非植物影像，請上傳植物葉片圖片"}
                                </p>
                            </div>
                        )}

                        {/* YOLO 檢測結果 */}
                        {result.yolo_result && (
                            <div style={{ marginBottom: '20px' }}>
                                <h4>🎯 YOLO 病害檢測結果</h4>
                                {result.yolo_result.detected && result.yolo_result.detections && result.yolo_result.detections.length > 0 ? (
                                    <div style={{ display: 'grid', gap: '10px' }}>
                                        {result.yolo_result.detections.map((detection, idx) => (
                                            <div 
                                                key={idx}
                                                style={{ 
                                                    padding: '15px', 
                                                    backgroundColor: '#e8f5e9', 
                                                    borderRadius: '8px',
                                                    border: '1px solid #4CAF50'
                                                }}
                                            >
                                                <p style={{ margin: 0, fontWeight: 'bold' }}>
                                                    {detection.class || 'Unknown'}
                                                </p>
                                                <p style={{ margin: '5px 0 0 0', color: '#666' }}>
                                                    置信度: {(detection.confidence * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p>未檢測到病害（健康）</p>
                                )}
                            </div>
                        )}

                        {/* 圖片顯示 */}
                        {result.image_path && (
                            <div className='row' style={{ marginTop: '20px' }}>
                                <div className='col-md-12 text-center'>
                                    <img
                                        src={apiUrl(result.image_path)}
                                        alt='結果圖像'
                                        className='img-fluid rounded'
                                        style={{ maxHeight: 400, maxWidth: '100%' }}
                                        onError={(e) => {
                                            console.error("結果圖片載入失敗:", result.image_path);
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* 處理時間 */}
                        {result.processing_time_ms && (
                            <p style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
                                處理時間: {result.processing_time_ms}ms
                                {result.cnn_time_ms && ` (CNN: ${result.cnn_time_ms}ms)`}
                                {result.yolo_time_ms && ` (YOLO: ${result.yolo_time_ms}ms)`}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* 檢測歷史 */}
            <div className='section-card'>
                <div className='section-header'>
                    <h2>📊 檢測歷史</h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            className='btn-logout'
                            type='button'
                            style={{ background: "rgba(255,255,255,0.2)" }}
                            onClick={() => loadHistory(historyPagination.page)}
                            disabled={historyLoading}
                        >
                            {historyLoading ? '載入中...' : '重新載入'}
                        </button>
                    </div>
                </div>
                
                {/* 過濾器 */}
                <div style={{ 
                    padding: '15px', 
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    alignItems: 'center'
                }}>
                    <input
                        type="text"
                        placeholder="搜尋病害名稱..."
                        value={historyFilters.disease}
                        onChange={(e) => handleHistoryFilterChange('disease', e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            flex: '1',
                            minWidth: '200px'
                        }}
                    />
                    <select
                        value={historyFilters.order_by}
                        onChange={(e) => handleHistoryFilterChange('order_by', e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white'
                        }}
                    >
                        <option value="created_at">按時間排序</option>
                        <option value="confidence">按置信度排序</option>
                        <option value="disease_name">按病害名稱排序</option>
                    </select>
                    <select
                        value={historyFilters.order_dir}
                        onChange={(e) => handleHistoryFilterChange('order_dir', e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white'
                        }}
                    >
                        <option value="DESC">降序</option>
                        <option value="ASC">升序</option>
                    </select>
                    <button
                        onClick={applyHistoryFilters}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '4px',
                            border: 'none',
                            background: '#4CAF50',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        套用
                    </button>
                </div>
                
                <div className='section-body'>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.7)' }}>
                            <div>載入中...</div>
                        </div>
                    ) : (
                        <>
                            <div className='history-list'>
                                {history.length === 0 ? (
                                    <div className='empty-state'>
                                        <div className='empty-state-icon'>📝</div>
                                        <div>尚無檢測紀錄</div>
                                    </div>
                                ) : (
                                    history.map((r) => {
                                        const scorePercent = (r.confidence * 100).toFixed(1);
                                        const diseaseDisplay = r.disease || r.disease_name || "未知";
                                        const severityDisplay = r.severity || "Unknown";
                                        
                                        return (
                                            <div key={r.id || r.timestamp || `record-${Math.random()}`} className='history-item'>
                                                {r.image_path ? (
                                                    <img 
                                                        src={apiUrl(r.image_path)} 
                                                        alt={diseaseDisplay} 
                                                        className='history-img'
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            console.error("圖片載入失敗:", r.image_path, r);
                                                            e.target.style.display = 'none';
                                                            // 檢查是否已經有 no-img div
                                                            if (!e.target.parentNode.querySelector('.no-img')) {
                                                                const noImgDiv = document.createElement('div');
                                                                noImgDiv.className = 'history-img no-img';
                                                                noImgDiv.textContent = 'No Img';
                                                                e.target.parentNode.appendChild(noImgDiv);
                                                            }
                                                        }}
                                                        onLoad={() => {
                                                            // 圖片載入成功，確保隱藏 no-img div
                                                            const noImgDiv = document.querySelector('.no-img');
                                                            if (noImgDiv) {
                                                                noImgDiv.style.display = 'none';
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className='history-img no-img'>No Img</div>
                                                )}
                                                <div className='history-content'>
                                                    <div className='history-disease'>{diseaseDisplay}</div>
                                                    <div className='history-detail'>嚴重程度: {severityDisplay}</div>
                                                    <div className='history-detail'>
                                                        時間:{" "}
                                                        {r.created_at
                                                            ? new Date(r.created_at).toLocaleString("zh-TW")
                                                            : r.timestamp 
                                                            ? new Date(r.timestamp).toLocaleString("zh-TW")
                                                            : "剛剛"}
                                                    </div>
                                                    {r.processing_time_ms && (
                                                        <div className='history-detail' style={{ fontSize: '0.85em', opacity: 0.7 }}>
                                                            處理時間: {r.processing_time_ms}ms
                                                        </div>
                                                    )}
                                                    {r.image_source && (
                                                        <div className='history-detail' style={{ fontSize: '0.85em', opacity: 0.7 }}>
                                                            來源: {r.image_source === 'crop' ? '裁切' : r.image_source === 'camera' ? '相機' : '上傳'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className='confidence-badge'>{scorePercent}%</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            
                            {/* 分頁控制 */}
                            {historyPagination.total_pages > 1 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '20px',
                                    borderTop: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <button
                                        onClick={() => handleHistoryPageChange(historyPagination.page - 1)}
                                        disabled={!historyPagination.has_prev || historyLoading}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            border: 'none',
                                            background: historyPagination.has_prev ? '#4CAF50' : '#cccccc',
                                            color: 'white',
                                            cursor: historyPagination.has_prev ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        上一頁
                                    </button>
                                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        第 {historyPagination.page} / {historyPagination.total_pages} 頁
                                        （共 {historyPagination.total} 筆）
                                    </span>
                                    <button
                                        onClick={() => handleHistoryPageChange(historyPagination.page + 1)}
                                        disabled={!historyPagination.has_next || historyLoading}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            border: 'none',
                                            background: historyPagination.has_next ? '#4CAF50' : '#cccccc',
                                            color: 'white',
                                            cursor: historyPagination.has_next ? 'pointer' : 'not-allowed'
                                        }}
                                    >
                                        下一頁
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

export default DetectionPage;
