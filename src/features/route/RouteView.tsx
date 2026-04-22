import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { MapCanvas } from '@/features/map/MapCanvas';
import { StopList } from '@/features/stops/StopList';

type RouteStatusForNow = 'assigned' | 'in_progress' | 'complete';

function useRouteStatusForNow(): RouteStatusForNow {
  return 'assigned';
}

export function RouteView() {
  const navigate = useNavigate();
  const status = useRouteStatusForNow();

  useEffect(() => {
    if (status === 'complete') {
      navigate('/route/summary');
    }
  }, [status, navigate]);

  return (
    <main className="flex h-screen w-full flex-col lg:flex-row" data-testid="route-view">
      <section
        className="h-[40vh] w-full lg:h-full lg:w-3/5"
        aria-label="Route map"
        data-testid="route-map-pane"
      >
        <MapCanvas />
      </section>
      <section
        className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800 lg:border-l lg:border-t-0 lg:w-2/5"
        aria-label="Stop list"
        data-testid="route-stops-pane"
      >
        <StopList />
      </section>
    </main>
  );
}
