import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { setCookie } from "hono/cookie";

declare module "hono" {
  interface ContextVariableMap {
    supabase: SupabaseClient;
    userId: string;
    requestId: string;
  }
}

export const getSupabase = (c: Context) => {
  return c.get("supabase");
};

type SupabaseEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
};

export const supabaseMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const supabaseEnv = env<SupabaseEnv>(c);
    const supabaseUrl = supabaseEnv.SUPABASE_URL;
    const supabaseAnonKey = supabaseEnv.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL missing!");
    }

    if (!supabaseAnonKey) {
      throw new Error("SUPABASE_ANON_KEY missing!");
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return parseCookieHeader(c.req.header("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            setCookie(c, name, value, options as any),
          );
        },
      },
    });

    c.set("supabase", supabase);

    await next();
  };
};

export const authMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const supabase = getSupabase(c);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return c.json({ error: "Unauthorized - Authentication required" }, 401);
    }

    // Set userId in context for logging
    c.set("userId", user.id);

    await next();
  };
};
