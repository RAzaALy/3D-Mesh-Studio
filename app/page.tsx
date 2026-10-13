import { StudioApp } from '@/components/StudioApp';
import { partsRepository } from '@/lib/partsRepository';

// The saved scene can change at any time, so render per request (it's a cheap render).
export const dynamic = 'force-dynamic';

/**
 * Server Component: reads the saved scene directly (no HTTP round trip) and embeds it
 * in the HTML. The browser no longer has to download the 3D bundle and *then* fetch
 * `/api/parts`; the side panel also shows the real saved values on first paint.
 */
export default function Home() {
  return <StudioApp initialParts={partsRepository.get().parts} />;
}
