import React, { useEffect, useState, useCallback } from "react";
import { apiFetch, apiUrl } from "../api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
        <Card>
            <CardHeader className='bg-neutral-900 text-white'>
                <div className='flex justify-between items-center'>
                    <CardTitle>📊 檢測歷史</CardTitle>
                    <Button
                        variant='outline'
                        size='sm'
                        type='button'
                        onClick={() => loadHistory(historyPagination.page)}
                        disabled={historyLoading}
                        className='bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700'
                    >
                        {historyLoading ? "載入中..." : "重新載入"}
                    </Button>
                </div>
            </CardHeader>

            {/* 過濾器 */}
            <div className='p-4 border-b border-neutral-200 flex gap-2.5 flex-wrap items-center bg-neutral-50'>
                <Input
                    type='text'
                    placeholder='搜尋病害名稱...'
                    value={historyFilters.disease}
                    onChange={(e) => handleHistoryFilterChange("disease", e.target.value)}
                    className='flex-1 min-w-[200px]'
                />
                <Select
                    value={historyFilters.order_by}
                    onValueChange={(value) => handleHistoryFilterChange("order_by", value)}
                >
                    <SelectTrigger className='w-[180px]'>
                        <SelectValue placeholder='排序方式' />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='created_at'>按時間排序</SelectItem>
                        <SelectItem value='confidence'>按置信度排序</SelectItem>
                        <SelectItem value='disease_name'>按病害名稱排序</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={historyFilters.order_dir}
                    onValueChange={(value) => handleHistoryFilterChange("order_dir", value)}
                >
                    <SelectTrigger className='w-[120px]'>
                        <SelectValue placeholder='排序方向' />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='DESC'>降序</SelectItem>
                        <SelectItem value='ASC'>升序</SelectItem>
                    </SelectContent>
                </Select>
                <Button onClick={applyHistoryFilters}>套用</Button>
            </div>

            <CardContent className='pt-6'>
                {historyLoading ? (
                    <div className='text-center py-10 text-neutral-500'>
                        <div>載入中...</div>
                    </div>
                ) : (
                    <>
                        <div className='grid gap-4'>
                            {history.length === 0 ? (
                                <div className='text-center py-10 text-neutral-500'>
                                    <div className='text-5xl mb-4 opacity-50'>📝</div>
                                    <div>尚無檢測紀錄</div>
                                </div>
                            ) : (
                                history.map((r) => {
                                    const scorePercent = (r.confidence * 100).toFixed(1);
                                    const diseaseDisplay = r.disease || r.disease_name || "未知";
                                    const severityDisplay = r.severity || "Unknown";

                                    return (
                                        <Card
                                            key={r.id || r.timestamp || `record-${Math.random()}`}
                                            className='border-l-4 border-l-neutral-900'
                                        >
                                            <CardContent className='pt-6'>
                                                <div className='flex items-center gap-5'>
                                                    {r.image_path ? (
                                                        <img
                                                            src={apiUrl(r.image_path)}
                                                            alt={diseaseDisplay}
                                                            className='w-20 h-20 object-cover rounded-xl flex-shrink-0'
                                                            loading='lazy'
                                                            decoding='async'
                                                            fetchPriority='low'
                                                            onError={(e) => {
                                                                console.error("圖片載入失敗:", r.image_path, r);
                                                                e.target.style.display = "none";
                                                                if (!e.target.parentNode.querySelector(".no-img")) {
                                                                    const noImgDiv = document.createElement("div");
                                                                    noImgDiv.className =
                                                                        "w-20 h-20 bg-neutral-300 flex items-center justify-center text-neutral-500 rounded-xl flex-shrink-0";
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
                                                        <div className='w-20 h-20 bg-neutral-300 flex items-center justify-center text-neutral-500 rounded-xl flex-shrink-0'>
                                                            No Img
                                                        </div>
                                                    )}
                                                    <div className='flex-1'>
                                                        <div className='text-lg font-bold text-neutral-900 mb-1'>
                                                            {diseaseDisplay}
                                                        </div>
                                                        <div className='text-sm text-neutral-600 mb-1'>
                                                            嚴重程度: {severityDisplay}
                                                        </div>
                                                        <div className='text-sm text-neutral-600 mb-1'>
                                                            時間:{" "}
                                                            {r.created_at
                                                                ? new Date(r.created_at).toLocaleString("zh-TW")
                                                                : r.timestamp
                                                                ? new Date(r.timestamp).toLocaleString("zh-TW")
                                                                : "剛剛"}
                                                        </div>
                                                        {r.processing_time_ms && (
                                                            <div className='text-xs text-neutral-500'>
                                                                處理時間: {r.processing_time_ms}ms
                                                            </div>
                                                        )}
                                                        {r.image_source && (
                                                            <div className='text-xs text-neutral-500'>
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
                                                        <Badge className='bg-neutral-900 text-white'>
                                                            {scorePercent}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>

                        {/* 分頁控制 */}
                        {historyPagination.total_pages > 1 && (
                            <div className='flex justify-center items-center gap-2.5 py-5 border-t border-neutral-200 mt-6'>
                                <Button
                                    onClick={() => handleHistoryPageChange(historyPagination.page - 1)}
                                    disabled={!historyPagination.has_prev || historyLoading}
                                >
                                    上一頁
                                </Button>
                                <span className='text-neutral-700'>
                                    第 {historyPagination.page} / {historyPagination.total_pages} 頁 （共{" "}
                                    {historyPagination.total} 筆）
                                </span>
                                <Button
                                    onClick={() => handleHistoryPageChange(historyPagination.page + 1)}
                                    disabled={!historyPagination.has_next || historyLoading}
                                >
                                    下一頁
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default HistoryPage;
