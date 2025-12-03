import React, { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "../api.js";

function DetectionPage() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [base64Image, setBase64Image] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [loadingImage, setLoadingImage] = useState(false); // 追蹤圖片讀取狀態
    const [history, setHistory] = useState([]);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            console.log("未選擇文件");
            setLoadingImage(false);
            return;
        }

        // 檢查文件大小（限制為 10MB）
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert(`圖片太大！請選擇小於 ${maxSize / 1024 / 1024}MB 的圖片`);
            setLoadingImage(false);
            return;
        }

        console.log("選擇的文件:", file.name, file.type, file.size);
        setSelectedFile(file);
        setLoadingImage(true); // 開始讀取圖片

        const reader = new FileReader();
        let timeoutId = null;

        // 設置超時（30秒）
        timeoutId = setTimeout(() => {
            if (reader.readyState !== FileReader.DONE) {
                console.error("❌ 讀取圖片超時");
                reader.abort();
                setLoadingImage(false);
                alert("讀取圖片超時，請選擇較小的圖片或重試");
            }
        }, 30000);

        reader.onloadstart = () => {
            console.log("FileReader 開始讀取...");
        };

        reader.onprogress = (ev) => {
            if (ev.lengthComputable) {
                const percentLoaded = Math.round((ev.loaded / ev.total) * 100);
                console.log(`讀取進度: ${percentLoaded}%`);
            }
        };

        let statusCheckInterval = null;

        reader.onload = (ev) => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            const v = ev.target?.result;
            console.log("FileReader onload, result type:", typeof v, "length:", v?.length);

            if (typeof v === "string") {
                setPreviewUrl(v);
                setBase64Image(v);
                setLoadingImage(false); // 讀取完成
                console.log("✅ Base64 圖片已設置，長度:", v.length);
            } else {
                console.error("❌ FileReader 結果不是字串:", typeof v);
                setLoadingImage(false);
                alert("讀取圖片失敗：結果格式錯誤");
            }
        };

        reader.onerror = (error) => {
            if (statusCheckInterval) {
                clearInterval(statusCheckInterval);
                statusCheckInterval = null;
            }
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            console.error("❌ FileReader 錯誤:", error);
            console.error("錯誤代碼:", reader.error?.code);
            console.error("錯誤訊息:", reader.error?.message);
            setLoadingImage(false);
            alert("讀取圖片失敗，請重試。如果問題持續，請選擇較小的圖片。");
        };

        reader.onabort = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            console.log("FileReader 已中止");
            setLoadingImage(false);
        };

        reader.onloadend = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            console.log("FileReader 讀取結束，狀態:", reader.readyState);
        };

        try {
            // 檢查 FileReader 是否可用
            if (typeof FileReader === "undefined") {
                throw new Error("瀏覽器不支援 FileReader API");
            }

            console.log("FileReader 狀態:", reader.readyState);
            console.log("準備讀取文件，大小:", file.size, "bytes");

            // 開始讀取
            reader.readAsDataURL(file);
            console.log("已調用 readAsDataURL，FileReader 狀態:", reader.readyState);

            // 定期檢查 FileReader 狀態（用於調試）
            statusCheckInterval = setInterval(() => {
                console.log("FileReader 狀態檢查:", {
                    readyState: reader.readyState,
                    EMPTY: FileReader.EMPTY,
                    LOADING: FileReader.LOADING,
                    DONE: FileReader.DONE,
                });

                if (reader.readyState === FileReader.DONE) {
                    clearInterval(statusCheckInterval);
                    statusCheckInterval = null;
                    console.log("✅ FileReader 已完成");
                }
            }, 1000);
        } catch (error) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            console.error("❌ 讀取文件時發生錯誤:", error);
            setLoadingImage(false);
            alert("讀取圖片失敗: " + error.message);
        }
    };

    const handlePredict = async (imageSource = "upload") => {
        console.log(
            "handlePredict 被調用, base64Image:",
            base64Image ? `存在 (長度: ${base64Image.length})` : "不存在"
        );
        console.log("previewUrl:", previewUrl ? "存在" : "不存在");
        console.log("selectedFile:", selectedFile ? selectedFile.name : "不存在");

        if (!base64Image) {
            // 如果 base64Image 不存在，但 selectedFile 存在，嘗試重新讀取
            if (selectedFile) {
                console.log("base64Image 不存在，但 selectedFile 存在，嘗試重新讀取...");
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const v = ev.target?.result;
                    if (typeof v === "string") {
                        setBase64Image(v);
                        setPreviewUrl(v);
                        // 遞歸調用，但只允許一次
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
            const res = await apiFetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: base64Image,
                    source: imageSource, // 'camera', 'gallery', 'upload'
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data);
                await loadHistory();
            } else {
                alert("預測失敗: " + (data.error || "未知錯誤"));
            }
        } catch (e) {
            console.error(e);
            alert("系統發生錯誤");
        } finally {
            setSubmitting(false);
        }
    };

    const loadHistory = async () => {
        try {
            console.log("📊 載入檢測歷史...");
            const res = await apiFetch("/history");
            console.log("歷史記錄響應狀態:", res.status, res.ok);
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "未知錯誤" }));
                console.error("❌ 載入歷史失敗:", errorData);
                alert("載入歷史記錄失敗: " + (errorData.error || "未知錯誤"));
                return;
            }
            
            const data = await res.json();
            console.log("✅ 載入歷史成功，記錄數:", data.length);
            console.log("歷史記錄範例:", data[0] || "無記錄");
            setHistory(data);
        } catch (e) {
            console.error("❌ 載入歷史記錄時發生錯誤:", e);
            alert("載入歷史記錄時發生錯誤，請檢查控制台");
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    return (
        <>
            <div className='section-card'>
                <div className='section-header'>
                    <h2>🖼️ 圖像檢測</h2>
                </div>
                <div className='section-body detection-container'>
                    <div className='upload-area' onClick={() => document.getElementById("imageInput-react")?.click()}>
                        <div style={{ fontSize: "2em", marginBottom: 10 }}>📁</div>
                        <div style={{ fontWeight: 600, marginBottom: 5 }}>點擊上傳或拖放圖像</div>
                        <small style={{ color: "#666" }}>支援 JPG, PNG 等圖片格式</small>
                        <input
                            id='imageInput-react'
                            type='file'
                            accept='image/*'
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />
                    </div>

                    <div className='preview-container'>
                        {previewUrl && <img src={previewUrl} alt='預覽' className='preview-img show' />}
                    </div>

                    <button
                        className='btn-predict'
                        type='button'
                        onClick={() => handlePredict("upload")}
                        disabled={submitting || loadingImage || !base64Image}
                    >
                        {loadingImage ? "📖 讀取圖片中..." : submitting ? "⏳ 分析中..." : "🚀 開始分析"}
                    </button>
                </div>
            </div>

            <div className='section-card'>
                <div className='section-header'>
                    <h2>📊 檢測歷史</h2>
                    <button
                        className='btn-logout'
                        type='button'
                        style={{ background: "rgba(255,255,255,0.2)" }}
                        onClick={loadHistory}
                    >
                        重新載入
                    </button>
                </div>
                <div className='section-body'>
                    <div className='history-list'>
                        {history.length === 0 ? (
                            <div className='empty-state'>
                                <div className='empty-state-icon'>📝</div>
                                <div>尚無檢測紀錄</div>
                            </div>
                        ) : (
                            history.map((r, idx) => {
                                const scorePercent = (r.confidence * 100).toFixed(1);
                                return (
                                    <div key={idx} className='history-item'>
                                        {r.image_path ? (
                                            <img 
                                                src={apiUrl(r.image_path)} 
                                                alt={r.disease} 
                                                className='history-img'
                                                onError={(e) => {
                                                    console.error("圖片載入失敗:", r.image_path);
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className='history-img no-img'>No Img</div>
                                        )}
                                        <div className='history-content'>
                                            <div className='history-disease'>{r.disease || "未知"}</div>
                                            <div className='history-detail'>分類結果: {r.severity || "Unknown"}</div>
                                            <div className='history-detail'>
                                                時間:{" "}
                                                {r.created_at
                                                    ? new Date(r.created_at).toLocaleString("zh-TW")
                                                    : r.timestamp || "剛剛"}
                                            </div>
                                        </div>
                                        <div>
                                            <span className='confidence-badge'>{scorePercent}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {result && (
                <div className='section-card mt-3'>
                    <div className='section-header'>
                        <h2>🌱 最新檢測結果</h2>
                    </div>
                    <div className='section-body'>
                        <div className='row'>
                            <div className='col-md-5 text-center mb-3 mb-md-0'>
                                <img
                                    src={apiUrl(result.image_path)}
                                    alt='結果圖像'
                                    className='img-fluid rounded'
                                    style={{ maxHeight: 250 }}
                                    onError={(e) => {
                                        console.error("結果圖片載入失敗:", result.image_path);
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className='col-md-7'>
                                <h3 className='fw-bold text-success mb-2'>{result.disease}</h3>
                                <p className='mb-1'>
                                    <strong>嚴重程度：</strong>
                                    {result.severity}
                                </p>
                                <p className='mb-1'>
                                    <strong>信心分數：</strong>
                                    {(result.confidence * 100).toFixed(1)}%
                                </p>
                                {result.disease_info && (
                                    <div className='mt-3'>
                                        <h5 className='fw-bold text-success mb-2'>📋 病害詳細信息</h5>
                                        {result.disease_info.name && (
                                            <p className='mb-2'>
                                                <strong>🌿 病害名稱：</strong>
                                                {result.disease_info.name}
                                            </p>
                                        )}
                                        <p className='mb-2'>
                                            <strong>🔬 病因：</strong>
                                            {result.disease_info.causes || "-"}
                                        </p>
                                        <p className='mb-2'>
                                            <strong>🍃 症狀特徵：</strong>
                                            {result.disease_info.feature || "-"}
                                        </p>
                                        {result.disease_info.solution && (
                                            <div className='mt-2'>
                                                {result.disease_info.solution.pesticide &&
                                                    result.disease_info.solution.pesticide.length > 0 && (
                                                        <div className='mb-2'>
                                                            <strong>💊 農藥防治：</strong>
                                                            <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                                                                {result.disease_info.solution.pesticide.map(
                                                                    (p, idx) => (
                                                                        <li key={idx}>{p}</li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                                {result.disease_info.solution.management &&
                                                    result.disease_info.solution.management.length > 0 && (
                                                        <div>
                                                            <strong>🌱 管理措施：</strong>
                                                            <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                                                                {result.disease_info.solution.management.map(
                                                                    (m, idx) => (
                                                                        <li key={idx}>{m}</li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default DetectionPage;
