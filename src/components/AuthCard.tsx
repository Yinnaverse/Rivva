import { Logo } from './Logo';
import styles from './AuthCard.module.css';

export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Logo size={42} />
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  id, label, icon, type = 'text', placeholder, autoComplete, minLength,
}: {
  id: string; label: string; icon: React.ReactNode; type?: string; placeholder: string; autoComplete?: string; minLength?: number;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{icon}{label}</label>
      <input id={id} name={id} type={type} placeholder={placeholder} autoComplete={autoComplete} minLength={minLength} className={styles.input} required />
    </div>
  );
}

export function Divider() {
  return (
    <div className={styles.divider} role="separator">
      <span />
      <em>OR</em>
      <span />
    </div>
  );
}
