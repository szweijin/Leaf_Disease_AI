import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";

interface PrintButtonProps {
    contentRef: React.RefObject<HTMLElement | null>;
    filename?: string;
    className?: string;
    variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
    children?: React.ReactNode;
}

function PrintButton({ contentRef, filename, className, variant = "outline", children }: PrintButtonProps) {
    const handlePrint = useReactToPrint({
        contentRef: contentRef,
        documentTitle: filename || "檢測結果",
        onBeforePrint: async () => {
            if (!contentRef.current) {
                toast.error("無法找到要打印的內容", { id: "print-loading" });
                return;
            }
            toast.loading("正在準備打印...", { id: "print-loading" });

            // 等待所有圖片載入完成
            const images = contentRef.current.querySelectorAll("img");
            const imagePromises = Array.from(images).map((img) => {
                if (img.complete) {
                    return Promise.resolve();
                }
                return new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // 即使載入失敗也繼續
                    // 設置超時，避免無限等待
                    setTimeout(() => resolve(), 5000);
                });
            });

            await Promise.all(imagePromises);
        },
        onAfterPrint: () => {
            toast.success("打印完成", { id: "print-loading" });
        },
        onPrintError: (errorLocation, error) => {
            console.error("打印錯誤:", errorLocation, error);
            toast.error(`打印失敗: ${error?.message || "未知錯誤"}`, { id: "print-loading" });
        },
        pageStyle: `
            @page {
                margin: 15mm;
                size: A4;
                font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif;
            }
            @media print {
                * {
                    background: transparent !important;
                    background-color: transparent !important;
                    box-shadow: none !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                    text-rendering: optimizeLegibility !important;
                    -webkit-font-smoothing: antialiased !important;
                    -moz-osx-font-smoothing: grayscale !important;
                }
                body {
                    background: white !important;
                    color: black !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                    text-rendering: optimizeLegibility !important;
                    -webkit-font-smoothing: antialiased !important;
                    -moz-osx-font-smoothing: grayscale !important;
                }
                .fixed,
                .sticky {
                    display: none !important;
                }
                /* 確保所有文字可見 */
                p, span, div, h1, h2, h3, h4, h5, h6, li, a, td, th {
                    color: black !important;
                    background: transparent !important;
                    background-color: transparent !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                    text-rendering: optimizeLegibility !important;
                    -webkit-font-smoothing: antialiased !important;
                    -moz-osx-font-smoothing: grayscale !important;
                }
                /* 標題文字 */
                .text-emerald-700,
                .text-emerald-600 {
                    color: black !important;
                }
                .text-muted-foreground {
                    color: #333 !important;
                }
                .text-neutral-700,
                .text-neutral-500 {
                    color: black !important;
                }
                /* 移除所有背景色 */
                .bg-neutral-50,
                .bg-neutral-100,
                .bg-neutral-200,
                .bg-neutral-900,
                .bg-emerald-500,
                .bg-emerald-600,
                .bg-emerald-700,
                .bg-yellow-500,
                .bg-red-500 {
                    background: transparent !important;
                    background-color: transparent !important;
                }
                /* 確保卡片邊框可見 */
                [class*="border"] {
                    border-color: #000 !important;
                }
                /* 圖片樣式 */
                img {
                    max-width: 60% !important;
                    width: 60% !important;
                    height: auto !important;
                    page-break-inside: avoid !important;
                    display: block !important;
                    background: transparent !important;
                    margin: 0 auto !important;
                }
                /* 連結樣式 */
                a {
                    color: black !important;
                    text-decoration: underline !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                }
                /* 列表樣式 */
                ul, ol {
                    color: black !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                }
                li {
                    color: black !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                }
                /* 確保內容不被裁剪 */
                .rounded-lg,
                .rounded {
                    border-radius: 0.5rem !important;
                }
                .overflow-hidden {
                    overflow: visible !important;
                }
                /* 間距 */
                .space-y-6 > * + * {
                    margin-top: 1.5rem !important;
                }
                .space-y-4 > * + * {
                    margin-top: 1rem !important;
                }
                .space-y-2 > * + * {
                    margin-top: 0.5rem !important;
                }
                .space-y-1 > * + * {
                    margin-top: 0.25rem !important;
                }
                /* 布局 */
                .grid {
                    display: grid !important;
                }
                .gap-4 {
                    gap: 1rem !important;
                }
                .gap-3 {
                    gap: 0.75rem !important;
                }
                .p-4 {
                    padding: 1rem !important;
                }
                .pb-24 {
                    padding-bottom: 0 !important;
                }
                .max-w-4xl {
                    max-width: 100% !important;
                }
                .container {
                    width: 100% !important;
                    max-width: 100% !important;
                }
                /* 確保所有文字元素都顯示 */
                [class*="text-"] {
                    color: black !important;
                }
                /* 卡片內容 */
                [class*="Card"] {
                    background: transparent !important;
                    border: 1px solid #000 !important;
                }
                /* 標題和描述 */
                [class*="CardTitle"],
                [class*="CardDescription"] {
                    color: black !important;
                    background: transparent !important;
                }
                h1, h2, h3, h4, h5, h6 {
                    color: black !important;
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                }
                /* 確保所有文字元素都使用中文字體 */
                [class*="CardTitle"],
                [class*="CardDescription"],
                [class*="text-"] {
                    font-family: "PingFang SC", "Microsoft YaHei", "微软雅黑", "SimSun", "宋体", "SimHei", "黑体", "Source Han Sans SC", "Noto Sans CJK SC", "WenQuanYi Micro Hei", "Hiragino Sans GB", "STHeiti", "Arial Unicode MS", sans-serif !important;
                }
            }
        `,
    });

    const handleClick = () => {
        if (!contentRef.current) {
            toast.error("無法找到要打印的內容，請確保內容已完全載入");
            return;
        }
        handlePrint();
    };

    return (
        <Button onClick={handleClick} className={className} variant={variant}>
            {children || (
                <>
                    <Printer className='h-4 w-4 mr-2' />
                    列印 PDF
                </>
            )}
        </Button>
    );
}

export default PrintButton;
