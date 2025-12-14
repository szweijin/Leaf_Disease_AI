import { Link, useNavigate } from "react-router-dom";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { User, Settings, LogOut, X } from "lucide-react";

interface AccountSidebarProps {
    userEmail?: string;
    onLogout?: () => void;
    onClose: () => void;
}

function AccountSidebar({ userEmail, onLogout, onClose }: AccountSidebarProps) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await apiFetch("/logout", {
                method: "POST",
            });
            if (onLogout) {
                onLogout();
            }
            navigate("/login");
            onClose();
        } catch (err) {
            console.error("登出失敗:", err);
        }
    };

    return (
        <Sidebar side='right' variant='floating' collapsible='offcanvas' className='hidden md:block'>
            <SidebarHeader className='p-4'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                        <User className='w-5 h-5 text-emerald-600' />
                        <div>
                            <p className='text-sm font-semibold text-sidebar-foreground'>帳號資訊</p>
                            {userEmail && <p className='text-xs text-sidebar-foreground/70'>{userEmail}</p>}
                        </div>
                    </div>
                    <Button variant='ghost' size='icon' onClick={onClose} className='h-8 w-8'>
                        <X className='h-4 w-4' />
                        <span className='sr-only'>關閉</span>
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarSeparator />
            <SidebarContent className='p-4'>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link to='/account' onClick={onClose}>
                                <Settings className='w-4 h-4' />
                                <span>帳號設定</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter className='p-4'>
                <Button variant='destructive' onClick={handleLogout} className='w-full'>
                    <LogOut className='mr-2 h-4 w-4' />
                    登出
                </Button>
            </SidebarFooter>
        </Sidebar>
    );
}

export default AccountSidebar;
