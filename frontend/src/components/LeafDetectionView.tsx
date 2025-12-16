import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
import { RotateCcw, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import PrintButton from "./PrintButton";

interface DiseaseInfo {
    id?: number;
    chinese_name?: string;
    english_name?: string;
    description?: string;
    causes?: string;
    features?: string;
    symptoms?: string | string[]; // JSONB: 可以是字符串或字符串数组
    pesticides?: string | string[]; // JSONB: 可以是字符串或字符串数组
    management_measures?: string | string[]; // JSONB: 可以是字符串或字符串数组
    target_crops?: string;
    severity_levels?: string;
    prevention_tips?: string | string[]; // JSONB: 可以是字符串或字符串数组
    reference_links?: string | string[]; // JSONB: 可以是字符串或字符串数组
}

interface LeafDetectionViewProps {
    result: {
        disease?: string;
        severity?: string;
        confidence?: number;
        image_path?: string;
        predict_img_url?: string;
        disease_info?: DiseaseInfo;
        errorMessage?: string;
        cnn_result?: {
            best_class?: string;
        };
        final_status?: string;
        crop_count?: number;
    };
    onReset: () => void;
}

function LeafDetectionView({ result, onReset }: LeafDetectionViewProps) {
    const navigate = useNavigate();
    const printRef = useRef<HTMLDivElement>(null);

    if (!result) return null;

    // 檢查 CNN 結果是否為 other 或 whole_plant（只在 CNN 檢測時）
    const isCNNDetection = result.final_status !== "yolo_detected" && result.cnn_result;
    const bestClass = result.cnn_result?.best_class?.toLowerCase();
    const disease = result.disease?.toLowerCase();
    const isError =
        isCNNDetection &&
        (bestClass === "other" ||
            bestClass === "others" ||
            bestClass === "whole_plant" ||
            disease === "other" ||
            disease === "whole_plant");
    const errorMessage = result.errorMessage || (isError ? "非植物葉片或解析度過低" : undefined);

    const filename = `檢測結果_${result.disease || "未知"}_${new Date().toISOString().split("T")[0]}`;

    // const severityColors: Record<string, string> = {
    //     Mild: "bg-emerald-500",
    //     Moderate: "bg-yellow-500",
    //     Severe: "bg-red-500",
    // };

    return (
        <div className='container mx-auto p-4 max-w-4xl pb-24'>
            <Card
                ref={printRef}
                className='print:shadow-none print:border-2 print:bg-transparent'
                style={{
                    // 确保打印时所有内容可见
                    printColorAdjust: "exact",
                    WebkitPrintColorAdjust: "exact",
                }}
            >
                <CardHeader>
                    <CardTitle>檢測結果</CardTitle>
                    <CardDescription>AI 檢測完成</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6 print:space-y-6'>
                    {/* 圖片顯示區域 - 同時顯示原始圖片和帶框圖片 */}
                    {(result.image_path || result.predict_img_url) && (
                        <div
                            className={`grid gap-4 ${
                                result.image_path && result.predict_img_url
                                    ? "grid-cols-1 md:grid-cols-2"
                                    : "grid-cols-1"
                            }`}
                        >
                            {/* 原始圖片 */}
                            {result.image_path && (
                                <div className='space-y-2'>
                                    <h3 className='text-sm font-medium text-neutral-700 print:text-black'>原始圖片</h3>
                                    <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 print:overflow-visible print:border-2 print:bg-transparent'>
                                        <img
                                            src={result.image_path}
                                            alt='原始圖片'
                                            className='w-full h-auto print:max-w-[60%] print:w-[60%] print:h-auto print:block print:mx-auto'
                                            style={{
                                                printColorAdjust: "exact",
                                                WebkitPrintColorAdjust: "exact",
                                            }}
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
                            {result.predict_img_url && (
                                <div className='space-y-2'>
                                    <h3 className='text-sm font-medium text-neutral-700 print:text-black'>檢測結果</h3>
                                    <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 print:overflow-visible print:border-2 print:bg-transparent'>
                                        <img
                                            src={result.predict_img_url}
                                            alt='檢測結果圖片'
                                            className='w-full h-auto print:max-w-[60%] print:w-[60%] print:h-auto print:block print:mx-auto'
                                            style={{
                                                printColorAdjust: "exact",
                                                WebkitPrintColorAdjust: "exact",
                                            }}
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

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <Card>
                            <CardHeader>
                                <CardTitle className='text-lg'>檢測結果</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {errorMessage ? (
                                    <div className='text-xl font-bold text-red-600 print:text-black'>
                                        {errorMessage}
                                    </div>
                                ) : (
                                    <>
                                        <div className='text-2xl font-bold text-emerald-700 print:text-black'>
                                            {result.disease || "未知"}
                                        </div>
                                        {result.disease_info?.description && (
                                            <p className='text-sm text-muted-foreground mt-2 print:text-black'>
                                                {result.disease_info.description}
                                            </p>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {!errorMessage && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='text-lg'>檢測信心度</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className='flex items-baseline gap-2'>
                                        <span className='text-4xl md:text-5xl font-bold text-emerald-700 print:text-black'>
                                            {result.confidence ? (result.confidence * 100).toFixed(1) : "N/A"}
                                        </span>
                                        <span className='text-lg text-muted-foreground print:text-black'>%</span>
                                    </div>
                                    {/* {result.severity && (
                                        <div className='mt-3'>
                                            <Badge
                                                className={`${
                                                    severityColors[result.severity] || "bg-neutral-500"
                                                } text-white`}
                                            >
                                                {result.severity}
                                            </Badge>
                                        </div>
                                    )} */}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* 病害詳細資訊 - 只顯示有資訊的欄位，有錯誤時不顯示 */}
                    {result.disease_info && !errorMessage && (
                        <>
                            {/* 病害特徵 */}
                            {result.disease_info.features && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>病害特徵</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className='text-sm whitespace-pre-line print:text-black'>
                                            {result.disease_info.features}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* 病因 */}
                            {result.disease_info.causes && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>病因</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className='text-sm whitespace-pre-line print:text-black'>
                                            {result.disease_info.causes}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* 症狀 */}
                            {result.disease_info.symptoms && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>症狀</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {Array.isArray(result.disease_info.symptoms) ? (
                                            <ul className='list-disc list-inside space-y-1 text-sm print:text-black'>
                                                {result.disease_info.symptoms.map((symptom: string, index: number) => (
                                                    <li key={index} className='print:text-black'>
                                                        {symptom}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line print:text-black'>
                                                {String(result.disease_info.symptoms)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* 目標作物 */}
                            {result.disease_info.target_crops && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>目標作物</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className='text-sm print:text-black'>{result.disease_info.target_crops}</p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* 嚴重程度等級 */}
                            {result.disease_info.severity_levels && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>嚴重程度等級</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className='text-sm print:text-black'>
                                            {result.disease_info.severity_levels}
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* 管理措施 */}
                            {result.disease_info.management_measures && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>管理措施</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {Array.isArray(result.disease_info.management_measures) ? (
                                            <ul className='list-disc list-inside space-y-1 text-sm print:text-black'>
                                                {result.disease_info.management_measures.map(
                                                    (measure: string, index: number) => (
                                                        <li key={index} className='print:text-black'>
                                                            {measure}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line print:text-black'>
                                                {String(result.disease_info.management_measures)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* 農藥建議 */}
                            {result.disease_info.pesticides && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>農藥建議</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {Array.isArray(result.disease_info.pesticides) ? (
                                            <ul className='list-disc list-inside space-y-1 text-sm print:text-black'>
                                                {result.disease_info.pesticides.map(
                                                    (pesticide: string, index: number) => (
                                                        <li key={index} className='print:text-black'>
                                                            {pesticide}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line print:text-black'>
                                                {String(result.disease_info.pesticides)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* 預防建議 */}
                            {result.disease_info.prevention_tips && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>預防建議</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {Array.isArray(result.disease_info.prevention_tips) ? (
                                            <ul className='list-disc list-inside space-y-1 text-sm print:text-black'>
                                                {result.disease_info.prevention_tips.map(
                                                    (tip: string, index: number) => (
                                                        <li key={index} className='print:text-black'>
                                                            {tip}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line print:text-black'>
                                                {String(result.disease_info.prevention_tips)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* 參考連結 */}
                            {result.disease_info.reference_links && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>參考連結</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {Array.isArray(result.disease_info.reference_links) ? (
                                            <ul className='list-disc list-inside space-y-1 text-sm print:text-black'>
                                                {result.disease_info.reference_links.map(
                                                    (link: string, index: number) => (
                                                        <li key={index} className='print:text-black'>
                                                            <a
                                                                href={link}
                                                                target='_blank'
                                                                rel='noopener noreferrer'
                                                                className='text-emerald-600 hover:underline print:text-black print:underline'
                                                            >
                                                                {link}
                                                            </a>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line print:text-black'>
                                                {String(result.disease_info.reference_links)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 固定在底部的按鈕區域 */}
            <div className='fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50'>
                <div className='container mx-auto max-w-4xl'>
                    <div className='flex flex-col sm:flex-row gap-3'>
                        <Button
                            onClick={onReset}
                            className='w-full sm:flex-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-200'
                            variant='outline'
                        >
                            <RotateCcw className='h-4 w-4 mr-2' />
                            重新檢測
                        </Button>
                        <PrintButton
                            contentRef={printRef}
                            filename={filename}
                            className='w-full sm:flex-1'
                            variant='outline'
                        />
                        <Button
                            onClick={() => navigate("/history")}
                            className='w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white'
                        >
                            <History className='h-4 w-4 mr-2' />
                            查看歷史記錄
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LeafDetectionView;
