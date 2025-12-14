import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, TrendingUp } from "lucide-react";

interface HistoryRecord {
    id: number;
    disease?: string;
    severity?: string;
    confidence?: number;
    image_path?: string;
    original_image_url?: string; // 原始圖片 URL
    annotated_image_url?: string; // 帶框圖片 URL
    timestamp?: string;
    created_at?: string;
}

function HistoryPage() {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (error) {
            toast.error(error);
            setError("");
        }
    }, [error]);

    useEffect(() => {
        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadHistory = async () => {
        try {
            const res = await apiFetch("/history");
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "載入失敗");
                return;
            }

            // 後端返回格式為 {records: [...], pagination: {...}}
            // 如果 data 是數組（向後兼容），直接使用；否則從 data.records 獲取
            let records: HistoryRecord[] = [];
            if (Array.isArray(data)) {
                records = data;
            } else if (data && Array.isArray(data.records)) {
                records = data.records;
            } else {
                console.warn("歷史記錄數據格式不正確:", data);
                records = [];
            }

            console.log(`載入 ${records.length} 筆歷史記錄`);
            setHistory(records);
        } catch (err) {
            console.error("載入歷史記錄失敗:", err);
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoading(false);
        }
    };

    const severityColors: Record<string, string> = {
        Mild: "bg-emerald-500",
        Moderate: "bg-yellow-500",
        Severe: "bg-red-500",
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "未知時間";
        try {
            return new Date(dateString).toLocaleString("zh-TW", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return (
            <div className='container mx-auto p-4 max-w-6xl'>
                <div className='text-center py-12'>
                    <Loader2 className='w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
                    <p className='text-lg text-neutral-600'>載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className='container mx-auto p-4 md:p-6 lg:p-8 max-w-6xl'>
            <div className='space-y-6'>
                <div>
                    <h1 className='text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-700 mb-2'>
                        檢測歷史
                    </h1>
                    <p className='text-lg text-neutral-600'>查看過去的檢測記錄</p>
                </div>

                {history.length === 0 ? (
                    <Card>
                        <CardContent className='py-12'>
                            <div className='text-center'>
                                <Calendar className='w-16 h-16 mx-auto mb-4 text-neutral-400' />
                                <p className='text-lg font-medium text-neutral-600 mb-2'>尚無檢測記錄</p>
                                <p className='text-sm text-neutral-500'>開始使用 AI 診斷功能來建立您的檢測歷史</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'>
                        {history.map((record) => {
                            // 優先使用原始圖片 URL，其次使用 image_path，最後使用帶框圖片
                            const displayImageUrl =
                                record.original_image_url || record.image_path || record.annotated_image_url;

                            return (
                                <Card
                                    key={record.id}
                                    className='hover:shadow-lg transition-shadow border-neutral-200 hover:border-emerald-300'
                                >
                                    {displayImageUrl && (
                                        <div className='relative w-full h-48 overflow-hidden rounded-t-lg group'>
                                            <img
                                                src={displayImageUrl}
                                                alt='檢測結果'
                                                className='w-full h-full object-cover'
                                            />
                                            <div className='absolute top-2 right-2'>
                                                <Badge
                                                    className={`${
                                                        severityColors[record.severity || ""] || "bg-neutral-500"
                                                    } text-white`}
                                                >
                                                    {record.severity || "N/A"}
                                                </Badge>
                                            </div>
                                            {/* 如果有帶框圖片，顯示切換按鈕 */}
                                            {record.annotated_image_url && record.original_image_url && (
                                                <div className='absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                                                    <Button
                                                        size='sm'
                                                        variant='secondary'
                                                        className='text-xs'
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const img = e.currentTarget
                                                                .closest(".group")
                                                                ?.querySelector("img");
                                                            if (img) {
                                                                const currentSrc = img.src;
                                                                const originalUrl = record.original_image_url;
                                                                const annotatedUrl = record.annotated_image_url;
                                                                if (currentSrc === originalUrl && annotatedUrl) {
                                                                    img.src = annotatedUrl;
                                                                } else if (currentSrc === annotatedUrl && originalUrl) {
                                                                    img.src = originalUrl;
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        切換視圖
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <CardHeader>
                                        <div className='flex items-start justify-between gap-2'>
                                            <CardTitle className='text-lg text-emerald-700'>
                                                {record.disease || "未知病害"}
                                            </CardTitle>
                                            {!displayImageUrl && (
                                                <Badge
                                                    className={`${
                                                        severityColors[record.severity || ""] || "bg-neutral-500"
                                                    } text-white`}
                                                >
                                                    {record.severity || "N/A"}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className='space-y-3'>
                                        {record.confidence !== undefined && (
                                            <div className='flex items-center gap-2 text-sm'>
                                                <TrendingUp className='w-4 h-4 text-emerald-600' />
                                                <span className='text-neutral-600'>
                                                    置信度:{" "}
                                                    <span className='font-semibold text-emerald-700'>
                                                        {(record.confidence * 100).toFixed(1)}%
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                        <div className='flex items-center gap-2 text-sm text-neutral-500'>
                                            <Calendar className='w-4 h-4' />
                                            <span>{formatDate(record.timestamp || record.created_at)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default HistoryPage;
