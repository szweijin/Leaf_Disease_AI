import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合併 Tailwind CSS 類名的工具函數
 * 用於 shadcn/ui 組件
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
