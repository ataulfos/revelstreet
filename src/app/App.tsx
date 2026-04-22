import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/routes';

export function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <RouterProvider router={router} />
    </div>
  );
}
