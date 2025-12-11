import React, { useEffect, useState, useCallback } from "react";
import { apiFetch, apiUrl } from "../api.js";

/**
 * HISTORY 頁面 - 檢測歷史記錄
 */
function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPagination, setHistoryPagination] = useState({
        page: 1,
        per_page: 20,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
    });
    const [historyFilters, setHistoryFilters] = useState({
        disease: "",
        min_confidence: null,
        order_by: "created_at",
        order_dir: "DESC",
    });

    const loadHistory = useCallback(
        async (page = 1, resetFilters = false, filtersOverride = null) => {
            try {
                setHistoryLoading(true);
                const filters =
                    filtersOverride ||
                    (resetFilters
                        ? {
                              disease: "",
                              min_confidence: null,
                              order_by: "created_at",
                              order_dir: "DESC",
                          }
                        : historyFilters);

                const params = new URLSearchParams({
                    page: page.toString(),
                    per_page: "20",
                    order_by: filters.order_by,
                    order_dir: filters.order_dir,
                });

                if (filters.disease) {
                    params.append("disease", filters.disease);
                }
                if (filters.min_confidence !== null) {
                    params.append("min_confidence", filters.min_confidence.toString());
                }

                const url = `/history?${params.toString()}`;
                const res = await apiFetch(url);

                if (res.ok) {
                    const data = await res.json();

                    let records = [];
                    let pagination = {
                        page: 1,
                        per_page: 20,
                        total: 0,
                        total_pages: 0,
                        has_next: false,
                        has_prev: false,
                    };

                    if (Array.isArray(data)) {
                        records = data;
                        pagination.total = data.length;
                    } else if (data.records) {
                        records = data.records || [];
                        pagination = data.pagination || pagination;
                    } else {
                        records = [];
                    }

                    setHistory(records);
                    setHistoryPagination(pagination);
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    console.error("❌ 載入歷史記錄失敗:", res.status, errorData);
                    setHistory([]);
                    setHistoryPagination({
                        page: 1,
                        per_page: 20,
                        total: 0,
                        total_pages: 0,
                        has_next: false,
                        has_prev: false,
                    });
                }
            } catch (e) {
                console.error("❌ 載入歷史記錄時發生錯誤:", e);
                setHistory([]);
                setHistoryPagination({
                    page: 1,
                    per_page: 20,
                    total: 0,
                    total_pages: 0,
                    has_next: false,
                    has_prev: false,
                });
            } finally {
                setHistoryLoading(false);
            }
        },
        [historyFilters]
    );

    const handleHistoryPageChange = (newPage) => {
        loadHistory(newPage);
    };

    const handleHistoryFilterChange = (filterName, value) => {
        setHistoryFilters((prev) => ({
            ...prev,
            [filterName]: value,
        }));
    };

    const applyHistoryFilters = () => {
        loadHistory(1, false, historyFilters);
    };

    useEffect(() => {
        loadHistory(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className='section-card'>
            <div className='section-header'>
                <h2>📊 檢測歷史</h2>
                <div className='flex gap-2.5 items-center'>
                    <button
                        className='px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg font-semibold text-sm transition-all duration-200 text-white'
                        type='button'
                        onClick={() => loadHistory(historyPagination.page)}
                        disabled={historyLoading}
                    >
                        {historyLoading ? "載入中..." : "重新載入"}
                    </button>
                </div>
            </div>

            {/* 過濾器 */}
            <div className='p-4 border-b border-neutral-200 flex gap-2.5 flex-wrap items-center bg-neutral-50'>
                <input
                    type='text'
                    placeholder='搜尋病害名稱...'
                    value={historyFilters.disease}
                    onChange={(e) => handleHistoryFilterChange("disease", e.target.value)}
                    className='px-3 py-2 rounded border border-neutral-300 bg-white text-neutral-800 flex-1 min-w-[200px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
                />
                <select
                    value={historyFilters.order_by}
                    onChange={(e) => handleHistoryFilterChange("order_by", e.target.value)}
                    className='px-3 py-2 rounded border border-neutral-300 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500'
                >
                    <option value='created_at'>按時間排序</option>
                    <option value='confidence'>按置信度排序</option>
                    <option value='disease_name'>按病害名稱排序</option>
                </select>
                <select
                    value={historyFilters.order_dir}
                    onChange={(e) => handleHistoryFilterChange("order_dir", e.target.value)}
                    className='px-3 py-2 rounded border border-neutral-300 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-500'
                >
                    <option value='DESC'>降序</option>
                    <option value='ASC'>升序</option>
                </select>
                <button
                    onClick={applyHistoryFilters}
                    className='px-4 py-2 rounded border-none bg-primary-500 text-white cursor-pointer hover:bg-primary-600 transition-colors'
                >
                    套用
                </button>
            </div>

            <div className='section-body'>
                {historyLoading ? (
                    <div className='text-center py-10 text-neutral-500'>
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
                                        <div
                                            key={r.id || r.timestamp || `record-${Math.random()}`}
                                            className='history-item'
                                        >
                                            {r.image_path ? (
                                                <img
                                                    src={apiUrl(r.image_path)}
                                                    alt={diseaseDisplay}
                                                    className='history-img'
                                                    loading='lazy'
                                                    onError={(e) => {
                                                        console.error("圖片載入失敗:", r.image_path, r);
                                                        e.target.style.display = "none";
                                                        if (!e.target.parentNode.querySelector(".no-img")) {
                                                            const noImgDiv = document.createElement("div");
                                                            noImgDiv.className = "history-img no-img";
                                                            noImgDiv.textContent = "No Img";
                                                            e.target.parentNode.appendChild(noImgDiv);
                                                        }
                                                    }}
                                                    onLoad={() => {
                                                        const noImgDiv = document.querySelector(".no-img");
                                                        if (noImgDiv) {
                                                            noImgDiv.style.display = "none";
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
                                                    <div className='history-detail text-xs opacity-70'>
                                                        處理時間: {r.processing_time_ms}ms
                                                    </div>
                                                )}
                                                {r.image_source && (
                                                    <div className='history-detail text-xs opacity-70'>
                                                        來源:{" "}
                                                        {r.image_source === "crop"
                                                            ? "裁切"
                                                            : r.image_source === "camera"
                                                            ? "相機"
                                                            : "上傳"}
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
                            <div className='flex justify-center items-center gap-2.5 py-5 border-t border-neutral-200'>
                                <button
                                    onClick={() => handleHistoryPageChange(historyPagination.page - 1)}
                                    disabled={!historyPagination.has_prev || historyLoading}
                                    className={`px-4 py-2 rounded border-none text-white transition-colors ${
                                        historyPagination.has_prev && !historyLoading
                                            ? "bg-primary-500 hover:bg-primary-600 cursor-pointer"
                                            : "bg-neutral-400 cursor-not-allowed"
                                    }`}
                                >
                                    上一頁
                                </button>
                                <span className='text-neutral-700'>
                                    第 {historyPagination.page} / {historyPagination.total_pages} 頁 （共{" "}
                                    {historyPagination.total} 筆）
                                </span>
                                <button
                                    onClick={() => handleHistoryPageChange(historyPagination.page + 1)}
                                    disabled={!historyPagination.has_next || historyLoading}
                                    className={`px-4 py-2 rounded border-none text-white transition-colors ${
                                        historyPagination.has_next && !historyLoading
                                            ? "bg-primary-500 hover:bg-primary-600 cursor-pointer"
                                            : "bg-neutral-400 cursor-not-allowed"
                                    }`}
                                >
                                    下一頁
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default HistoryPage;
