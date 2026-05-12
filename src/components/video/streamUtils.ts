/**
 * Utility functions for stream URL detection and error messaging.
 */

/** Returns true if the URL points to an HLS manifest (.m3u8). */
export function isHlsUrl(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith(".m3u8") || lower.includes(".m3u8?");
}

/** Returns true if the URL belongs to a known embeddable video platform. */
export function isKnownVideoPlatform(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
        lower.includes("youtube.com") ||
        lower.includes("youtu.be") ||
        lower.includes("youtube-nocookie.com") ||
        lower.includes("twitch.tv") ||
        lower.includes("vimeo.com") ||
        lower.includes("player.") ||
        lower.includes("/player/") ||
        lower.includes("webcamera.pl") ||
        lower.includes("ivideon.com") ||
        lower.includes("rtsp.me") ||
        lower.includes("bnu.tv") ||
        lower.includes(".html")
    );
}

/** Convert a YouTube watch / short URL into an embeddable URL with autoplay. */
export function getYouTubeEmbedUrl(url: string): string {
    if (!url) return url;
    if (
        !url.includes("youtube.com") &&
        !url.includes("youtube-nocookie.com") &&
        !url.includes("youtu.be")
    ) {
        return url;
    }

    try {
        const u = new URL(
            url.includes("youtu.be")
                ? url.replace("youtu.be/", "youtube.com/embed/")
                : url,
        );

        if (u.pathname.startsWith("/watch")) {
            const videoId = u.searchParams.get("v");
            u.pathname = `/embed/${videoId}`;
            u.search = "";
        }

        if (!u.searchParams.has("autoplay")) u.searchParams.set("autoplay", "1");
        u.searchParams.set("enablejsapi", "1");

        return u.toString();
    } catch {
        return url;
    }
}

/**
 * Proxy stream URLs through our server-side proxy to avoid mixed-content blocks
 * and bypass restrictive CORS policies from camera providers.
 */
export function getProxiedStreamUrl(url: string): string {
    if (!url) return url;
    
    // Always proxy to bypass CORS restrictions from camera providers!
    return `/api/camera/proxy/stream?url=${encodeURIComponent(url)}`;
}

/**
 * Proxy iframe HTML to inject <base> tags and strip X-Frame-Options / CSP headers
 * that prevent embedding.
 */
export function getProxiedIframeUrl(url: string): string {
    if (!url) return url;
    return `/api/camera/proxy/iframe?url=${encodeURIComponent(url)}`;
}

/** Return a user-friendly error message for a failed stream URL. */
export function getStreamErrorMessage(streamUrl: string): string {
    if (
        streamUrl.startsWith("http://") &&
        typeof window !== "undefined" &&
        window.location.protocol === "https:"
    ) {
        return "Mixed Content Error: Connection blocked because the stream uses insecure HTTP on a secure HTTPS site.";
    }
    if (isHlsUrl(streamUrl)) {
        return "Unsupported Format: HLS streams (.m3u8) require a dedicated player and cannot be displayed directly as an image.";
    }
    return "Stream Failed: The stream might be offline, unreachable due to CORS restrictions, or restricted by the provider.";
}
