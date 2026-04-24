"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { appConfig } from "@/config/app";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailPasswordSchema } from "@/server/schemas/auth";
import { checkRateLimit } from "@/server/security/rate-limit";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
};

const authLimit = {
  limit: 8,
  windowMs: 60_000,
};

export async function signInAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const rateLimit = await limitAuthAction("signin");
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.retryAfterSeconds);
    }

    const input = emailPasswordSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(input);

    if (error) {
      return {
        status: "error",
        message: "Email or password was not accepted.",
      };
    }

    redirect("/onboarding/crawl");
  } catch (error) {
    return authErrorState(error);
  }
}

export async function signUpAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  try {
    const rateLimit = await limitAuthAction("signup");
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.retryAfterSeconds);
    }

    const input = emailPasswordSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      ...input,
      options: {
        emailRedirectTo: `${appConfig.url}/auth/callback?next=/onboarding/crawl`,
      },
    });

    if (error) {
      return {
        status: "error",
        message: error.message,
      };
    }

    if (data.session) {
      redirect("/onboarding/crawl");
    }

    return {
      status: "success",
      message: "Check your email to confirm the account, then continue onboarding.",
    };
  } catch (error) {
    return authErrorState(error);
  }
}

async function limitAuthAction(action: "signin" | "signup") {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${action}:${forwardedFor || "unknown"}`;

  return checkRateLimit(key, authLimit);
}

function rateLimitError(retryAfterSeconds: number): AuthFormState {
  return {
    status: "error",
    message: `Too many attempts. Try again in ${retryAfterSeconds} seconds.`,
  };
}

function authErrorState(error: unknown): AuthFormState {
  if (error instanceof ZodError) {
    const flattened = error.flatten();

    return {
      status: "error",
      message: "Check the account details and try again.",
      fieldErrors: flattened.fieldErrors,
    };
  }

  if (error instanceof Error && error.message.includes("Supabase URL and publishable key")) {
    return {
      status: "error",
      message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local before signing in.",
    };
  }

  throw error;
}
