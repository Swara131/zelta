import { NextResponse } from "next/server";
import { executeLogUpload, LogUploadError } from "@/lib/storage/log-uploads";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const record = await executeLogUpload(supabase, file);
    return NextResponse.json({ record });
  } catch (err) {
    const message =
      err instanceof LogUploadError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
