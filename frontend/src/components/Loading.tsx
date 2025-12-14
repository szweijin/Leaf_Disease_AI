interface LoadingProps {
    message?: string;
}

function Loading({ message = "載入中..." }: LoadingProps) {
    return (
        <div className='min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50 p-4'>
            {/* Logo 圖片 - 置中顯示 */}
            <div className='mb-8 flex justify-center'>
                <img
                    src='/LOGO_V.png'
                    alt='Leaf Disease AI'
                    className='h-32 w-auto object-contain md:h-40 animate-pulse'
                />
            </div>

            {/* Loading 動畫和文字 */}
            <div className='flex flex-col items-center gap-4'>
                <div className='w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin' />

                {/* 載入訊息文字 */}
                <span className='text-sm text-neutral-600 font-medium'>{message}</span>
            </div>
        </div>
    );
}

export default Loading;
