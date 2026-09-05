import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = req.headers.get("x-user-id") || req.headers.get("x-demo-user-id") || "1";

    const backendRes = await fetch(`${BACKEND_URL}/api/documents`, {
      method: "POST",
      headers: {
        "X-Demo-User-Id": userId,
        "X-User-Id": userId,
      },
      body: formData,
    });

    const json = await backendRes.json();
    return NextResponse.json(json, { status: backendRes.status });
  } catch (err: any) {
    console.error("Failed to proxy document upload to backend:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Document upload proxy failed" },
      { status: 502 }
    );
  }
}
