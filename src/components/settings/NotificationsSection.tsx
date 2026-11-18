'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { ALERT_KINDS, alertsSupported, readPref, requestAlertPermission, writePref } from '@/lib/notifications';
import { Toggle } from '../Toggle';
import shared from './SettingsView.module.css';
import styles from './NotificationsSection.module.css';
import { BRAND } from '@/lib/brand';

export function NotificationsSection() {
  const [supported, setSupported] = useState(true);
  const [master, setMaster] = useState(false);
  const [kinds, setKinds] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setSupported(alertsSupported());
    setMaster(readPref('master', false) && alertsSupported() && Notification.permission === 'granted');
    setKinds(Object.fromEntries(ALERT_KINDS.map((k) => [k.key, readPref(k.key)])));
  }, []);

  async function toggleMaster(on: boolean) {
    setNote(null);
    if (!on) { writePref('master', false); setMaster(false); return; }
    const result = await requestAlertPermission();
    if (result === 'granted') { writePref('master', true); setMaster(true); }
    else setNote('Alerts are blocked for this site. Allow notifications in your browser’s site settings, then try again.');
  }

  return (
    <section className={shared.card}>
      <div className={shared.head}><h2><Bell size={22} /> Notifications</h2><p>Choose what you get alerted about</p></div>
      {!supported ? (
        <p className={shared.note}>This browser can’t show alerts. On iPhone, tap Share then “Add to Home Screen” and open {BRAND.name} from there. Your notifications still appear in the bell inside the app.</p>
      ) : (
        <>
          <div className={styles.row}><span>Browser alerts</span><Toggle checked={master} onChange={toggleMaster} label="Browser alerts" /></div>
          {master && ALERT_KINDS.map((k) => (
            <div key={k.key} className={styles.row}>
              <span>{k.label}</span>
              <Toggle checked={kinds[k.key] ?? true} label={k.label} onChange={(v) => { writePref(k.key, v); setKinds((s) => ({ ...s, [k.key]: v })); }} />
            </div>
          ))}
          <p className={shared.note}>Alerts appear while {BRAND.name} is open in another tab or installed on your phone. Everything is always listed in the bell inside the app.</p>
        </>
      )}
      {note && <p role="alert" className={shared.error}>{note}</p>}
    </section>
  );
}
