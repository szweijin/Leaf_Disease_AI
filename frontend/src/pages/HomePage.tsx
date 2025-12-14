// frontend/src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const HomePage = () => {
    return (
        <div className='space-y-6'>
            <div>
                <h1 className='text-4xl font-extrabold tracking-tight lg:text-5xl text-emerald-700 mb-2'>歡迎回來！</h1>
                <p className='text-lg text-neutral-600'>使用 AI 技術快速診斷葉片病害</p>
            </div>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
                <Card className='border-emerald-200 hover:border-emerald-300 transition-colors'>
                    <CardHeader>
                        <CardTitle className='text-emerald-700'>快速診斷</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <p className='text-neutral-600'>點擊下方按鈕或上方導航列的 "AI 診斷" 上傳圖片開始分析。</p>
                        <Button asChild>
                            <Link to='/predict'>
                                開始診斷
                                <ArrowRight className='ml-2 h-4 w-4' />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className='border-neutral-200'>
                    <CardHeader>
                        <CardTitle>歷史紀錄</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <p className='text-neutral-600'>查看過往的檢測記錄和分析結果。</p>
                        <Button asChild variant='outline'>
                            <Link to='/history'>
                                查看紀錄
                                <ArrowRight className='ml-2 h-4 w-4' />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className='border-neutral-200'>
                    <CardHeader>
                        <CardTitle>我的帳號</CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <p className='text-neutral-600'>管理您的帳號設定和個人資訊。</p>
                        <Button asChild variant='outline'>
                            <Link to='/account'>
                                帳號設定
                                <ArrowRight className='ml-2 h-4 w-4' />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default HomePage;
