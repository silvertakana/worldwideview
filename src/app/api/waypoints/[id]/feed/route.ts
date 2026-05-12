import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";

/**
 * GET /api/waypoints/[id]/feed
 *
 * Public RSS 2.0 feed for a waypoint's blog posts.
 * Authentication not required — waypoints are public by design.
 * The feed includes the 20 most recent posts.
 */

type Params = { params: Promise<{ id: string }> };

function escape(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;

    const waypoint = await db.waypoint.findUnique({
        where: { id },
        include: {
            posts: {
                orderBy: { publishedAt: "desc" },
                take: 20,
            },
        },
    });

    if (!waypoint) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const base = req.nextUrl.origin;
    const feedUrl = `${base}/api/waypoints/${id}/feed`;
    const waypointUrl = `${base}/waypoints/${id}`;

    const items = waypoint.posts
        .map(
            (p: { id: string; title: string; publishedAt: Date; content: string }) => `
    <item>
      <title>${escape(p.title)}</title>
      <link>${escape(`${waypointUrl}/posts/${p.id}`)}</link>
      <guid isPermaLink="true">${escape(`${waypointUrl}/posts/${p.id}`)}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <description><![CDATA[${p.content}]]></description>
    </item>`,
        )
        .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(waypoint.title)}</title>
    <link>${escape(waypointUrl)}</link>
    <description>${escape(waypoint.description || waypoint.title)}</description>
    <language>en-us</language>
    <atom:link href="${escape(feedUrl)}" rel="self" type="application/rss+xml"/>
    <generator>WorldWideView Waypoints</generator>
    ${items}
  </channel>
</rss>`;

    return new NextResponse(rss, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
        },
    });
}
