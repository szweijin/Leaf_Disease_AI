// frontend/src/pages/HomePage.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import Loading from "@/components/Loading";

interface HomePageProps {
    isAuthenticated?: boolean;
}

const HomePage = ({ isAuthenticated }: HomePageProps) => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    useEffect(() => {
        // 如果已登入，重定向到 /predict
        if (isAuthenticated) {
            // 稍微延遲一下，讓用戶看到 Loading
            const timer = setTimeout(() => {
                navigate("/predict", { replace: true });
            }, 1500);
            return () => clearTimeout(timer);
        }

        // 如果是手機版，重定向到 /login（因為手機版沒有 /home 頁面）
        if (isMobile) {
            // 稍微延遲一下，讓用戶看到 Loading
            const timer = setTimeout(() => {
                navigate("/login", { replace: true });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, isMobile, navigate]);

    // 如果正在重定向、已登入或手機版，顯示 Loading
    if (isAuthenticated || isMobile) {
        return <Loading message='跳轉中...' />;
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
                delayChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                ease: [0.4, 0, 0.2, 1] as const,
            },
        },
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className='min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-emerald-50'
        >
            <motion.div
                variants={containerVariants}
                initial='hidden'
                animate='visible'
                className='max-w-2xl w-full text-center space-y-8'
            >
                {/* 歡迎圖片 */}
                <motion.div variants={itemVariants} className='flex justify-center'>
                    <motion.img
                        src='/LOGO_V.png'
                        alt='Leaf Disease AI'
                        className='h-64 w-auto object-contain'
                        animate={{
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    />
                </motion.div>

                {/* 歡迎文字 */}
                <motion.div variants={itemVariants} className='space-y-4'>
                    <h1 className='text-5xl font-extrabold tracking-tight text-emerald-700'>
                        歡迎使用葉片病害 AI 診斷系統
                    </h1>
                    <p className='text-xl text-neutral-600'>使用先進的 AI 技術，快速準確地診斷植物葉片病害</p>
                </motion.div>

                {/* Get Started 按鈕 */}
                <motion.div variants={itemVariants} className='pt-4'>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button size='lg' onClick={() => navigate("/login")} className='px-8 py-6 text-lg'>
                            Get Started
                        </Button>
                    </motion.div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
};

export default HomePage;
