import type { Metadata } from 'next';
import { Landing } from '@/components/landing/Landing';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${BRAND.name}: ${BRAND.tagline}`,
  description: 'Watch movies together in perfect sync with friends, wherever they are. Add it to your home screen for the best experience.',
};

export default function WelcomePage() {
  return <Landing />;
}
