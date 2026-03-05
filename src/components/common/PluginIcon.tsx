"use client";

import type { ComponentType } from "react";
import { MapPin } from "lucide-react";

interface PluginIconProps {
    icon: string | ComponentType<{ size?: number; color?: string }>;
    size?: number;
    color?: string;
}

/**
 * Renders a plugin icon consistently across the app.
 * Handles both string emoji icons and React component icons (e.g. lucide-react).
 */
export function PluginIcon({ icon, size = 18, color }: PluginIconProps) {
    if (typeof icon === "string") {
        return <span>{icon}</span>;
    }

    const IconComponent = icon;
    if (IconComponent) {
        return <IconComponent size={size} color={color} />;
    }

    return <MapPin size={size} />;
}
