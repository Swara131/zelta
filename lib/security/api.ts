import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { applySecurityHeaders } from "./headers";
import { ValidationError } from "./errors";
import { formatZodError } from "./validation";

export function secureJson<T>(
  body: T,
  init?: ResponseInit & { status?: number }
): NextResponse {
  const response = NextResponse.json(body, init);
  return applySecurityHeaders(response) as NextResponse;
}

export function secureError(
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return secureJson({ error: message, ...extra }, { status });
}

export async function requireAuthenticatedUser(
  supabase: SupabaseServerClient
): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthenticationRequiredError";
  }
}

export async function withAuthenticatedApi<T>(
  handler: (ctx: {
    supabase: SupabaseServerClient;
    user: User;
    request: Request;
  }) => Promise<NextResponse>
): Promise<(request: Request, context?: unknown) => Promise<NextResponse>> {
  return async (request: Request, context?: unknown) => {
    try {
      const supabase = await createClient();
      const user = await requireAuthenticatedUser(supabase);
      const response = await handler({ supabase, user, request, ...(context as object) });
      return applySecurityHeaders(response) as NextResponse;
    } catch (err) {
      if (err instanceof AuthenticationRequiredError) {
        return secureError("Unauthorized", 401);
      }
      if (err instanceof ValidationError) {
        return secureError(err.message, 400, { details: err.details });
      }
      const message = err instanceof Error ? err.message : "Internal server error.";
      return secureError(message, 500);
    }
  };
}

export async function parseOptionalJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  fallback: z.infer<S>
): Promise<z.infer<S>> {
  let text = "";
  try {
    text = await request.text();
  } catch {
    return fallback;
  }

  if (!text.trim()) {
    return fallback;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Validation failed.", formatZodError(result.error));
  }

  return result.data;
}

export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("Invalid JSON body.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Validation failed.", formatZodError(result.error));
  }

  return result.data;
}

export function parseSearchParams<S extends z.ZodType>(
  url: string,
  schema: S
): z.infer<S> {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError("Invalid query parameters.", formatZodError(result.error));
  }
  return result.data;
}

export function assertUuid(value: string, label = "id"): void {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(value)) {
    throw new ValidationError(`Invalid ${label}.`);
  }
}

/** Strip HTML/script from user-provided strings before persistence. */
export function sanitizeUserText(input: string, maxLength = 2000): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\0\r\n\t]/g, " ")
    .trim()
    .slice(0, maxLength);
}
