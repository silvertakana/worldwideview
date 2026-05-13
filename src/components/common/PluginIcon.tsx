"use client";

import type { ComponentType } from "react";
import { icons, type LucideIcon } from "lucide-react";

const FallbackIcon = icons.Package;

interface PluginIconProps {
    icon: string | ComponentType<{ size?: number; color?: string }>;
    size?: number;
    color?: string;
}

/**
 * Renders a plugin icon consistently across the app.
 * Resolves any valid lucide-react icon name string dynamically,
 * so new plugins can use any icon without updating this component.
 * Also supports emoji strings and React component icons.
 */
export function PluginIcon({ icon, size = 18, color }: PluginIconProps) {
    if (typeof icon === "string") {
        const Resolved = icons[icon as keyof typeof icons] as LucideIcon | undefined;
        if (Resolved) return <Resolved size={size} color={color} />;
        // Treat as emoji or text fallback
        return <span>{icon}</span>;
    }

    const IconComponent = icon;
    if (IconComponent) {
        return <IconComponent size={size} color={color} />;
    }

    // return <FallbackIcon size={size} />;
    return null;
}
