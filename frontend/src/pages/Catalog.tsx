import { useState } from 'react';
import { BookCard } from '../components/BookCard';
import { Button } from '../components/Button';
import { Spinner, SpinnerCentered } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { useBooks } from '../lib/queries';
import type { Book } from '../lib/api';
import styles from './Catalog.module.css';

export function Catalog() {
  const [page, setPage] = useState(1);
  const [allBooks, setAllBooks] = useState<Book[]>([]);

  const { data, isLoading, isFetching, error } = useBooks(page);

  // Accumulate pages
  if (data) {
    const existing = allBooks.map((b) => b.id);
    const newBooks = data.items.filter((b) => !existing.includes(b.id));
    if (newBooks.length > 0) {
      setAllBooks((prev) => [...prev, ...newBooks]);
    }
  }

  const total = data?.total ?? 0;
  const loadedCount = allBooks.length;
  const hasMore = loadedCount < total;

  const isFirstLoad = isLoading && allBooks.length === 0;

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your Library</h1>
        {total > 0 && (
          <span className={styles.count}>{total} book{total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {isFirstLoad ? (
        <SpinnerCentered size={36} />
      ) : error ? (
        <EmptyState message={error instanceof Error ? error.message : 'Failed to load books.'} />
      ) : allBooks.length === 0 ? (
        <EmptyState message="No books yet." />
      ) : (
        <>
          <div className={styles.grid}>
            {allBooks.map((book, i) => (
              <BookCard
                key={book.id}
                book={book}
                style={{ animationDelay: `${Math.min(i, 24) * 35}ms` }}
              />
            ))}
          </div>

          {hasMore && (
            <div className={styles.loadMore}>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
              >
                {isFetching ? (
                  <>
                    <Spinner size={16} />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
