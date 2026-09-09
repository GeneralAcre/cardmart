import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";

/**
 * Issues short-lived client upload tokens so verification photos go straight
 * from the browser to Vercel Blob storage — the raw bytes never pass through
 * our server or a Server Action, which is what keeps this scalable to
 * thousands of live-camera captures instead of bloating Postgres.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const user = await getCurrentUser();
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: 8 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // No DB write needed here — createListing persists the resulting
        // blob URL once the seller submits the full listing form.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
