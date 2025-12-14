// frontend/src/pages/HomePage.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const HomePage = () => {
    return (
        <div className='space-y-6'>
            <h1 className='text-4xl font-extrabold tracking-tight lg:text-5xl'>歡迎回來！</h1>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                <Card>
                    <CardHeader>
                        <CardTitle>快速診斷</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>點擊上方 "AI 診斷" 上傳圖片開始分析。</p>
                    </CardContent>
                </Card>
                {/* 更多儀表板內容 */}
            </div>
        </div>
    );
};

export default HomePage;
