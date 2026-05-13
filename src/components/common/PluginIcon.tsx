/**
 * @file PluginIcon.tsx
 * @description Central icon resolver for plugins. Supports Lucide string names, 
 * emoji fallbacks, and custom React component icons.
 */

"use client";

import type { ComponentType } from "react";
import { icons, type LucideIcon } from "lucide-react";

const FallbackIcon = icons.Package;

/**
 * Props for the PluginIcon component.
 */
interface PluginIconProps {
    /** 
     * The icon to render. Can be a Lucide icon name (e.g., "Airplay"), 
     * a raw emoji string, or a React component.
     */
    icon: string | ComponentType<{ size?: number; color?: string }>;
    /** The size in pixels for the icon. Defaults to 18. */
    size?: number;
    /** The CSS color for the icon stroke/fill. */
    color?: string;
}

/**
 * Renders a consistent icon representation for plugins.
 * Dynamically resolves Lucide icons by name to allow plugins to declare 
 * icons in their manifests without bundling dependencies.
 * 
 * @param props - Component properties.
 * @returns React component for the plugin icon.
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

    return <FallbackIcon size={size} />;
}
