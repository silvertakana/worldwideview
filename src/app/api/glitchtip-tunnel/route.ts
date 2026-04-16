import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const serverUrl = process.env.GLITCHTIP_SERVER_URL;
  const projectId = process.env.GLITCHTIP_PROJECT_ID;
  const secretKey = process.env.GLITCHTIP_SECRET_KEY;

  if (!serverUrl || !projectId || !secretKey) {
    return NextResponse.json({ status: "error", message: "GlitchTip tunnel configuration missing" }, { status: 500 });
  }

  const url = `${serverUrl}/api/${projectId}/envelope/?sentry_version=7&sentry_key=${secretKey}&sentry_client=sentry.javascript.nextjs`;

  try {
    const rawBody = await req.text();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
        Accept: "*/*",
      },
      body: rawBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GlitchTip tunnel rejected payload:", response.status, errorText);
      return NextResponse.json({ status: "error", message: "GlitchTip rejected payload" }, { status: response.status });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("GlitchTip tunnel internal error:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
