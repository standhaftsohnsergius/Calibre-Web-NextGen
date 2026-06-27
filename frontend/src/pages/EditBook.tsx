import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronLeft, Save, Trash2, RefreshCw, Image as ImageIcon, Upload as UploadIcon, ExternalLink } from 'lucide-react';
import {
  useBookMetadata, useUpdateMetadata, useBook, useMe, useDeleteFormat, useConvertFormat, useSetCover,
} from '../lib/queries';
import { Button } from '../components/Button';
import { SpinnerCentered } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import type { MetadataUpdate } from '../lib/api';
import { ApiError } from '../lib/api';
import styles from './EditBook.module.css';

interface FormState {
  title: string;
  authors: string;
  series: string;
  series_index: string;
  tags: string;
  publishers: string;
  languages: string;
  rating: string;
  comments: string;
}

const RATINGS = ['', '1', '2', '3', '4', '5'];

export function EditBook({ id }: { id: string }) {
  const { data: meta, isLoading, error } = useBookMetadata(id);
  const update = useUpdateMetadata(id);
  const [, navigate] = useLocation();

  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!meta) return;
    setForm({
      title: meta.title,
      authors: meta.authors,
      series: meta.series,
      series_index: meta.series_index != null ? String(meta.series_index) : '',
      tags: meta.tags,
      publishers: meta.publishers,
      languages: meta.languages,
      rating: meta.rating ? String(meta.rating) : '',
      comments: meta.comments,
    });
  }, [meta]);

  if (isLoading || !form) {
    if (error) {
      return (
        <main className={styles.container}>
          <EmptyState message={error instanceof Error ? error.message : 'Could not load metadata.'} />
        </main>
      );
    }
    return <SpinnerCentered size={40} />;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setFieldErrors({});
    const payload: MetadataUpdate = {
      title: form.title,
      authors: form.authors,
      series: form.series,
      series_index: form.series_index,
      tags: form.tags,
      publishers: form.publishers,
      languages: form.languages,
      rating: form.rating ? Number(form.rating) : 0,
      comments: form.comments,
    };
    update.mutate(payload, {
      onSuccess: (data) => {
        if (data.errors && Object.keys(data.errors).length > 0) {
          setFieldErrors(data.errors);
          setBanner({ ok: false, text: 'Some fields could not be saved.' });
        } else {
          setBanner({ ok: true, text: 'Saved.' });
          navigate(`/book/${id}`);
        }
      },
      onError: (err) =>
        setBanner({ ok: false, text: err instanceof ApiError ? err.message : 'Save failed.' }),
    });
  };

  return (
    <main className={styles.container}>
      <Link href={`/book/${id}`} className={styles.back}>
        <ChevronLeft size={16} /> Back to book
      </Link>
      <h1 className={styles.title}>Edit metadata</h1>

      <CoverManager id={id} />

      <form className={styles.form} onSubmit={onSubmit}>
        <Field label="Title" error={fieldErrors.title}>
          <input className={styles.input} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Authors (separate with &)" error={fieldErrors.authors}>
          <input className={styles.input} value={form.authors} onChange={(e) => set('authors', e.target.value)} />
        </Field>

        <div className={styles.row}>
          <Field label="Series" error={fieldErrors.series}>
            <input className={styles.input} value={form.series} onChange={(e) => set('series', e.target.value)} />
          </Field>
          <Field label="Series index" error={fieldErrors.series_index} grow={false}>
            <input className={styles.inputNarrow} type="number" step="0.01" value={form.series_index}
              onChange={(e) => set('series_index', e.target.value)} />
          </Field>
        </div>

        <Field label="Tags (comma separated)" error={fieldErrors.tags}>
          <input className={styles.input} value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
        <Field label="Publishers (comma separated)" error={fieldErrors.publishers}>
          <input className={styles.input} value={form.publishers} onChange={(e) => set('publishers', e.target.value)} />
        </Field>

        <div className={styles.row}>
          <Field label="Languages (comma separated)" error={fieldErrors.languages}>
            <input className={styles.input} value={form.languages} onChange={(e) => set('languages', e.target.value)} />
          </Field>
          <Field label="Rating" error={fieldErrors.rating} grow={false}>
            <select className={styles.inputNarrow} value={form.rating} onChange={(e) => set('rating', e.target.value)}>
              {RATINGS.map((r) => <option key={r} value={r}>{r ? `${r} ★` : '—'}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Description" error={fieldErrors.comments}>
          <textarea className={styles.textarea} rows={8} value={form.comments}
            onChange={(e) => set('comments', e.target.value)} />
          <span className={styles.hint}>HTML is allowed and sanitized on display.</span>
        </Field>

        <div className={styles.actions}>
          <Button type="submit" disabled={update.isPending}>
            <Save size={16} /> Save changes
          </Button>
          <Link href={`/book/${id}`} className={styles.cancel}>Cancel</Link>
          {banner && <span className={banner.ok ? styles.msgOk : styles.msgErr}>{banner.text}</span>}
        </div>
      </form>

      <FormatsManager id={id} />
    </main>
  );
}

/** Replace the book cover: upload a file or paste a URL. The full provider
 *  candidate grid + e-reader padding preview lives at the legacy /book/:id/cover. */
function CoverManager({ id }: { id: string }) {
  const { data: book } = useBook(id);
  const setCover = useSetCover(id);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setCover.mutate({ file }, {
      onSuccess: () => setMsg({ ok: true, text: 'Cover updated.' }),
      onError: (err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Upload failed.' }),
    });
  };

  const onUrl = () => {
    if (!url.trim()) return;
    setMsg(null);
    setCover.mutate({ url: url.trim() }, {
      onSuccess: () => { setMsg({ ok: true, text: 'Cover updated.' }); setUrl(''); },
      onError: (err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not fetch cover.' }),
    });
  };

  return (
    <section className={styles.coverSection}>
      <div className={styles.coverPreview}>
        {book?.cover_url
          ? <img src={book.cover_url} alt="Current cover" className={styles.coverImg} />
          : <div className={styles.coverPlaceholder}><ImageIcon size={28} /></div>}
      </div>
      <div className={styles.coverControls}>
        <label className={styles.coverUploadBtn}>
          <UploadIcon size={15} /> Upload image
          <input type="file" accept="image/*" hidden onChange={onFile} disabled={setCover.isPending} />
        </label>
        <div className={styles.coverUrlRow}>
          <input className={styles.input} value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="…or paste an image URL" />
          <Button type="button" variant="ghost" onClick={onUrl} disabled={setCover.isPending || !url.trim()}>
            Fetch
          </Button>
        </div>
        <a className={styles.coverAdvanced} href={`/book/${id}/cover?origin=edit`}>
          <ExternalLink size={13} /> More cover options (search providers, e-reader preview)
        </a>
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
      </div>
    </section>
  );
}

/** Manage a book's files: delete a format, or queue a conversion. */
function FormatsManager({ id }: { id: string }) {
  const { data: book } = useBook(id);
  const me = useMe().data;
  const deleteFormat = useDeleteFormat(id);
  const convertFormat = useConvertFormat(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const formats = book?.formats.map((f) => f.format) ?? [];
  if (formats.length === 0) return null;
  const canDelete = !!me?.role?.delete_books;

  const onConvert = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    convertFormat.mutate(
      { from: from || formats[0], to: to.trim().toUpperCase() },
      {
        onSuccess: (r) => { setMsg({ ok: true, text: r.message }); setTo(''); },
        onError: (err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Convert failed.' }),
      },
    );
  };

  return (
    <section className={styles.formatsSection}>
      <h2 className={styles.subTitle}>Files</h2>
      <ul className={styles.formatList}>
        {book!.formats.map((f) => (
          <li key={f.format} className={styles.formatItem}>
            <span className={styles.formatName}>{f.format}</span>
            <a className={styles.formatDownload} href={f.download_url} download>Download</a>
            {canDelete && (
              <button className={styles.formatDelete}
                onClick={() => {
                  if (window.confirm(`Delete the ${f.format} file? The book stays; only this format is removed.`)) {
                    deleteFormat.mutate(f.format);
                  }
                }}
                disabled={deleteFormat.isPending}
                aria-label={`Delete ${f.format}`}>
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className={styles.convertForm} onSubmit={onConvert}>
        <label className={styles.fieldNarrow}>
          <span className={styles.label}>Convert from</span>
          <select className={styles.inputNarrow} value={from || formats[0]} onChange={(e) => setFrom(e.target.value)}>
            {formats.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label className={styles.fieldNarrow}>
          <span className={styles.label}>to</span>
          <input className={styles.inputNarrow} value={to} onChange={(e) => setTo(e.target.value)}
            placeholder="e.g. MOBI" />
        </label>
        <Button type="submit" variant="ghost" disabled={convertFormat.isPending || !to.trim()}>
          <RefreshCw size={15} /> Convert
        </Button>
        {msg && <span className={msg.ok ? styles.msgOk : styles.msgErr}>{msg.text}</span>}
      </form>
    </section>
  );
}

function Field({ label, error, grow = true, children }:
  { label: string; error?: string; grow?: boolean; children: React.ReactNode }) {
  return (
    <label className={grow ? styles.field : styles.fieldNarrow}>
      <span className={styles.label}>{label}</span>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </label>
  );
}
