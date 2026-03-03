/**
 * Token storage interface for APA auth tokens.
 */

export interface TokenStore {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clearTokens(): Promise<void>;
}

// In-memory store for local development
export class InMemoryTokenStore implements TokenStore {
  private authToken: string | null = null;
  private refreshToken: string | null = null;

  async getToken() {
    return this.authToken;
  }

  async setToken(token: string) {
    this.authToken = token;
  }

  async getRefreshToken() {
    return this.refreshToken;
  }

  async setRefreshToken(token: string) {
    this.refreshToken = token;
  }

  async clearTokens() {
    this.authToken = null;
    this.refreshToken = null;
  }
}
