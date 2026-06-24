import type { Book } from '../lib/api';
import { BookCover } from './BookCover';
import styles from './BookCard.module.css';

interface BookCardProps {
  book: Book;
  style?: React.CSSProperties;
}

export function BookCard({ book, style }: BookCardProps) {
  const authorStr = book.authors.join(', ');

  return (
    <article className={styles.card} style={style} tabIndex={0} role="button">
      <div className={styles.coverWrap}>
        <BookCover coverUrl={book.cover_url} title={book.title} />
      </div>
      <div className={styles.info}>
        <p className={styles.title}>{book.title}</p>
        <p className={styles.author}>{authorStr}</p>
      </div>
    </article>
  );
}
