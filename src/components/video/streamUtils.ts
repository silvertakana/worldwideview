/**
 * @file streamUtils.ts
 * @description specialized utilities for detecting, transforming, and
 * proxying video streams to ensure cross-origin compatibility and
 * playback stability.
 * @module src/components/video
 */

/**
 * Strips internal tagged-dispatch type-prefix markers (e.g. "video:", "image:", "url:")
 * that may still be present on raw props before reaching URL-consuming helpers.
 * @param {string} url - The raw or prefixed URL.
 */
export function cleanStreamUrl(url: string): string {
    if (!url) return url;
    return url.replace(/^(video|image|url):/, "").trim();
}

/**
 * Returns true if the URL points to an HLS manifest (.m3u8).
 * @param {string} url - The URL to check.
 */
export function isHlsUrl(url: string): boolean {
    if (!url) return false;
    const cleaned = cleanStreamUrl(url);
    const lower = cleaned.toLowerCase();
    return lower.endsWith(".m3u8") || lower.includes(".m3u8?");
}

/**
 * Returns true if the URL belongs to a known embeddable video platform.
 * @param {string} url - The URL to check.
 */
export function isKnownVideoPlatform(url: string): boolean {
    if (!url) return false;
    const cleaned = cleanStreamUrl(url);

    const isKnownHost = (host: string): boolean => {
        const knownHosts = [
            "youtube.com",
            "youtu.be",
            "youtube-nocookie.com",
            "twitch.tv",
            "vimeo.com",
            "webcamera.pl",
            "ivideon.com",
            "rtsp.me",
            "bnu.tv",
        ];
        return knownHosts.some((domain) => host === domain || host.endsWith(`.${domain}`));
    };

    try {
        const parsed = new URL(cleaned);
        const host = parsed.hostname.toLowerCase();
        const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();

        return (
            isKnownHost(host)
            || host.includes("player.")
            || pathAndQuery.includes("/player/")
            || pathAndQuery.includes(".html")
        );
    } catch {
        const lower = cleaned.toLowerCase();
        return lower.includes("/player/") || lower.includes(".html");
    }
}

/**
 * Convert a YouTube watch / short URL into an embeddable URL with autoplay.
 * @param {string} url - The raw YouTube URL.
 */
export function getYouTubeEmbedUrl(url: string): string {
    if (!url) return url;
    const cleaned = cleanStreamUrl(url);

    try {
        const parsed = new URL(cleaned);
        const hostname = parsed.hostname.toLowerCase();
        const allowedHosts = new Set([
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "youtube-nocookie.com",
            "www.youtube-nocookie.com",
            "youtu.be",
        ]);

        if (!allowedHosts.has(hostname)) return cleaned;

        const u = new URL(
            hostname === "youtu.be"
                ? cleaned.replace("youtu.be/", "youtube.com/embed/")
                : cleaned,
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
        return cleaned;
    }
}

/**
 * Proxy stream URLs through our server-side proxy to avoid mixed-content blocks
 * and bypass restrictive CORS policies from camera providers.
 * Strips internal type-prefix markers (video:/image:) before encoding.
 * @param {string} url - The raw stream URL.
 */
export function getProxiedStreamUrl(url: string): string {
    if (!url) return url;
    const cleaned = cleanStreamUrl(url);
    // Always proxy to bypass CORS restrictions from camera providers!
    return `/api/camera/proxy/stream?url=${encodeURIComponent(cleaned)}`;
}

/**
 * Proxy iframe HTML to inject <base> tags and strip X-Frame-Options / CSP headers
 * that prevent embedding.
 * @param {string} url - The iframe source URL.
 */
export function getProxiedIframeUrl(url: string): string {
    if (!url) return url;
    const cleaned = cleanStreamUrl(url);
    return `/api/camera/proxy/iframe?url=${encodeURIComponent(cleaned)}`;
}

/**
 * Return a user-friendly error message for a failed stream URL.
 * @param {string} streamUrl - The URL that failed.
 */
export function getStreamErrorMessage(streamUrl: string): string {
    const cleaned = cleanStreamUrl(streamUrl);
    if (
        cleaned.startsWith("http://")
        && typeof window !== "undefined"
        && window.location.protocol === "https:"
    ) {
        return "Mixed Content Error: Connection blocked because the stream uses insecure HTTP on a secure HTTPS site.";
    }
    if (isHlsUrl(cleaned)) {
        return "Unsupported Format: HLS streams (.m3u8) require a dedicated player and cannot be displayed directly as an image.";
    }
    return "Stream Failed: The stream might be offline, unreachable due to CORS restrictions, or restricted by the provider.";
}