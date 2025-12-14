import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";

interface LeafDetectionViewProps {
    result: {
        disease?: string;
        severity?: string;
        confidence?: number;
        image_path?: string;
        disease_info?: {
            description?: string;
            treatment?: string;
        };
    };
    onReset: () => void;
}

function LeafDetectionView({ result, onReset }: LeafDetectionViewProps) {
    if (!result) return null;

    const severityColors: Record<string, string> = {
        Mild: "bg-emerald-500",
        Moderate: "bg-yellow-500",
        Severe: "bg-red-500",
    };

    return (
        <div className='container mx-auto p-4 max-w-4xl'>
            <Card>
                <CardHeader>
                    <CardTitle>檢測結果</CardTitle>
                    <CardDescription>AI 檢測完成</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                    {result.image_path && (
                        <div className='rounded-lg overflow-hidden border border-neutral-200'>
                            <img src={result.image_path} alt='檢測圖片' className='w-full h-auto' />
                        </div>
                    )}

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <Card>
                            <CardHeader>
                                <CardTitle className='text-lg'>病害類型</CardTitle>
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
                                <CardTitle className='text-lg'>嚴重程度</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Badge
                                    className={`${
                                        severityColors[result.severity || ""] || "bg-neutral-500"
                                    } text-white`}
                                >
                                    {result.severity || "N/A"}
                                </Badge>
                                <div className='mt-2'>
                                    <p className='text-sm text-muted-foreground'>
                                        置信度: {result.confidence ? (result.confidence * 100).toFixed(1) : "N/A"}%
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {result.disease_info?.treatment && (
                        <Card>
                            <CardHeader>
                                <CardTitle className='text-lg'>處理建議</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-sm whitespace-pre-line'>{result.disease_info.treatment}</p>
                            </CardContent>
                        </Card>
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
