import { useState, useRef, useEffect } from "react";

export function useResizablePanel(initialWidth: number, minWidth: number, maxWidth: number, direction: 'left' | 'right') {
    const [width, setWidth] = useState(initialWidth);
    const isResizing = useRef(false);

    useEffect(() => {
        document.documentElement.style.setProperty(`--${direction}-sidebar-width`, `${initialWidth}px`);
    }, [initialWidth, direction]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            
            let newWidth = direction === 'left' ? e.clientX : window.innerWidth - e.clientX;
            
            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > maxWidth) newWidth = maxWidth;
            
            setWidth(newWidth);
            document.documentElement.style.setProperty(`--${direction}-sidebar-width`, `${newWidth}px`);
        };

        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
                document.body.classList.remove('is-resizing-sidebar');
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [direction, minWidth, maxWidth]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('is-resizing-sidebar');
    };

    return { width, startResizing };
}
