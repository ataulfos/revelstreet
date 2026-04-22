export interface AuthStoreState {
  isAuthenticated: boolean;
  operator: { id: string; name: string } | null;
  login: (id: string, pin: string) => void;
  logout: () => void;
}

export function useAuthStore(): AuthStoreState {
  return {
    isAuthenticated: false,
    operator: null,
    login: () => undefined,
    logout: () => undefined,
  };
}
