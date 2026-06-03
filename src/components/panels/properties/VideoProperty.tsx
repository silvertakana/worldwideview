import { PlayCircle } from "lucide-react";
import { IntelPropertyRow } from "./IntelPropertyRow";

interface VideoPropertyProps {
    label: string;
    href: string;
    classNamePrefix?: string;
}

export function VideoProperty({ label, href, classNamePrefix = "intel-panel" }: VideoPropertyProps) {
    return (
        <IntelPropertyRow label={label} classNamePrefix={classNamePrefix}>
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent-cyan)" }}
            >
                <PlayCircle size={14} />
                Watch
            </a>
        </IntelPropertyRow>
    );
}
