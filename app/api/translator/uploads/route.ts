import { NextResponse } from "next/server";
import {
  listUploadedLogsForTranslation,
} from "@/lib/translations/repository";
import { TranslationDbError } from "@/lib/translations/errors";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const uploads = await listUploadedLogsForTranslation(supabase, user.id);
    return NextResponse.json({ uploads });
  } catch (err) {
    const message =
      err instanceof TranslationDbError ? err.message : "Failed to load uploads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
