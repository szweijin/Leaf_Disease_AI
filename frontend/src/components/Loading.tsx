import { motion } from "framer-motion";

interface LoadingProps {
    message?: string;
    username?: string;
    showWelcome?: boolean;
}

function Loading({ message = "載入中...", username, showWelcome = false }: LoadingProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className='min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50 p-4'
        >
            {/* Logo 圖片 - 置中顯示 */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className='mb-8 flex justify-center'
            >
                <motion.img
                    src='/LOGO_V.png'
                    alt='Leaf Disease AI'
                    className='h-32 w-auto object-contain md:h-40'
                    animate={{
                        scale: [1, 1.05, 1],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.div>

            {/* Loading 動畫和文字 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className='flex flex-col items-center gap-4'
            >
                {/* 歡迎訊息 */}
                {showWelcome && username && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className='text-center space-y-2'
                    >
                        <motion.h2
                            className='text-2xl md:text-3xl font-bold text-emerald-700'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.7 }}
                        >
                            歡迎回來！
                        </motion.h2>
                        <motion.p
                            className='text-lg md:text-xl text-neutral-700 font-medium'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.9 }}
                        >
                            {username}
                        </motion.p>
                    </motion.div>
                )}

                <motion.div
                    className='w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full'
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                />

                {/* 載入訊息文字 */}
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: showWelcome && username ? 1.1 : 0.6 }}
                    className='text-sm text-neutral-600 font-medium'
                >
                    {message}
                </motion.span>
            </motion.div>
        </motion.div>
    );
}

export default Loading;
