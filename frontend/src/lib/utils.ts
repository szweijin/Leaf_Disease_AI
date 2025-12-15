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

/**
 * 解析 Unicode 轉義序列為中文字符
 * 如果字符串包含 Unicode 轉義序列（如 \u99ac），將其轉換為對應的中文字符
 * @param str - 可能包含 Unicode 轉義序列的字符串
 * @returns 解析後的中文字符串
 */
export function parseUnicode(str: any): string {
    if (typeof str !== "string") {
        return String(str);
    }

    // 如果字符串包含 Unicode 轉義序列，進行解析
    try {
        // 檢查是否包含 Unicode 轉義序列（格式：\uXXXX）
        if (/\\u[0-9a-fA-F]{4}/.test(str)) {
            // 方法1：使用 JSON.parse（最可靠）
            try {
                return JSON.parse(`"${str.replace(/"/g, '\\"')}"`);
            } catch (e1) {
                // 方法2：手動替換 Unicode 轉義序列
                return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
                    return String.fromCharCode(parseInt(code, 16));
                });
            }
        }
    } catch (e) {
        // 如果解析失敗，返回原字符串
        console.warn("Unicode 解析失敗:", e);
    }

    return str;
}

/**
 * 遞歸解析對象中的所有字符串，將 Unicode 轉義序列轉換為中文字符
 * @param obj - 要解析的對象
 * @returns 解析後的對象
 */
export function parseUnicodeInObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === "string") {
        return parseUnicode(obj) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => parseUnicodeInObject(item)) as T;
    }

    if (typeof obj === "object") {
        const parsed: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                parsed[key] = parseUnicodeInObject(obj[key]);
            }
        }
        return parsed as T;
    }

    return obj;
}
