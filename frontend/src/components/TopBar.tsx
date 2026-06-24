import { BookMarked, LogOut } from 'lucide-react';
import { Button } from './Button';
import styles from './TopBar.module.css';

interface TopBarProps {
  userName: string;
  onLogout: () => void;
}

export function TopBar({ userName, onLogout }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <BookMarked size={22} className={styles.brandIcon} />
        <span className={styles.brandText}>
          <span className={styles.brandMain}>Calibre-Web </span>
          <span className={styles.brandAccent}>NextGen</span>
        </span>
      </div>
      <div className={styles.right}>
        <span className={styles.userName}>{userName}</span>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </Button>
      </div>
    </header>
  );
}
