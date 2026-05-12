"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Plus, Rss, Trash2, BookOpen } from "lucide-react";
import type { GeoEntity } from "@/core/plugins/PluginTypes";

interface Post {
    id: string;
    title: string;
    content: string;
    publishedAt: string;
}

interface Props {
    entity: GeoEntity;
}

export function WaypointDetail({ entity }: Props) {
    const waypointId = entity.properties.waypointId as string;
    const feedUrl = entity.properties.feedUrl as string;
    const color = (entity.properties.color as string | undefined) ?? "#38bdf8";

    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [composing, setComposing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const loadPosts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/waypoints/${waypointId}/posts`);
            if (res.ok) setPosts((await res.json()).posts ?? []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadPosts(); }, [waypointId]);

    const savePost = async () => {
        if (!newTitle.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/waypoints/${waypointId}/posts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle.trim(), content: newContent }),
            });
            if (res.ok) {
                setNewTitle("");
                setNewContent("");
                setComposing(false);
                await loadPosts();
            }
        } finally {
            setSaving(false);
        }
    };

    const deletePost = async (postId: string) => {
        await fetch(`/api/waypoints/${waypointId}/posts/${postId}`, { method: "DELETE" });
        setPosts((prev) => prev.filter((p) => p.id !== postId));
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                <a
                    href={feedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
                    }}
                    title="RSS Feed"
                >
                    <Rss size={12} />
                    <span style={{ fontFamily: "var(--font-mono)" }}>RSS Feed</span>
                    <ExternalLink size={10} />
                </a>
                <button
                    onClick={() => setComposing(!composing)}
                    style={{
                        marginLeft: "auto",
                        display: "flex", alignItems: "center", gap: 4,
                        fontSize: 11, padding: "3px 8px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid",
                        borderColor: composing ? color : "rgba(255,255,255,0.15)",
                        background: composing ? `${color}18` : "transparent",
                        color: composing ? color : "var(--text-secondary)",
                        cursor: "pointer",
                    }}
                >
                    <Plus size={12} />
                    New Post
                </button>
            </div>

            {composing && (
                <div style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-md)",
                    display: "flex", flexDirection: "column", gap: "var(--space-sm)",
                }}>
                    <input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Post title…"
                        style={{
                            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: "var(--radius-sm)", padding: "6px 10px",
                            color: "var(--text-primary)", fontSize: 13, width: "100%", boxSizing: "border-box",
                        }}
                    />
                    <textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="Write your post… (Markdown supported)"
                        rows={5}
                        style={{
                            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: "var(--radius-sm)", padding: "6px 10px",
                            color: "var(--text-primary)", fontSize: 12, width: "100%",
                            boxSizing: "border-box", resize: "vertical", fontFamily: "inherit",
                        }}
                    />
                    <div style={{ display: "flex", gap: "var(--space-sm)", justifyContent: "flex-end" }}>
                        <button
                            onClick={() => setComposing(false)}
                            style={{
                                fontSize: 12, padding: "4px 10px", borderRadius: "var(--radius-sm)",
                                border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                                color: "var(--text-muted)", cursor: "pointer",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={savePost}
                            disabled={saving || !newTitle.trim()}
                            style={{
                                fontSize: 12, padding: "4px 10px", borderRadius: "var(--radius-sm)",
                                border: "none", background: color,
                                color: "#000", cursor: saving ? "default" : "pointer",
                                opacity: saving || !newTitle.trim() ? 0.5 : 1,
                            }}
                        >
                            {saving ? "Saving…" : "Publish"}
                        </button>
                    </div>
                </div>
            )}

            {loading && (
                <div style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
                    Loading posts…
                </div>
            )}

            {!loading && posts.length === 0 && !composing && (
                <div style={{
                    color: "var(--text-muted)", fontSize: 12, textAlign: "center",
                    padding: "var(--space-lg)", fontStyle: "italic",
                }}>
                    No posts yet. Click "New Post" to start writing.
                </div>
            )}

            {posts.map((post) => (
                <div
                    key={post.id}
                    style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderLeft: `3px solid ${color}`,
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-sm) var(--space-md)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                        <button
                            onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                            style={{
                                flex: 1, background: "transparent", border: "none",
                                textAlign: "left", cursor: "pointer", padding: 0,
                                display: "flex", alignItems: "center", gap: "var(--space-sm)",
                            }}
                        >
                            <BookOpen size={12} style={{ color, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                                {post.title}
                            </span>
                        </button>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {new Date(post.publishedAt).toLocaleDateString()}
                        </span>
                        <button
                            onClick={() => deletePost(post.id)}
                            title="Delete post"
                            style={{
                                background: "transparent", border: "none",
                                color: "var(--text-muted)", cursor: "pointer",
                                padding: 4, display: "flex",
                            }}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    {expandedId === post.id && post.content && (
                        <div style={{
                            marginTop: "var(--space-sm)",
                            paddingTop: "var(--space-sm)",
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}>
                            {post.content}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
