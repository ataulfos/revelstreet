import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RequireAuth = lazy(() =>
  import('@/features/auth/RequireAuth').then((m) => ({ default: m.RequireAuth })),
);
const RouteView = lazy(() =>
  import('@/features/route/RouteView').then((m) => ({ default: m.RouteView })),
);
const CompletionSummary = lazy(() =>
  import('@/features/summary/CompletionSummary').then((m) => ({ default: m.CompletionSummary })),
);

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/route" replace />,
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<Fallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: '/route',
    element: (
      <Suspense fallback={<Fallback />}>
        <RequireAuth>
          <RouteView />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '/route/summary',
    element: (
      <Suspense fallback={<Fallback />}>
        <RequireAuth>
          <CompletionSummary />
        </RequireAuth>
      </Suspense>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/route" replace />,
  },
]);
