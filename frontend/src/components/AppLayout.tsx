// frontend/src/components/AppLayout.tsx
import { Outlet, useLocation } from "react-router-dom";
import { Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResponsiveNavbar from "./ResponsiveNavbar";
import Loading from "./Loading";

interface AppLayoutProps {
    userEmail?: string;
    onLogout?: () => void;
}

const PageLoadingFallback = () => <Loading message='載入頁面中...' />;

const AppLayout = ({ userEmail, onLogout }: AppLayoutProps) => {
    const location = useLocation();

    return (
        <div className='min-h-screen flex flex-col'>
            <ResponsiveNavbar userEmail={userEmail} onLogout={onLogout} />
            <main className='flex-1 pb-16 md:pb-0'>
                <Suspense fallback={<PageLoadingFallback />}>
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </Suspense>
            </main>
        </div>
    );
};

export default AppLayout;
