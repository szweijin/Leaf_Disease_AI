import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    {
        variants: {
            variant: {
                default: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/50",
                destructive:
                    "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
                outline:
                    "border border-emerald-600/20 bg-background shadow-xs hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-600/40 text-emerald-700 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
                secondary: "bg-neutral-100 text-neutral-800 hover:bg-neutral-200",
                ghost: "hover:bg-emerald-50 hover:text-emerald-700 text-neutral-700 dark:hover:bg-emerald-50/50",
                link: "text-emerald-600 underline-offset-4 hover:text-emerald-700 hover:underline",
            },
            size: {
                default: "h-9 px-4 py-2 has-[>svg]:px-3",
                sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
                lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
                icon: "size-9",
                "icon-sm": "size-8",
                "icon-lg": "size-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    tooltip?: string;
}

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    tooltip,
    children,
    ...props
}: ButtonProps) {
    const Comp = asChild ? Slot : "button";

    const button = (
        <Comp
            data-slot='button'
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        >
            {children}
        </Comp>
    );

    if (tooltip) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return button;
}

export { Button, buttonVariants };
