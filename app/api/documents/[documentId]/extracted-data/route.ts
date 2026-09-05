import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const body = await req.json();
    const userId = req.headers.get("x-user-id") || req.headers.get("x-demo-user-id") || "1";

    const backendRes = await fetch(`${BACKEND_URL}/api/documents/${documentId}/extracted-data`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Demo-User-Id": userId,
        "X-User-Id": userId,
      },
      body: JSON.stringify(body),
    });

    const json = await backendRes.json();
    return NextResponse.json(json, { status: backendRes.status });
  } catch (err: any) {
    console.error("Failed to proxy extracted-data update to backend:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Extracted data proxy failed" },
      { status: 502 }
    );
  }
}
