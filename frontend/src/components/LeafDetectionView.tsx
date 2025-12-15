import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";

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
    };
    onReset: () => void;
}

function LeafDetectionView({ result, onReset }: LeafDetectionViewProps) {
    if (!result) return null;

    // const severityColors: Record<string, string> = {
    //     Mild: "bg-emerald-500",
    //     Moderate: "bg-yellow-500",
    //     Severe: "bg-red-500",
    // };

    return (
        <div className='container mx-auto p-4 max-w-4xl'>
            <Card>
                <CardHeader>
                    <CardTitle>檢測結果</CardTitle>
                    <CardDescription>AI 檢測完成</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
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
                                    <h3 className='text-sm font-medium text-neutral-700'>原始圖片</h3>
                                    <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50'>
                                        <img
                                            src={result.image_path}
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
                            {result.predict_img_url && (
                                <div className='space-y-2'>
                                    <h3 className='text-sm font-medium text-neutral-700'>檢測結果</h3>
                                    <div className='rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50'>
                                        <img
                                            src={result.predict_img_url}
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

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <Card>
                            <CardHeader>
                                <CardTitle className='text-lg'>檢測結果</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className='text-2xl font-bold text-emerald-700'>{result.disease || "未知"}</div>
                                {result.disease_info?.description && (
                                    <p className='text-sm text-muted-foreground mt-2'>
                                        {result.disease_info.description}
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
                                        {result.confidence ? (result.confidence * 100).toFixed(1) : "N/A"}
                                    </span>
                                    <span className='text-lg text-muted-foreground'>%</span>
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
                    </div>

                    {/* 病害詳細資訊 - 只顯示有資訊的欄位 */}
                    {result.disease_info && (
                        <>
                            {/* 病害特徵 */}
                            {result.disease_info.features && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className='text-lg'>病害特徵</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className='text-sm whitespace-pre-line'>{result.disease_info.features}</p>
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
                                        <p className='text-sm whitespace-pre-line'>{result.disease_info.causes}</p>
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
                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                {result.disease_info.symptoms.map((symptom: string, index: number) => (
                                                    <li key={index}>{symptom}</li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line'>
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
                                        <p className='text-sm'>{result.disease_info.target_crops}</p>
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
                                        <p className='text-sm'>{result.disease_info.severity_levels}</p>
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
                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                {result.disease_info.management_measures.map(
                                                    (measure: string, index: number) => (
                                                        <li key={index}>{measure}</li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line'>
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
                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                {result.disease_info.pesticides.map(
                                                    (pesticide: string, index: number) => (
                                                        <li key={index}>{pesticide}</li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line'>
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
                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                {result.disease_info.prevention_tips.map(
                                                    (tip: string, index: number) => (
                                                        <li key={index}>{tip}</li>
                                                    )
                                                )}
                                            </ul>
                                        ) : (
                                            <p className='text-sm whitespace-pre-line'>
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
                                            <ul className='list-disc list-inside space-y-1 text-sm'>
                                                {result.disease_info.reference_links.map(
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
                                                {String(result.disease_info.reference_links)}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    <Button onClick={onReset} className='w-full' variant='outline'>
                        <RotateCcw className='h-4 w-4 mr-2' />
                        重新檢測
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default LeafDetectionView;
