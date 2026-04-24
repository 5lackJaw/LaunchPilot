import type { SupabaseClient, User } from "@supabase/supabase-js";

export class AuthService {
  constructor(private readonly supabase: SupabaseClient) {}

  async requireUser(): Promise<User> {
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();

    if (error || !user) {
      throw new AuthRequiredError();
    }

    return user;
  }
}

export class AuthRequiredError extends Error {
  constructor() {
    super("You need to sign in before creating a product.");
    this.name = "AuthRequiredError";
  }
}
