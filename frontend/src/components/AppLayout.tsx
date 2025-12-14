// frontend/src/components/AppLayout.tsx
import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import ResponsiveNavbar from "./ResponsiveNavbar";
import Loading from "./Loading";

interface AppLayoutProps {
    userEmail?: string;
    onLogout?: () => void;
}

const PageLoadingFallback = () => <Loading message='載入頁面中...' />;

const AppLayout = ({ userEmail, onLogout }: AppLayoutProps) => {
    return (
        <div className='min-h-screen flex flex-col'>
            <ResponsiveNavbar userEmail={userEmail} onLogout={onLogout} />
            <main className='flex-1 pb-16 md:pb-0'>
                <Suspense fallback={<PageLoadingFallback />}>
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
};

export default AppLayout;
