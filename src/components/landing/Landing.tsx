'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check, Download, Ellipsis, EllipsisVertical, Eye, MessageCircle, Monitor, MoonStar, PlusSquare, Share, Smartphone, SquareArrowOutUpRight, Users, Volume2, Wifi,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { useAuth } from '@/lib/AuthProvider';
import { detectPlatform, isStandalone, useInstallPrompt, type Platform } from '@/lib/install';
import { Logo } from '../Logo';
import styles from './Landing.module.css';

const STEPS: Record<Platform, { Icon: typeof Share; text: React.ReactNode }[]> = {
  ios: [
    { Icon: SquareArrowOutUpRight, text: <>Open this page in <strong>Safari</strong>. If you got the link in WhatsApp or Instagram, tap the menu there and choose <strong>Open in Safari</strong>.</> },
    { Icon: Share, text: <>Tap the <strong>Share</strong> button (the square with an arrow) at the bottom of the screen.</> },
    { Icon: PlusSquare, text: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
    { Icon: Check, text: <>Tap <strong>Add</strong>. Open {BRAND.name} from the new icon on your home screen from now on.</> },
  ],
  android: [
    { Icon: SquareArrowOutUpRight, text: <>Open this page in <strong>Chrome</strong>. If you got the link inside another app, tap its menu and choose <strong>Open in Chrome</strong>.</> },
    { Icon: EllipsisVertical, text: <>Tap the <strong>⋮ menu</strong> at the top right.</> },
    { Icon: PlusSquare, text: <>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</> },
    { Icon: Check, text: <>Confirm. Open {BRAND.name} from the new icon from now on.</> },
  ],
  desktop: [
    { Icon: Monitor, text: <>In <strong>Chrome</strong> or <strong>Edge</strong>, look for the install icon at the right end of the address bar.</> },
    { Icon: Download, text: <>Click it, then choose <strong>Install</strong>. You can also use the browser menu and pick <strong>Install {BRAND.name}</strong>.</> },
    { Icon: Check, text: <>On a Mac with Safari, use <strong>File, then Add to Dock</strong>.</> },
  ],
};
const TABS: { id: Platform; label: string; Icon: typeof Share }[] = [
  { id: 'ios', label: 'iPhone', Icon: Smartphone },
  { id: 'android', label: 'Android', Icon: Smartphone },
  { id: 'desktop', label: 'Computer', Icon: Monitor },
];
const FEATURES = [
  { Icon: Wifi, title: 'Always in step', text: 'One person’s play, pause or seek moves the whole room. A slow connection catches up gradually instead of jumping around.' },
  { Icon: Volume2, title: 'Your volume, your subtitles', text: 'Everyone sets their own, so nobody’s choices ever change anyone else’s screen.' },
  { Icon: MessageCircle, title: 'Chat and reactions', text: 'Talk in the lobby or while the movie plays, and send reactions that float across the screen.' },
  { Icon: Users, title: 'Rooms and friends', text: 'Share a code, or invite friends straight from your list. Private rooms stay private.' },
  { Icon: MoonStar, title: 'Made for movie night', text: 'A cinematic dark mode, a light mode for daytime, and a landscape view that feels like a real player.' },
  { Icon: Eye, title: 'No one gets left behind', text: 'If someone’s video stalls, the room pauses and waits, then you all carry on together.' },
];

export function Landing() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Platform>('ios');
  const [installed, setInstalled] = useState(false);
  const { canInstall, install } = useInstallPrompt();

  useEffect(() => {
    setTab(detectPlatform());
    setInstalled(isStandalone());
  }, []);

  const signedIn = Boolean(session);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/welcome" className={styles.brand} aria-label={BRAND.name}><Logo size={36} /><span>{BRAND.name}</span></Link>
        <nav className={styles.nav}>
          {!installed && <a href="#install" className={styles.navLink}>Install</a>}
          <Link href={signedIn ? '/' : '/login'} className={styles.navBtn}>{signedIn ? 'Open app' : 'Log in'}</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1>Watch together.<br /><span>Even when apart.</span></h1>
            <p className={styles.lead}>Start a room, send the code, and press play at the same moment as your friends, wherever they are. Everyone keeps their own volume and subtitles.</p>
            <div className={styles.ctas}>
              <Link href={signedIn ? '/' : '/signup'} className={styles.primary}>{signedIn ? 'Open the app' : 'Get started'}</Link>
              {!installed && <a href="#install" className={styles.secondary}>Add to home screen</a>}
            </div>
            {!installed && <p className={styles.tip}>For the smoothest experience, add {BRAND.name} to your home screen instead of using it in the browser.</p>}
          </div>

          <div className={styles.phoneWrap} aria-hidden>
            <div className={styles.phone}>
              <div className={styles.phoneTop}>
                <span className={styles.av} style={{ background: '#4a5a1e' }}>A</span><span className={styles.av} style={{ background: '#1e5a3c' }}>K</span><span className={styles.av} style={{ background: '#5a1e4a' }}>T</span>
              </div>
              <div className={styles.screen}><span className={styles.play} /></div>
              <div className={styles.bar}><span /></div>
              <div className={styles.phoneRow}><span>0:42</span><span className={styles.synced}><Wifi size={14} /> Synced</span></div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2>How it works</h2>
          <ol className={styles.how}>
            <li><b>1</b><div><h3>Make a room</h3><p>Pick a video you uploaded, or one shared to the library.</p></div></li>
            <li><b>2</b><div><h3>Invite your friends</h3><p>Share the room code, or invite people from your friends list.</p></div></li>
            <li><b>3</b><div><h3>Press play together</h3><p>Play, pause and seek stay in step on every screen.</p></div></li>
          </ol>
        </section>

        <section className={styles.section}>
          <h2>Everything you need for movie night</h2>
          <div className={styles.grid}>
            {FEATURES.map(({ Icon, title, text }) => (
              <article key={title} className={styles.card}><span className={styles.icon}><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
          <p className={styles.note}>{BRAND.name} works with videos you upload (MP4 or WebM) or link to. It can’t sync Netflix and other streaming apps, because they don’t allow it.</p>
        </section>

        {!installed && (
          <section id="install" className={`${styles.section} ${styles.install}`}>
            <h2>Add {BRAND.name} to your home screen</h2>
            <p className={styles.sub}>It takes about ten seconds, and it’s the best way to use {BRAND.name}:</p>
            <ul className={styles.perks}>
              <li><Check size={18} /> Opens full screen, with no browser bars in the way of your movie</li>
              <li><Check size={18} /> One tap from an icon, like any other app</li>
              <li><Check size={18} /> Landscape viewing feels like a proper video player</li>
              <li><Check size={18} /> On iPhone, alerts only work once it’s added to your home screen</li>
            </ul>

            {canInstall && <button className={styles.primary} onClick={install}><Download size={18} /> Install {BRAND.name}</button>}

            <div role="tablist" aria-label="Choose your device" className={styles.tabs}>
              {TABS.map(({ id, label }) => (
                <button key={id} role="tab" aria-selected={tab === id} className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>
            <ol className={styles.steps}>
              {STEPS[tab].map(({ Icon, text }, i) => (
                <li key={i}><span className={styles.stepIcon}><Icon size={20} /></span><span>{text}</span></li>
              ))}
            </ol>
            {tab === 'ios' && <p className={styles.note}>Safari is the only iPhone browser that can add apps to the home screen, and the Share button sits in the bar at the bottom (on iPad it’s at the top).</p>}
            {tab !== 'desktop' && <p className={styles.note}><Ellipsis size={14} style={{ verticalAlign: '-2px' }} /> Can’t find it? Browsers move these buttons around now and then. Searching your browser’s menu for “home screen” usually finds it.</p>}
          </section>
        )}

        <section className={`${styles.section} ${styles.final}`}>
          <h2>Ready when you are</h2>
          <Link href={signedIn ? '/' : '/signup'} className={styles.primary}>{signedIn ? 'Open the app' : 'Create your account'}</Link>
          {!signedIn && <p className={styles.note}>No account yet? You can also join a room as a guest with a code.</p>}
        </section>
      </main>

      <footer className={styles.footer}>
        <span>{BRAND.name} · {BRAND.tagline}</span>
        <span>Made by {BRAND.studio}</span>
      </footer>
    </div>
  );
}
