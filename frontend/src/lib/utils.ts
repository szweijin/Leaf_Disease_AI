import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 驗證密碼複雜度（與後端規則一致）
 *
 * 要求：
 * - 至少 8 個字符
 * - 至少 1 個大寫字母 (A-Z)
 * - 至少 1 個小寫字母 (a-z)
 * - 至少 1 個數字 (0-9)
 *
 * @param password 要驗證的密碼
 * @returns {isValid: boolean, message: string} 驗證結果和錯誤訊息
 */
export function validatePassword(password: string): { isValid: boolean; message: string } {
    if (password.length < 8) {
        return { isValid: false, message: "密碼長度需至少 8 碼" };
    }
    if (!/[A-Z]/.test(password)) {
        return { isValid: false, message: "密碼需包含至少一個大寫字母 (A-Z)" };
    }
    if (!/[a-z]/.test(password)) {
        return { isValid: false, message: "密碼需包含至少一個小寫字母 (a-z)" };
    }
    if (!/[0-9]/.test(password)) {
        return { isValid: false, message: "密碼需包含至少一個數字 (0-9)" };
    }
    return { isValid: true, message: "密碼符合要求" };
}

/**
 * 獲取密碼要求說明文字
 */
export function getPasswordRequirements(): string[] {
    return ["至少 8 個字符", "至少 1 個大寫字母 (A-Z)", "至少 1 個小寫字母 (a-z)", "至少 1 個數字 (0-9)"];
}
