import { useState, useEffect, useMemo, useRef } from "react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Loader2,
    Calendar,
    TrendingUp,
    Filter,
    ArrowUpDown,
    X,
    Printer,
    ArrowUp,
    Trash2,
    CheckSquare,
    Square,
    Check,
} from "lucide-react";
import PrintButton from "@/components/PrintButton";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { useIsMobile } from "@/hooks/use-mobile";

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
    crop_count?: number;
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
    const printRef = useRef<HTMLDivElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(12);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<HistoryRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
    const isMobile = useIsMobile();

    useEffect(() => {
        if (error) {
            toast.error(error);
            setError("");
        }
    }, [error]);

    const hasLoadedRef = useRef(false);

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

    useEffect(() => {
        // 防止在 React StrictMode 下重复加载
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;
        loadHistory();
    }, []);

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

    // 分页计算
    const totalPages = Math.ceil(filteredAndSortedHistory.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedHistory = filteredAndSortedHistory.slice(startIndex, endIndex);

    // 当筛选或排序改变时，重置到第一页
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCrops, selectedDiseaseTypes, sortField, sortOrder]);

    // 监听滚动事件，显示/隐藏回到顶部按钮
    useEffect(() => {
        const handleScroll = () => {
            // 当滚动超过 300px 时显示按钮
            setShowScrollTop(window.scrollY > 300);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // 滚动到顶部
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // 打开删除确认对话框（单个删除）
    const handleDeleteClick = (e: React.MouseEvent, record: HistoryRecord) => {
        e.stopPropagation(); // 阻止触发卡片点击事件
        setRecordToDelete(record);
        setDeleteDialogOpen(true);
    };

    // 切换选取模式
    const toggleSelectMode = () => {
        setSelectMode(!selectMode);
        setSelectedRecordIds(new Set()); // 退出选取模式时清空选中项
    };

    // 切换单个记录的选中状态
    const toggleRecordSelection = (e: React.MouseEvent, recordId: number) => {
        e.stopPropagation(); // 阻止触发卡片点击事件
        setSelectedRecordIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(recordId)) {
                newSet.delete(recordId);
            } else {
                newSet.add(recordId);
            }
            return newSet;
        });
    };

    // 全选/取消全选当前页
    const toggleSelectAll = () => {
        if (selectedRecordIds.size === paginatedHistory.length) {
            // 取消全选
            setSelectedRecordIds(new Set());
        } else {
            // 全选当前页
            const allIds = new Set(paginatedHistory.map((record) => record.id));
            setSelectedRecordIds(allIds);
        }
    };

    // 批量删除
    const handleBatchDelete = async () => {
        if (selectedRecordIds.size === 0) return;

        setDeleting(true);
        try {
            // 逐个删除选中的记录
            const deletePromises = Array.from(selectedRecordIds).map((recordId) =>
                apiFetch("/history/delete", {
                    method: "DELETE",
                    body: JSON.stringify({ record_id: recordId }),
                })
            );

            const results = await Promise.allSettled(deletePromises);
            const successCount = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
            const failCount = results.length - successCount;

            if (successCount > 0) {
                toast.success(`成功刪除 ${successCount} 筆記錄${failCount > 0 ? `，${failCount} 筆失敗` : ""}`);
            } else {
                toast.error("刪除失敗");
            }

            // 清空选中项并退出选取模式
            setSelectedRecordIds(new Set());
            setSelectMode(false);

            // 如果删除的记录中包含当前查看的记录，关闭 Dialog
            if (selectedRecord && selectedRecordIds.has(selectedRecord.id)) {
                setSelectedRecord(null);
            }

            // 重新載入歷史記錄
            await loadHistory();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setDeleting(false);
        }
    };

    // 确认删除
    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;

        setDeleting(true);
        try {
            const res = await apiFetch("/history/delete", {
                method: "DELETE",
                body: JSON.stringify({ record_id: recordToDelete.id }),
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "刪除失敗");
                return;
            }

            toast.success("記錄已刪除");
            setDeleteDialogOpen(false);
            setRecordToDelete(null);

            // 如果刪除的是當前查看的記錄，關閉 Dialog
            if (selectedRecord?.id === recordToDelete.id) {
                setSelectedRecord(null);
            }

            // 重新載入歷史記錄
            await loadHistory();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "網絡錯誤");
        } finally {
            setDeleting(false);
        }
    };

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

    const getPrintFilename = () => {
        if (!selectedRecord) return "檢測結果";
        const diseaseName = selectedRecord.disease || selectedRecord.disease_name || "未知";
        return `檢測結果_${diseaseName}_${new Date().toISOString().split("T")[0]}`;
    };

    if (loading) {
        return (
            <div
                className={`container mx-auto p-4 max-w-6xl ${
                    isMobile
                        ? "bg-gradient-to-b from-white to-emerald-50 min-h-screen"
                        : "bg-gradient-to-b from-white to-emerald-50"
                }`}
            >
                <div className='text-center py-12'>
                    <Loader2 className='w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4' />
                    <p className='text-lg text-neutral-600'>載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`${
                isMobile
                    ? "w-full p-6 pt-8 bg-gradient-to-b from-white to-emerald-50 min-h-screen "
                    : "container mx-auto p-4 md:p-6 lg:p-8 max-w-6xl"
            }`}
        >
            <div className={`space-y-4 ${isMobile ? "space-y-4" : "sm:space-y-6"}`}>
                <div className='flex items-center justify-between flex-wrap gap-3'>
                    <div>
                        <h1
                            className={`
                                ${isMobile ? "text-3xl" : "text-2xl sm:text-3xl md:text-4xl"} 
                                font-extrabold tracking-tight text-emerald-700 
                                ${isMobile ? "mb-1" : "mb-1 sm:mb-2"}
                            `}
                        >
                            檢測歷史
                        </h1>
                        {!isMobile && <p className='text-sm text-neutral-600'>查看過去的檢測記錄</p>}
                    </div>
                    {/* 右上角選取/刪除按鈕 */}
                    <div className={`flex items-center gap-2 ${isMobile ? "gap-1" : "gap-2"}`}>
                        {selectMode && selectedRecordIds.size > 0 && (
                            <Button
                                variant='destructive'
                                onClick={handleBatchDelete}
                                disabled={deleting}
                                className={`flex items-center gap-2 ${isMobile ? "text-xs h-7 px-2 py-1 gap-1" : ""}`}
                            >
                                {deleting ? (
                                    <>
                                        <Loader2 className={`${isMobile ? "h-3 w-3" : "h-4 w-4"} animate-spin`} />
                                        刪除中...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                        刪除
                                        <span className={isMobile ? "inline" : ""}>({selectedRecordIds.size})</span>
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            variant={selectMode ? "default" : "ghost"}
                            onClick={toggleSelectMode}
                            className={`flex items-center gap-2 ${isMobile ? "text-xs h-7 px-2 py-1 gap-1" : ""}`}
                        >
                            {selectMode ? (
                                <>
                                    <X className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                    <span>取消選取</span>
                                </>
                            ) : (
                                <>
                                    <CheckSquare className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                    <span>選取</span>
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* 排序和篩選工具欄 */}
                <div className='flex flex-row flex-wrap items-center gap-2 overflow-x-auto pb-2'>
                    {/* 排序 */}
                    <div className='flex items-center gap-1.5 flex-shrink-0'>
                        <ArrowUpDown className={`${isMobile ? "hidden" : "w-3.5 h-3.5"} text-neutral-500`} />
                        <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                            <SelectTrigger
                                className={`shadow-none ${
                                    isMobile
                                        ? "w-auto h-7 text-[13px] px-0 border-none"
                                        : "w-auto h-8 text-xs sm:text-sm"
                                }`}
                            >
                                <SelectValue placeholder='排序欄位' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='created_at'>時間</SelectItem>
                                <SelectItem value='confidence'>置信度</SelectItem>
                                <SelectItem value='disease_name'>病害名稱</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
                            <SelectTrigger
                                className={`shadow-none  ${
                                    isMobile
                                        ? "w-auto h-7 text-[13px] px-0 border-none"
                                        : "w-auto h-8 text-xs sm:text-sm "
                                }`}
                            >
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
                            <Button
                                variant={isMobile ? "ghost" : "default"}
                                className={`gap-1.5 flex-shrink-0 ${
                                    isMobile ? "h-7 px-1 text-[11px]" : "h-8.5 py-2 sm:px-3 text-xs sm:text-sm"
                                }`}
                            >
                                <Filter className={isMobile ? "w-3 h-3" : "w-3.5 h-3.5"} />
                                <span className={isMobile ? "inline text-[13px]" : "inline"}>篩選</span>
                                {(selectedCrops.length > 0 || selectedDiseaseTypes.length > 0) && (
                                    <Badge
                                        className={`ml-0.5 ${
                                            isMobile ? "h-3.5 px-0.5 text-[9px]" : "h-4 px-1 text-[10px]"
                                        }`}
                                    >
                                        {selectedCrops.length + selectedDiseaseTypes.length}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto' align='start'>
                            <div className='space-y-4'>
                                {/* 作物類別篩選 */}
                                <div className='space-y-2'>
                                    <Label className='text-[13px] font-semibold'>作物類別</Label>
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
                                                className={isMobile ? "h-7 px-2 text-[13px]" : ""}
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
                                    <Label className='text-[13px] font-semibold'>病害類別</Label>
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
                                                className={isMobile ? "h-7 px-2 text-[13px]" : ""}
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
                                    <Button
                                        variant='outline'
                                        onClick={clearFilters}
                                        className={`w-full ${isMobile ? "h-7 text-[11px]" : ""}`}
                                    >
                                        <X className={isMobile ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2"} />
                                        清除所有篩選
                                    </Button>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* 每頁顯示數量選擇 */}
                    <div className={`${isMobile ? "hidden" : "flex items-center gap-1.5 flex-shrink-0"}`}>
                        <Select
                            value={itemsPerPage.toString()}
                            defaultValue='20'
                            onValueChange={(value) => {
                                setItemsPerPage(Number(value));
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger
                                className={`${
                                    isMobile ? "w-11 h-7 text-[11px] px-1" : "w-auto h-8 text-xs sm:text-sm"
                                }`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='default' disabled>
                                    每頁顯示數量
                                </SelectItem>
                                <SelectItem value='10'>10 筆</SelectItem>
                                <SelectItem value='20'>20 筆</SelectItem>
                                <SelectItem value='30'>30 筆</SelectItem>
                                <SelectItem value='50'>50 筆</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 顯示結果數量 */}
                    <div
                        className={`${
                            isMobile ? "text-[9px]" : "text-[10px] sm:text-xs"
                        } text-neutral-600 ml-auto flex-shrink-0 whitespace-nowrap`}
                    >
                        {filteredAndSortedHistory.length > 0 ? (
                            <>
                                {startIndex + 1}-{Math.min(endIndex, filteredAndSortedHistory.length)} /{" "}
                                {filteredAndSortedHistory.length}
                                {filteredAndSortedHistory.length !== history.length && (
                                    <span className='text-neutral-500 hidden sm:inline'> (總共 {history.length})</span>
                                )}
                            </>
                        ) : (
                            <>0 / {history.length}</>
                        )}
                    </div>
                </div>

                {filteredAndSortedHistory.length === 0 ? (
                    <Card>
                        <CardContent className='py-8 sm:py-12'>
                            <div className='text-center'>
                                <Calendar
                                    className={`${
                                        isMobile ? "w-10 h-10" : "w-12 h-12 sm:w-16 sm:h-16"
                                    } mx-auto mb-3 sm:mb-4 text-neutral-400`}
                                />
                                <p
                                    className={`${
                                        isMobile ? "text-sm" : "text-base sm:text-lg"
                                    } font-medium text-neutral-600 mb-2`}
                                >
                                    {history.length === 0 ? "尚無檢測記錄" : "沒有符合篩選條件的記錄"}
                                </p>
                                <p className={`${isMobile ? "text-xs" : "text-xs sm:text-sm"} text-neutral-500 px-4`}>
                                    {history.length === 0 ? "開始使用 AI 診斷功能來建立您的檢測歷史" : "請調整篩選條件"}
                                </p>
                                {history.length > 0 && (
                                    <Button
                                        variant='outline'
                                        onClick={clearFilters}
                                        className={`${isMobile ? "mt-4 h-7 text-[11px]" : "mt-4"}`}
                                    >
                                        清除篩選
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* 選取模式下的全選按鈕 */}
                        {selectMode && paginatedHistory.length > 0 && (
                            <div className='flex items-center justify-between mb-4'>
                                <div className='flex items-center gap-2'>
                                    <Button
                                        variant='secondary'
                                        size='sm'
                                        onClick={toggleSelectAll}
                                        className={`flex items-center gap-2 ${isMobile ? "h-7 text-[11px]" : ""}`}
                                    >
                                        {selectedRecordIds.size === paginatedHistory.length ? (
                                            <>
                                                <CheckSquare className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                                取消全選
                                            </>
                                        ) : (
                                            <>
                                                <Square className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                                全選本頁
                                            </>
                                        )}
                                    </Button>
                                    {selectedRecordIds.size > 0 && (
                                        <span className={`${isMobile ? "text-xs" : "text-sm"} text-neutral-600`}>
                                            已選取 {selectedRecordIds.size} 項
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div
                            className={`grid ${
                                isMobile
                                    ? "grid-cols-1 gap-2"
                                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6"
                            }`}
                        >
                            {paginatedHistory.map((record) => {
                                const displayImageUrl =
                                    record.original_image_url || record.image_path || record.annotated_image_url;
                                const isSelected = selectedRecordIds.has(record.id);

                                return (
                                    <Card
                                        key={record.id}
                                        className={`hover:shadow-lg transition-shadow border-neutral-200 hover:border-emerald-300 py-0 relative ${
                                            selectMode ? "cursor-default" : "cursor-pointer"
                                        } ${isSelected ? "ring-1 ring-emerald-500 border-emerald-500" : ""}`}
                                        onClick={() => {
                                            if (!selectMode) {
                                                setSelectedRecord(record);
                                            }
                                        }}
                                    >
                                        {/* 選取模式下的勾選框 */}
                                        {selectMode && (
                                            <div className='absolute top-2 left-2 z-10'>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    className={`p-0 bg-white/90 hover:bg-emerald-50 text-neutral-500 shadow-sm ${
                                                        isMobile ? "h-7 w-7" : "h-8 w-8"
                                                    }`}
                                                    onClick={(e) => toggleRecordSelection(e, record.id)}
                                                    aria-label={isSelected ? "取消選取" : "選取"}
                                                >
                                                    {isSelected ? (
                                                        <div className={`relative ${isMobile ? "h-4 w-4" : "h-5 w-5"}`}>
                                                            <Square
                                                                className={`${
                                                                    isMobile ? "h-4 w-4" : "h-5 w-5"
                                                                } text-emerald-600`}
                                                            />
                                                            <Check
                                                                className={`${
                                                                    isMobile ? "h-3 w-3" : "h-3.5 w-3.5"
                                                                } text-emerald-600 absolute top-0 left-0.5`}
                                                                strokeWidth={3}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <Square className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                        <div className='flex flex-row sm:flex-col'>
                                            {/* 手機版：左邊圖片 */}
                                            {displayImageUrl && (
                                                <div
                                                    className={`relative ${
                                                        isMobile ? "w-24 h-24" : "w-32 h-32 sm:w-full sm:h-48"
                                                    } flex-shrink-0 overflow-hidden group`}
                                                >
                                                    <img
                                                        src={displayImageUrl}
                                                        alt='檢測結果'
                                                        className={`${
                                                            isMobile
                                                                ? "w-24 h-24 rounded-l-xl"
                                                                : "w-full h-full rounded-t-lg"
                                                        } object-cover  sm:rounded-b-none sm:rounded-t-lg`}
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
                                                                className={`${
                                                                    isMobile ? "text-xs h-7 px-2" : "text-xs"
                                                                }`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const img = e.currentTarget
                                                                        .closest(".group")
                                                                        ?.querySelector("img");
                                                                    if (img) {
                                                                        const currentSrc = img.src;
                                                                        const originalUrl = record.original_image_url;
                                                                        const annotatedUrl = record.annotated_image_url;
                                                                        if (
                                                                            currentSrc === originalUrl &&
                                                                            annotatedUrl
                                                                        ) {
                                                                            img.src = annotatedUrl;
                                                                        } else if (
                                                                            currentSrc === annotatedUrl &&
                                                                            originalUrl
                                                                        ) {
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
                                            {/* 手機版：右邊文字 */}
                                            <div className='flex-1 flex flex-col min-w-0 pl-2 justify-center'>
                                                <CardHeader
                                                    className={`pl-4 ${
                                                        isMobile ? "p-2 pb-0" : "p-3 sm:p-4 md:pb-0 pl-5 sm:pl-6"
                                                    }`}
                                                >
                                                    <div className='flex items-start justify-between gap-2'>
                                                        <CardTitle
                                                            className={`truncate ${
                                                                isMobile
                                                                    ? "text-[15px] pt-1"
                                                                    : "text-base sm:text-xl md:text-2xl"
                                                            } ${(() => {
                                                                // 只在 CNN 檢測結果時顯示錯誤（disease_name 為 "others" 或 "whole_plant" 表示 CNN 檢測）
                                                                const diseaseName = record.disease_name?.toLowerCase();
                                                                const isCNNDetection =
                                                                    diseaseName === "others" ||
                                                                    diseaseName === "whole_plant" ||
                                                                    diseaseName === "other";
                                                                return isCNNDetection
                                                                    ? "text-red-600"
                                                                    : "text-emerald-700";
                                                            })()}`}
                                                        >
                                                            {(() => {
                                                                // 只在 CNN 檢測結果時顯示錯誤
                                                                const diseaseName = record.disease_name?.toLowerCase();
                                                                const isCNNDetection =
                                                                    diseaseName === "others" ||
                                                                    diseaseName === "whole_plant" ||
                                                                    diseaseName === "other";
                                                                return isCNNDetection
                                                                    ? "非植物葉片或解析度過低"
                                                                    : record.disease || "未知病害";
                                                            })()}
                                                        </CardTitle>
                                                        {!displayImageUrl && (
                                                            <Badge
                                                                className={`${
                                                                    severityColors[record.severity || ""] ||
                                                                    "bg-neutral-500"
                                                                } text-white text-xs flex-shrink-0`}
                                                            >
                                                                {record.severity || "N/A"}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CardHeader>
                                                <CardContent
                                                    className={`flex-1 ${
                                                        isMobile
                                                            ? "space-y-1 p-2 pt-0"
                                                            : "space-y-2 sm:space-y-3 p-5 sm:p-6 pt-0"
                                                    }`}
                                                >
                                                    {(() => {
                                                        const diseaseName = record.disease_name?.toLowerCase();
                                                        if (
                                                            !diseaseName ||
                                                            diseaseName === "others" ||
                                                            diseaseName === "whole_plant" ||
                                                            diseaseName === "other"
                                                        )
                                                            return null;
                                                        if (record.confidence !== undefined) {
                                                            return (
                                                                <div
                                                                    className={`flex items-center gap-2 ${
                                                                        isMobile ? "text-[11px]" : "text-xs sm:text-sm"
                                                                    }`}
                                                                >
                                                                    <TrendingUp
                                                                        className={`${
                                                                            isMobile
                                                                                ? "w-3 h-3"
                                                                                : "w-3 h-3 sm:w-4 sm:h-4"
                                                                        } text-emerald-600 flex-shrink-0`}
                                                                    />
                                                                    <span className='text-neutral-600 truncate'>
                                                                        信心度:{" "}
                                                                        <span className='font-semibold text-emerald-700'>
                                                                            {(record.confidence * 100).toFixed(1)}%
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                    <div
                                                        className={`flex items-center gap-2 text-neutral-500 ${
                                                            isMobile ? "text-[11px]" : "text-xs sm:text-sm"
                                                        }`}
                                                    >
                                                        <Calendar
                                                            className={isMobile ? "w-3 h-3" : "w-3 h-3 sm:w-4 sm:h-4"}
                                                        />
                                                        <span className='truncate'>
                                                            {formatDate(record.timestamp || record.created_at)}
                                                        </span>
                                                    </div>

                                                    {/* 病害詳細資訊摘要（只顯示有資訊的欄位） */}
                                                    {record.disease_info && (
                                                        <div
                                                            className={`pt-2 border-t border-neutral-200 space-y-2 hidden sm:block`}
                                                        >
                                                            {/* 目標作物 */}
                                                            {record.disease_info.target_crops && (
                                                                <div className='text-xs text-neutral-600 line-clamp-1'>
                                                                    <span className='font-medium'>作物：</span>
                                                                    {record.disease_info.target_crops}
                                                                </div>
                                                            )}
                                                            {/* 病因摘要 */}
                                                            {/* 手機版不顯示病因摘要 */}
                                                            {record.disease_info.causes && (
                                                                <div className='text-xs text-neutral-600 line-clamp-2'>
                                                                    <span className='font-medium'>病因：</span>
                                                                    {record.disease_info.causes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* 分页组件 */}
                        {totalPages > 1 && (
                            <div className='mt-6 mb-6'>
                                <Pagination>
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href='#'
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (currentPage > 1) {
                                                        setCurrentPage(currentPage - 1);
                                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                                    }
                                                }}
                                                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                                            />
                                        </PaginationItem>

                                        {/* 页码按钮 */}
                                        {(() => {
                                            const pages: (number | "ellipsis")[] = [];
                                            const maxVisiblePages = 5;

                                            if (totalPages <= maxVisiblePages) {
                                                // 如果总页数少于等于最大可见页数，显示所有页码
                                                for (let i = 1; i <= totalPages; i++) {
                                                    pages.push(i);
                                                }
                                            } else {
                                                // 否则显示部分页码
                                                if (currentPage <= 3) {
                                                    // 当前页在前3页
                                                    for (let i = 1; i <= 4; i++) {
                                                        pages.push(i);
                                                    }
                                                    pages.push("ellipsis");
                                                    pages.push(totalPages);
                                                } else if (currentPage >= totalPages - 2) {
                                                    // 当前页在后3页
                                                    pages.push(1);
                                                    pages.push("ellipsis");
                                                    for (let i = totalPages - 3; i <= totalPages; i++) {
                                                        pages.push(i);
                                                    }
                                                } else {
                                                    // 当前页在中间
                                                    pages.push(1);
                                                    pages.push("ellipsis");
                                                    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                                        pages.push(i);
                                                    }
                                                    pages.push("ellipsis");
                                                    pages.push(totalPages);
                                                }
                                            }

                                            return pages.map((page, index) => {
                                                if (page === "ellipsis") {
                                                    return (
                                                        <PaginationItem key={`ellipsis-${index}`}>
                                                            <PaginationEllipsis />
                                                        </PaginationItem>
                                                    );
                                                }
                                                return (
                                                    <PaginationItem key={page}>
                                                        <PaginationLink
                                                            href='#'
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setCurrentPage(page);
                                                                window.scrollTo({ top: 0, behavior: "smooth" });
                                                            }}
                                                            isActive={currentPage === page}
                                                        >
                                                            {page}
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                );
                                            });
                                        })()}

                                        <PaginationItem>
                                            <PaginationNext
                                                href='#'
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (currentPage < totalPages) {
                                                        setCurrentPage(currentPage + 1);
                                                        window.scrollTo({ top: 0, behavior: "smooth" });
                                                    }
                                                }}
                                                className={
                                                    currentPage === totalPages ? "pointer-events-none opacity-50" : ""
                                                }
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </div>
                        )}
                    </>
                )}

                {/* 詳細說明 Dialog */}
                <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
                    <DialogContent
                        className={`${
                            isMobile
                                ? "max-w-full max-h-[100vh] w-full h-[100vh] p-0 rounded-none"
                                : "max-w-[90vw] max-h-[95vh] md:max-w-4xl p-6 rounded-lg"
                        } flex flex-col overflow-hidden [&>button]:hidden`}
                    >
                        {selectedRecord && (
                            <>
                                {/* 右上角列印＋刪除＋關閉（統一顯示在手機版和桌面版） */}
                                <div className='relative'>
                                    <div
                                        className={`absolute ${
                                            isMobile ? "right-3 top-3" : "right-6 top-6"
                                        } flex z-20 gap-1`}
                                    >
                                        <PrintButton
                                            contentRef={printRef}
                                            filename={getPrintFilename()}
                                            className='p-2 text-neutral-700 hover:text-neutral-900 hover:bg-transparent'
                                            variant='ghost'
                                        >
                                            <Printer className='h-5 w-5' />
                                        </PrintButton>
                                        <button
                                            type='button'
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClick(e, selectedRecord);
                                            }}
                                            aria-label='刪除記錄'
                                            className='hover:bg-red-50 text-red-600 rounded p-2'
                                            disabled={deleting}
                                        >
                                            {deleting ? (
                                                <Loader2 className='h-5 w-5 animate-spin' />
                                            ) : (
                                                <Trash2 className='h-5 w-5' />
                                            )}
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => setSelectedRecord(null)}
                                            aria-label='關閉'
                                            className='hover:bg-neutral-200 text-neutral-700 rounded p-2'
                                        >
                                            <span className='sr-only'>關閉</span>
                                            {/* x-icon */}
                                            <svg width='20' height='20' viewBox='0 0 20 20' fill='none'>
                                                <path
                                                    d='M6 6L14 14'
                                                    stroke='currentColor'
                                                    strokeWidth='2'
                                                    strokeLinecap='round'
                                                />
                                                <path
                                                    d='M14 6L6 14'
                                                    stroke='currentColor'
                                                    strokeWidth='2'
                                                    strokeLinecap='round'
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div ref={printRef} className='flex-1 overflow-y-auto'>
                                    <DialogHeader
                                        className={`sticky top-[-5px] pb-0 bg-white ${
                                            isMobile ? "px-0 pt-0" : "sm:px-0 sm:pt-0"
                                        }`}
                                    >
                                        <div>
                                            <DialogTitle
                                                className={`${
                                                    isMobile
                                                        ? "text-lg m-2 text-left pl-4"
                                                        : "text-lg sm:text-xl m-2 text-left pl-4"
                                                }`}
                                            >
                                                檢測結果詳情
                                            </DialogTitle>
                                            <DialogDescription
                                                className={`${
                                                    isMobile
                                                        ? "text-xs m-2 text-left pl-4 pb-2"
                                                        : "text-xs sm:text-sm m-2 text-left pl-4 pb-2"
                                                } border-b border-neutral-200`}
                                            >
                                                查看完整的檢測信息和病害詳細說明
                                            </DialogDescription>
                                        </div>
                                    </DialogHeader>
                                    <div
                                        className={`${
                                            isMobile
                                                ? "space-y-4 mt-2 px-4 pb-4"
                                                : "space-y-4 sm:space-y-6 mt-2 sm:mt-4 px-4 pb-4 sm:px-0"
                                        }`}
                                    >
                                        {/* 圖片顯示區域 */}
                                        {(selectedRecord.original_image_url ||
                                            selectedRecord.image_path ||
                                            selectedRecord.annotated_image_url) && (
                                            <div
                                                className={`grid gap-3 sm:gap-4 ${
                                                    selectedRecord.original_image_url &&
                                                    selectedRecord.annotated_image_url
                                                        ? "grid-cols-2"
                                                        : "grid-cols-1"
                                                }`}
                                            >
                                                {/* 原始圖片 */}
                                                {(selectedRecord.original_image_url || selectedRecord.image_path) && (
                                                    <div className='space-y-2'>
                                                        <h3 className='text-xs sm:text-sm font-medium text-neutral-700 text-center'>
                                                            原始圖片
                                                        </h3>
                                                        <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 h-auto'>
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
                                                                            '<p class="text-xs sm:text-sm text-neutral-500 p-3 sm:p-4 text-center">圖片載入失敗</p>';
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 帶框圖片 */}
                                                {selectedRecord.annotated_image_url && (
                                                    <div className='space-y-2'>
                                                        <h3 className='text-xs sm:text-sm font-medium text-neutral-700 text-center'>
                                                            檢測結果
                                                        </h3>
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
                                                                            '<p class="text-xs sm:text-sm text-neutral-500 p-3 sm:p-4 text-center">圖片載入失敗</p>';
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 病害類型和嚴重程度 */}
                                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3'>
                                            <Card className='p-2 gap-0'>
                                                <CardHeader className='sm:p-3'>
                                                    <CardTitle className='text-base sm:text-lg'>檢測結果</CardTitle>
                                                </CardHeader>
                                                <CardContent className='sm:p-3 pt-0'>
                                                    {(() => {
                                                        // 只在 CNN 檢測結果時顯示錯誤（disease_name 為 "others" 或 "whole_plant" 表示 CNN 檢測）
                                                        const diseaseName = selectedRecord.disease_name?.toLowerCase();
                                                        const isCNNDetection =
                                                            diseaseName === "others" ||
                                                            diseaseName === "whole_plant" ||
                                                            diseaseName === "other";

                                                        if (isCNNDetection) {
                                                            return (
                                                                <div className='text-xl sm:text-2xl md:text-3xl font-bold text-red-600 w-full'>
                                                                    非植物葉片或解析度過低
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                <div className='text-3xl sm:text-4xl md:text-5xl font-bold text-emerald-700'>
                                                                    {selectedRecord.disease ||
                                                                        selectedRecord.disease_info?.chinese_name ||
                                                                        selectedRecord.disease_name ||
                                                                        "未知"}
                                                                </div>
                                                                {selectedRecord.disease_info?.english_name && (
                                                                    <p className='text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3'>
                                                                        {selectedRecord.disease_info.english_name}
                                                                    </p>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </CardContent>
                                            </Card>

                                            {(() => {
                                                // 只在 CNN 檢測結果時顯示錯誤
                                                const diseaseName = selectedRecord.disease_name?.toLowerCase();
                                                const isCNNDetection =
                                                    diseaseName === "others" ||
                                                    diseaseName === "whole_plant" ||
                                                    diseaseName === "other";

                                                if (isCNNDetection) {
                                                    return null; // 有錯誤時不顯示信心度
                                                }

                                                return (
                                                    <Card className='p-2 gap-0'>
                                                        <CardHeader className='sm:p-3'>
                                                            <CardTitle className='text-base sm:text-lg'>
                                                                檢測信心度
                                                            </CardTitle>
                                                        </CardHeader>
                                                        <CardContent className='sm:p-3 pt-0'>
                                                            <div className='flex items-baseline gap-2'>
                                                                <span className='text-3xl sm:text-4xl md:text-5xl font-bold text-emerald-700'>
                                                                    {selectedRecord.confidence
                                                                        ? (selectedRecord.confidence * 100).toFixed(1)
                                                                        : "N/A"}
                                                                </span>
                                                                <span className='text-base sm:text-lg text-muted-foreground'>
                                                                    %
                                                                </span>
                                                            </div>
                                                            <div className='mt-2 sm:mt-3'>
                                                                <p className='text-xs sm:text-sm text-muted-foreground'>
                                                                    {formatDate(
                                                                        selectedRecord.timestamp ||
                                                                            selectedRecord.created_at
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })()}
                                        </div>

                                        {/* 病害詳細資訊 - 有錯誤時不顯示 */}
                                        {selectedRecord.disease_info &&
                                            (() => {
                                                // 只在 CNN 檢測結果時顯示錯誤
                                                const diseaseName = selectedRecord.disease_name?.toLowerCase();
                                                const isCNNDetection =
                                                    diseaseName === "others" ||
                                                    diseaseName === "whole_plant" ||
                                                    diseaseName === "other";
                                                return !isCNNDetection;
                                            })() && (
                                                <>
                                                    {/* 病害特徵 */}
                                                    {selectedRecord.disease_info.features && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        病害特徵
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    <p className='text-xs sm:text-sm whitespace-pre-line'>
                                                                        {selectedRecord.disease_info.features}
                                                                    </p>
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 病因 */}
                                                    {selectedRecord.disease_info.causes && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        病因
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    <p className='text-xs sm:text-sm whitespace-pre-line'>
                                                                        {selectedRecord.disease_info.causes}
                                                                    </p>
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 症狀 */}
                                                    {selectedRecord.disease_info.symptoms && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        症狀
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    {Array.isArray(
                                                                        selectedRecord.disease_info.symptoms
                                                                    ) ? (
                                                                        <ul className='list-disc list-inside space-y-1 text-xs sm:text-sm'>
                                                                            {selectedRecord.disease_info.symptoms.map(
                                                                                (symptom: string, index: number) => (
                                                                                    <li key={index}>{symptom}</li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className='text-xs sm:text-sm whitespace-pre-line'>
                                                                            {String(
                                                                                selectedRecord.disease_info.symptoms
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 目標作物 */}
                                                    {selectedRecord.disease_info.target_crops && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        目標作物
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    <p className='text-xs sm:text-sm'>
                                                                        {selectedRecord.disease_info.target_crops}
                                                                    </p>
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 嚴重程度等級 */}
                                                    {selectedRecord.disease_info.severity_levels && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        嚴重程度等級
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    <p className='text-xs sm:text-sm'>
                                                                        {selectedRecord.disease_info.severity_levels}
                                                                    </p>
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 管理措施 */}
                                                    {selectedRecord.disease_info.management_measures && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        管理措施
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    {Array.isArray(
                                                                        selectedRecord.disease_info.management_measures
                                                                    ) ? (
                                                                        <ul className='list-disc list-inside space-y-1 text-xs sm:text-sm'>
                                                                            {selectedRecord.disease_info.management_measures.map(
                                                                                (measure: string, index: number) => (
                                                                                    <li key={index}>{measure}</li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className='text-xs sm:text-sm whitespace-pre-line'>
                                                                            {String(
                                                                                selectedRecord.disease_info
                                                                                    .management_measures
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 農藥建議 */}
                                                    {selectedRecord.disease_info.pesticides && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        農藥建議
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    {Array.isArray(
                                                                        selectedRecord.disease_info.pesticides
                                                                    ) ? (
                                                                        <ul className='list-disc list-inside space-y-1 text-xs sm:text-sm'>
                                                                            {selectedRecord.disease_info.pesticides.map(
                                                                                (pesticide: string, index: number) => (
                                                                                    <li key={index}>{pesticide}</li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className='text-xs sm:text-sm whitespace-pre-line'>
                                                                            {String(
                                                                                selectedRecord.disease_info.pesticides
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 預防建議 */}
                                                    {selectedRecord.disease_info.prevention_tips && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        預防建議
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    {Array.isArray(
                                                                        selectedRecord.disease_info.prevention_tips
                                                                    ) ? (
                                                                        <ul className='list-disc list-inside space-y-1 text-xs sm:text-sm'>
                                                                            {selectedRecord.disease_info.prevention_tips.map(
                                                                                (tip: string, index: number) => (
                                                                                    <li key={index}>{tip}</li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className='text-xs sm:text-sm whitespace-pre-line'>
                                                                            {String(
                                                                                selectedRecord.disease_info
                                                                                    .prevention_tips
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* 參考連結 */}
                                                    {selectedRecord.disease_info.reference_links && (
                                                        <Card className='p-2'>
                                                            <div className='flex flex-row sm:flex-col p-2 sm:p-3 gap-2 sm:gap-0'>
                                                                <CardHeader className='p-0 flex-shrink-0 sm:flex-shrink w-24 sm:w-full'>
                                                                    <CardTitle className='text-sm sm:text-base md:text-lg'>
                                                                        參考連結
                                                                    </CardTitle>
                                                                </CardHeader>
                                                                <CardContent className='p-0 flex-1 sm:pt-0'>
                                                                    {Array.isArray(
                                                                        selectedRecord.disease_info.reference_links
                                                                    ) ? (
                                                                        <ul className='list-disc list-inside space-y-1 text-xs sm:text-sm'>
                                                                            {selectedRecord.disease_info.reference_links.map(
                                                                                (link: string, index: number) => (
                                                                                    <li key={index}>
                                                                                        <a
                                                                                            href={link}
                                                                                            target='_blank'
                                                                                            rel='noopener noreferrer'
                                                                                            className='text-emerald-600 hover:underline break-all'
                                                                                        >
                                                                                            {link}
                                                                                        </a>
                                                                                    </li>
                                                                                )
                                                                            )}
                                                                        </ul>
                                                                    ) : (
                                                                        <p className='text-xs sm:text-sm whitespace-pre-line break-all'>
                                                                            {String(
                                                                                selectedRecord.disease_info
                                                                                    .reference_links
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </CardContent>
                                                            </div>
                                                        </Card>
                                                    )}
                                                </>
                                            )}
                                    </div>
                                </div>
                            </>
                        )}
                    </DialogContent>
                </Dialog>

                {/* 悬浮回到顶部按钮 */}
                {showScrollTop && (
                    <Button
                        onClick={scrollToTop}
                        className='fixed bottom-23 right-6  z-50 rounded-full w-8 h-8 p-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-emerald-600 hover:bg-emerald-700 text-white'
                        aria-label='回到頂部'
                    >
                        <ArrowUp className='h-5 w-5' />
                    </Button>
                )}

                {/* 刪除確認對話框 */}
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>確認刪除</DialogTitle>
                            <DialogDescription>
                                您確定要刪除此檢測記錄嗎？此操作無法復原。
                                {recordToDelete && (
                                    <div className='mt-2 text-sm text-neutral-600'>
                                        <p>
                                            記錄 ID: {recordToDelete.id}
                                            <br />
                                            病害: {recordToDelete.disease || recordToDelete.disease_name || "未知"}
                                        </p>
                                    </div>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant='outline'
                                onClick={() => {
                                    setDeleteDialogOpen(false);
                                    setRecordToDelete(null);
                                }}
                                disabled={deleting}
                            >
                                取消
                            </Button>
                            <Button variant='destructive' onClick={handleConfirmDelete} disabled={deleting}>
                                {deleting ? (
                                    <>
                                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        刪除中...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className='mr-2 h-4 w-4' />
                                        確認刪除
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

export default HistoryPage;
