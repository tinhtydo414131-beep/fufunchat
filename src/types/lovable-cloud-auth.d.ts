// Override for @lovable.dev/cloud-auth-js to fix missing optional config parameter
declare module "@lovable.dev/cloud-auth-js" {
  interface LovableAuthConfig {
    oauthBrokerUrl?: string;
    supportedOAuthOrigins?: string[];
  }

  interface OAuthTokens {
    access_token: string;
    refresh_token: string;
  }

  interface SignInWithOAuthOptions {
    redirect_uri?: string;
    extraParams?: Record<string, string>;
  }

  type SignInWithOAuthResult =
    | { tokens: OAuthTokens; error: null; redirected?: false }
    | { tokens?: undefined; error: Error; redirected?: false }
    | { tokens?: undefined; error: null; redirected: true };

  interface LovableAuth {
    signInWithOAuth: (
      provider: "google" | "apple",
      opts?: SignInWithOAuthOptions
    ) => Promise<SignInWithOAuthResult>;
  }

  export function createLovableAuth(config?: LovableAuthConfig): LovableAuth;
}
