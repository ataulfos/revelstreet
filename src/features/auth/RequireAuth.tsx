import type { ReactNode } from 'react';

export interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  return <>{children}</>;
}
