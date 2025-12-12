/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    darkMode: "class", // 支援深色模式切換
    theme: {
        extend: {
            // 顏色系統 - 集中管理，方便後續修改
            colors: {
                // shadcn/ui CSS 變數顏色系統
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                // 保留原有的中性色
                // 中性色（用於文字、背景等）
                neutral: {
                    50: "#fafafa",
                    100: "#f5f5f5",
                    200: "#e5e5e5",
                    300: "#d4d4d4",
                    400: "#a3a3a3",
                    500: "#737373",
                    600: "#525252",
                    700: "#404040",
                    800: "#262626",
                    900: "#171717",
                    950: "#0a0a0a",
                },
                // 語義化顏色
                success: {
                    DEFAULT: "#198754",
                    light: "#20c997",
                    dark: "#156645",
                },
                error: {
                    DEFAULT: "#dc3545",
                    light: "#f8d7da",
                    dark: "#c82333",
                },
                warning: {
                    DEFAULT: "#ffc107",
                    light: "#fff3cd",
                    dark: "#e0a800",
                },
                info: {
                    DEFAULT: "#0dcaf0",
                    light: "#d1ecf1",
                    dark: "#0aa2c0",
                },
            },
            // 字體系統
            fontFamily: {
                sans: [
                    '"Segoe UI"',
                    "Tahoma",
                    "Geneva",
                    "Verdana",
                    "sans-serif",
                    "system-ui",
                    "-apple-system",
                    "BlinkMacSystemFont",
                ],
                mono: ["Menlo", "Monaco", "Consolas", '"Liberation Mono"', '"Courier New"', "monospace"],
            },
            // 字級系統
            fontSize: {
                xs: ["0.75rem", { lineHeight: "1rem" }],
                sm: ["0.875rem", { lineHeight: "1.25rem" }],
                base: ["1rem", { lineHeight: "1.5rem" }],
                lg: ["1.125rem", { lineHeight: "1.75rem" }],
                xl: ["1.25rem", { lineHeight: "1.75rem" }],
                "2xl": ["1.5rem", { lineHeight: "2rem" }],
                "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
                "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
                "5xl": ["3rem", { lineHeight: "1" }],
            },
            // 間距系統（基於 4px 的倍數）
            spacing: {
                18: "4.5rem",
                88: "22rem",
                128: "32rem",
            },
            // 圓角系統
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                "4xl": "2rem",
                "5xl": "2.5rem",
            },
            // 陰影系統
            boxShadow: {
                soft: "0 2px 8px rgba(0, 0, 0, 0.08)",
                medium: "0 4px 16px rgba(0, 0, 0, 0.12)",
                large: "0 8px 32px rgba(0, 0, 0, 0.16)",
                glow: "0 0 20px rgba(34, 197, 94, 0.3)",
            },
            // 漸變背景（已移除，改用灰階配色）
            // 容器設定
            container: {
                center: true,
                padding: {
                    DEFAULT: "1rem",
                    sm: "1.5rem",
                    lg: "2rem",
                    xl: "2.5rem",
                    "2xl": "3rem",
                },
                screens: {
                    sm: "640px",
                    md: "768px",
                    lg: "1024px",
                    xl: "1280px",
                    "2xl": "1400px",
                },
            },
        },
    },
    plugins: [],
};
