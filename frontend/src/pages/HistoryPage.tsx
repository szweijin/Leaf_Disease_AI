import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { parseUnicodeInObject } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Calendar, TrendingUp, Filter, ArrowUpDown, X } from "lucide-react";

interface DiseaseInfo {
    id?: number;
    chinese_name?: string;
    english_name?: string;
    causes?: string;
    features?: string;
    symptoms?: string | string[] | null;
    pesticides?: string | string[] | null;
    management_measures?: string | string[] | null;
    target_crops?: string;
    severity_levels?: string;
    prevention_tips?: string | string[] | null;
    reference_links?: string | string[] | null;
}

interface HistoryRecord {
    id: number;
    disease?: string;
    disease_name?: string;
    severity?: string;
    confidence?: number;
    image_path?: string;
    original_image_url?: string;
    annotated_image_url?: string;
    timestamp?: string;
    created_at?: string;
    disease_info?: DiseaseInfo;
}

type SortField = "created_at" | "confidence" | "disease_name";
type SortOrder = "asc" | "desc";

function HistoryPage() {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sortField, setSortField] = useState<SortField>("created_at");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
    const [selectedDiseaseTypes, setSelectedDiseaseTypes] = useState<string[]>([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

    useEffect(() => {
        if (error) {
            toast.error(error);
            setError("");
        }
    }, [error]);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const res = await apiFetch("/history");
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "載入失敗");
                return;
            }

            let records: HistoryRecord[] = [];
            if (Array.isArray(data)) {
                records = data;
            } else if (data && Array.isArray(data.records)) {
                records = data.records;
            } else {
                console.warn("歷史記錄數據格式不正確:", data);
                records = [];
            }

            // 解析 Unicode 轉義序列為中文
            records = parseUnicodeInObject(records);

            console.log(`載入 ${records.length} 筆歷史記錄`);
            setHistory(records);
        } catch (err) {
            console.error("載入歷史記錄失敗:", err);
            setError(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setLoading(false);
        }
    };

    // 從 disease_name 提取作物類別
    const getCropType = (diseaseName?: string): string | null => {
        if (!diseaseName || diseaseName === "others" || diseaseName === "whole_plant") {
            return null;
        }
        // 格式：Potato__Late_blight -> Potato
        const parts = diseaseName.split("__");
        if (parts.length > 0) {
            const crop = parts[0];
            // 映射作物名稱
            if (crop.toLowerCase() === "tomato") return "Tomato";
            if (crop.toLowerCase() === "potato") return "Potato";
            if (crop.toLowerCase() === "bell_pepper" || crop.toLowerCase() === "pepper_bell") return "Bell_pepper";
            return crop;
        }
        return null;
    };

    // 從 disease_name 提取病害類型
    const getDiseaseType = (diseaseName?: string): string | null => {
        if (!diseaseName || diseaseName === "others" || diseaseName === "whole_plant") {
            return null;
        }
        // 格式：Potato__Late_blight -> Late_blight
        const parts = diseaseName.split("__");
        if (parts.length > 1) {
            const diseaseType = parts[1].toLowerCase();
            // 映射病害類型
            if (diseaseType.includes("late_blight") || diseaseType.includes("late-blight")) {
                return "late_blight";
            }
            if (diseaseType.includes("early_blight") || diseaseType.includes("early-blight")) {
                return "early_blight";
            }
            if (diseaseType.includes("bacterial_spot") || diseaseType.includes("bacterial-spot")) {
                return "bacterial_spot";
            }
        }
        return null;
    };

    // 獲取所有可用的作物類別和病害名稱
    const availableCrops = useMemo(() => {
        const crops = new Set<string>();
        history.forEach((record) => {
            const crop = getCropType(record.disease_name);
            if (crop) {
                crops.add(crop);
            }
        });
        return Array.from(crops).sort();
    }, [history]);

    // 獲取所有可用的病害類型
    const availableDiseaseTypes = useMemo(() => {
        const types = new Set<string>();
        history.forEach((record) => {
            const type = getDiseaseType(record.disease_name);
            if (type) {
                types.add(type);
            }
        });
        return Array.from(types).sort();
    }, [history]);

    // 篩選和排序記錄
    const filteredAndSortedHistory = useMemo(() => {
        let filtered = [...history];

        // 作物類別篩選
        if (selectedCrops.length > 0) {
            filtered = filtered.filter((record) => {
                const crop = getCropType(record.disease_name);
                return crop && selectedCrops.includes(crop);
            });
        }

        // 病害類型篩選
        if (selectedDiseaseTypes.length > 0) {
            filtered = filtered.filter((record) => {
                const diseaseType = getDiseaseType(record.disease_name);
                return diseaseType && selectedDiseaseTypes.includes(diseaseType);
            });
        }

        // 排序
        filtered.sort((a, b) => {
            let aValue: number | string;
            let bValue: number | string;

            switch (sortField) {
                case "created_at":
                    aValue = new Date(a.created_at || a.timestamp || 0).getTime();
                    bValue = new Date(b.created_at || b.timestamp || 0).getTime();
                    break;
                case "confidence":
                    aValue = a.confidence || 0;
                    bValue = b.confidence || 0;
                    break;
                case "disease_name":
                    aValue = a.disease_name || "";
                    bValue = b.disease_name || "";
                    break;
                default:
                    return 0;
            }

            if (sortOrder === "asc") {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            } else {
                return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            }
        });

        return filtered;
    }, [history, selectedCrops, selectedDiseaseTypes, sortField, sortOrder]);

    const clearFilters = () => {
        setSelectedCrops([]);
        setSelectedDiseaseTypes([]);
    };

    // 病害類型的中文映射
    const diseaseTypeLabels: Record<string, string> = {
        late_blight: "晚疫病",
        early_blight: "早疫病",
        bacterial_spot: "細菌性斑點病",
    };

    // 作物的顯示映射
    const cropLabels: Record<string, string> = {
        Tomato: "🍅 Tomato",
        Potato: "🥔 Potato",
        Bell_pepper: "🫑 Bell pepper",
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
                <div className='flex items-center justify-between'>
                    <div>
                        <h1 className='text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-700 mb-2'>
                            檢測歷史
                        </h1>
                        <p className='text-lg text-neutral-600'>查看過去的檢測記錄</p>
                    </div>
                </div>

                {/* 排序和篩選工具欄 */}
                <div className='flex flex-wrap items-center gap-4'>
                    {/* 排序 */}
                    <div className='flex items-center gap-2'>
                        <ArrowUpDown className='w-4 h-4 text-neutral-500' />
                        <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                            <SelectTrigger className='w-40'>
                                <SelectValue placeholder='排序欄位' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='created_at'>時間</SelectItem>
                                <SelectItem value='confidence'>置信度</SelectItem>
                                <SelectItem value='disease_name'>病害名稱</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                            <SelectTrigger className='w-32'>
                                <SelectValue placeholder='排序方式' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='desc'>降序</SelectItem>
                                <SelectItem value='asc'>升序</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 篩選按鈕 */}
                    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                        <PopoverTrigger asChild>
                            <Button variant='outline' className='gap-2'>
                                <Filter className='w-4 h-4' />
                                篩選
                                {(selectedCrops.length > 0 || selectedDiseaseTypes.length > 0) && (
                                    <Badge className='ml-1'>{selectedCrops.length + selectedDiseaseTypes.length}</Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-80' align='start'>
                            <div className='space-y-4'>
                                {/* 作物類別篩選 */}
                                <div className='space-y-2'>
                                    <Label className='text-sm font-semibold'>作物類別</Label>
                                    <ToggleGroup
                                        type='multiple'
                                        value={selectedCrops}
                                        onValueChange={setSelectedCrops}
                                        className='flex flex-wrap gap-2'
                                    >
                                        {availableCrops.map((crop) => (
                                            <ToggleGroupItem
                                                key={crop}
                                                value={crop}
                                                aria-label={cropLabels[crop] || crop}
                                            >
                                                {cropLabels[crop] || crop}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                    {availableCrops.length === 0 && (
                                        <p className='text-sm text-neutral-500'>無可用作物類別</p>
                                    )}
                                </div>

                                {/* 病害類別篩選 */}
                                <div className='space-y-2'>
                                    <Label className='text-sm font-semibold'>病害類別</Label>
                                    <ToggleGroup
                                        type='multiple'
                                        value={selectedDiseaseTypes}
                                        onValueChange={setSelectedDiseaseTypes}
                                        className='flex flex-wrap gap-2'
                                    >
                                        {availableDiseaseTypes.map((diseaseType) => (
                                            <ToggleGroupItem
                                                key={diseaseType}
                                                value={diseaseType}
                                                aria-label={diseaseTypeLabels[diseaseType] || diseaseType}
                                            >
                                                {diseaseTypeLabels[diseaseType] || diseaseType}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                    {availableDiseaseTypes.length === 0 && (
                                        <p className='text-sm text-neutral-500'>無可用病害類別</p>
                                    )}
                                </div>

                                {/* 清除篩選 */}
                                {(selectedCrops.length > 0 || selectedDiseaseTypes.length > 0) && (
                                    <Button variant='outline' onClick={clearFilters} className='w-full'>
                                        <X className='w-4 h-4 mr-2' />
                                        清除所有篩選
                                    </Button>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* 顯示結果數量 */}
                    <div className='ml-auto text-sm text-neutral-600'>
                        顯示 {filteredAndSortedHistory.length} / {history.length} 筆記錄
                    </div>
                </div>

                {filteredAndSortedHistory.length === 0 ? (
                    <Card>
                        <CardContent className='py-12'>
                            <div className='text-center'>
                                <Calendar className='w-16 h-16 mx-auto mb-4 text-neutral-400' />
                                <p className='text-lg font-medium text-neutral-600 mb-2'>
                                    {history.length === 0 ? "尚無檢測記錄" : "沒有符合篩選條件的記錄"}
                                </p>
                                <p className='text-sm text-neutral-500'>
                                    {history.length === 0 ? "開始使用 AI 診斷功能來建立您的檢測歷史" : "請調整篩選條件"}
                                </p>
                                {history.length > 0 && (
                                    <Button variant='outline' onClick={clearFilters} className='mt-4'>
                                        清除篩選
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'>
                        {filteredAndSortedHistory.map((record) => {
                            const displayImageUrl =
                                record.original_image_url || record.image_path || record.annotated_image_url;

                            return (
                                <Card
                                    key={record.id}
                                    className='hover:shadow-lg transition-shadow border-neutral-200 hover:border-emerald-300 cursor-pointer py-0 pb-6'
                                    onClick={() => setSelectedRecord(record)}
                                >
                                    {displayImageUrl && (
                                        <div className='relative w-full h-48 overflow-hidden rounded-t-lg group'>
                                            <img
                                                src={displayImageUrl}
                                                alt='檢測結果'
                                                className='w-full h-full object-cover'
                                            />
                                            {/* 嚴重程度等級 */}
                                            {/* <div className='absolute top-2 right-2'>
                                                <Badge
                                                    className={`${
                                                        severityColors[record.severity || ""] || "bg-neutral-500"
                                                    } text-white`}
                                                >
                                                    {record.severity || "N/A"}
                                                </Badge>
                                            </div> */}
                                            {record.annotated_image_url && record.original_image_url && (
                                                <div
                                                    className='absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'
                                                    onClick={(e) => e.stopPropagation()}
                                                >
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
                                            <CardTitle className='text-2xl text-emerald-700'>
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
                                                    信心度:{" "}
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

                                        {/* 病害詳細資訊摘要（只顯示有資訊的欄位） */}
                                        {record.disease_info && (
                                            <div className='pt-2 border-t border-neutral-200 space-y-2'>
                                                {/* 目標作物 */}
                                                {record.disease_info.target_crops && (
                                                    <div className='text-xs text-neutral-600'>
                                                        <span className='font-medium'>作物：</span>
                                                        {record.disease_info.target_crops}
                                                    </div>
                                                )}
                                                {/* 病因摘要 */}
                                                {record.disease_info.causes && (
                                                    <div className='text-xs text-neutral-600 line-clamp-2'>
                                                        <span className='font-medium'>病因：</span>
                                                        {record.disease_info.causes}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* 詳細說明 Dialog */}
                <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
                    <DialogContent className='max-w-[95vw] md:max-w-4xl max-h-[95vh] overflow-y-auto w-full'>
                        {selectedRecord && (
                            <>
                                <DialogHeader>
                                    <DialogTitle>檢測結果詳情</DialogTitle>
                                    <DialogDescription>查看完整的檢測信息和病害詳細說明</DialogDescription>
                                </DialogHeader>
                                <div className='space-y-6 mt-4'>
                                    {/* 圖片顯示區域 */}
                                    {(selectedRecord.original_image_url ||
                                        selectedRecord.image_path ||
                                        selectedRecord.annotated_image_url) && (
                                        <div
                                            className={`grid gap-4 ${
                                                selectedRecord.original_image_url && selectedRecord.annotated_image_url
                                                    ? "grid-cols-1 md:grid-cols-2"
                                                    : "grid-cols-1"
                                            }`}
                                        >
                                            {/* 原始圖片 */}
                                            {(selectedRecord.original_image_url || selectedRecord.image_path) && (
                                                <div className='space-y-2'>
                                                    <h3 className='text-sm font-medium text-neutral-700'>原始圖片</h3>
                                                    <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50'>
                                                        <img
                                                            src={
                                                                selectedRecord.original_image_url ||
                                                                selectedRecord.image_path
                                                            }
                                                            alt='原始圖片'
                                                            className='w-full h-auto'
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = "none";
                                                                const parent = target.parentElement;
                                                                if (parent) {
                                                                    parent.innerHTML =
                                                                        '<p class="text-sm text-neutral-500 p-4 text-center">圖片載入失敗</p>';
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* 帶框圖片 */}
                                            {selectedRecord.annotated_image_url && (
                                                <div className='space-y-2'>
                                                    <h3 className='text-sm font-medium text-neutral-700'>檢測結果</h3>
                                                    <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50'>
                                                        <img
                                                            src={selectedRecord.annotated_image_url}
                                                            alt='檢測結果圖片'
                                                            className='w-full h-auto'
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = "none";
                                                                const parent = target.parentElement;
                                                                if (parent) {
                                                                    parent.innerHTML =
                                                                        '<p class="text-sm text-neutral-500 p-4 text-center">圖片載入失敗</p>';
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 病害類型和嚴重程度 */}
                                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className='text-lg'>檢測結果</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className='text-2xl font-bold text-emerald-700'>
                                                    {selectedRecord.disease ||
                                                        selectedRecord.disease_info?.chinese_name ||
                                                        selectedRecord.disease_name ||
                                                        "未知"}
                                                </div>
                                                {selectedRecord.disease_info?.english_name && (
                                                    <p className='text-sm text-muted-foreground mt-2'>
                                                        {selectedRecord.disease_info.english_name}
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle className='text-lg'>檢測信心度</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className='flex items-baseline gap-2'>
                                                    <span className='text-4xl md:text-5xl font-bold text-emerald-700'>
                                                        {selectedRecord.confidence
                                                            ? (selectedRecord.confidence * 100).toFixed(1)
                                                            : "N/A"}
                                                    </span>
                                                    <span className='text-lg text-muted-foreground'>%</span>
                                                </div>
                                                <div className='mt-3'>
                                                    <p className='text-sm text-muted-foreground'>
                                                        {formatDate(
                                                            selectedRecord.timestamp || selectedRecord.created_at
                                                        )}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* 病害詳細資訊 */}
                                    {selectedRecord.disease_info && (
                                        <>
                                            {/* 病害特徵 */}
                                            {selectedRecord.disease_info.features && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>病害特徵</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className='text-sm whitespace-pre-line'>
                                                            {selectedRecord.disease_info.features}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 病因 */}
                                            {selectedRecord.disease_info.causes && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>病因</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className='text-sm whitespace-pre-line'>
                                                            {selectedRecord.disease_info.causes}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 症狀 */}
                                            {selectedRecord.disease_info.symptoms && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>症狀</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {Array.isArray(selectedRecord.disease_info.symptoms) ? (
                                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                                {selectedRecord.disease_info.symptoms.map(
                                                                    (symptom: string, index: number) => (
                                                                        <li key={index}>{symptom}</li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        ) : (
                                                            <p className='text-sm whitespace-pre-line'>
                                                                {String(selectedRecord.disease_info.symptoms)}
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 目標作物 */}
                                            {selectedRecord.disease_info.target_crops && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>目標作物</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className='text-sm'>
                                                            {selectedRecord.disease_info.target_crops}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 嚴重程度等級 */}
                                            {selectedRecord.disease_info.severity_levels && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>嚴重程度等級</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className='text-sm'>
                                                            {selectedRecord.disease_info.severity_levels}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 管理措施 */}
                                            {selectedRecord.disease_info.management_measures && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>管理措施</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {Array.isArray(
                                                            selectedRecord.disease_info.management_measures
                                                        ) ? (
                                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                                {selectedRecord.disease_info.management_measures.map(
                                                                    (measure: string, index: number) => (
                                                                        <li key={index}>{measure}</li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        ) : (
                                                            <p className='text-sm whitespace-pre-line'>
                                                                {String(
                                                                    selectedRecord.disease_info.management_measures
                                                                )}
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 農藥建議 */}
                                            {selectedRecord.disease_info.pesticides && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>農藥建議</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {Array.isArray(selectedRecord.disease_info.pesticides) ? (
                                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                                {selectedRecord.disease_info.pesticides.map(
                                                                    (pesticide: string, index: number) => (
                                                                        <li key={index}>{pesticide}</li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        ) : (
                                                            <p className='text-sm whitespace-pre-line'>
                                                                {String(selectedRecord.disease_info.pesticides)}
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 預防建議 */}
                                            {selectedRecord.disease_info.prevention_tips && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>預防建議</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {Array.isArray(selectedRecord.disease_info.prevention_tips) ? (
                                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                                {selectedRecord.disease_info.prevention_tips.map(
                                                                    (tip: string, index: number) => (
                                                                        <li key={index}>{tip}</li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        ) : (
                                                            <p className='text-sm whitespace-pre-line'>
                                                                {String(selectedRecord.disease_info.prevention_tips)}
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* 參考連結 */}
                                            {selectedRecord.disease_info.reference_links && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className='text-lg'>參考連結</CardTitle>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {Array.isArray(selectedRecord.disease_info.reference_links) ? (
                                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                                {selectedRecord.disease_info.reference_links.map(
                                                                    (link: string, index: number) => (
                                                                        <li key={index}>
                                                                            <a
                                                                                href={link}
                                                                                target='_blank'
                                                                                rel='noopener noreferrer'
                                                                                className='text-emerald-600 hover:underline'
                                                                            >
                                                                                {link}
                                                                            </a>
                                                                        </li>
                                                                    )
                                                                )}
                                                            </ul>
                                                        ) : (
                                                            <p className='text-sm whitespace-pre-line'>
                                                                {String(selectedRecord.disease_info.reference_links)}
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

export default HistoryPage;
