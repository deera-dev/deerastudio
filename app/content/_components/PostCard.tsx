"use client";
// Satu baris konten di daftar "Semua Konten" — edit caption inline, atur
// jadwal, publish, salin, download, hapus.
import { motion } from "framer-motion";
import { Copy, Download, Instagram, Pencil, Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import type { ContentPost } from "@/types/database";
import { CONTENT_TYPE_OPTIONS, STATUS_TONE, THEME_OPTIONS, formatDateTime, toDatetimeLocalValue } from "../_lib/types";

export function PostCard({
  post,
  isEditing,
  editCaption,
  onEditCaptionChange,
  editHashtags,
  onEditHashtagsChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onSchedule,
  onPublish,
  onDelete,
  onCopy,
  onDownload,
  publishing,
  instagramConfigured,
}: {
  post: ContentPost;
  isEditing: boolean;
  editCaption: string;
  onEditCaptionChange: (v: string) => void;
  editHashtags: string;
  onEditHashtagsChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onSchedule: (value: string) => void;
  onPublish: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onDownload: () => void;
  publishing: boolean;
  instagramConfigured: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row"
    >
      <div className="flex shrink-0 gap-1.5">
        {post.image_urls.slice(0, 3).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-md object-cover sm:h-20 sm:w-20" />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text">{post.product_kode}</span>
          <Badge tone={STATUS_TONE[post.status]}>{post.status}</Badge>
          {post.theme && (
            <span className="text-xs text-text-faint">
              {THEME_OPTIONS.find((t) => t.value === post.theme)?.label ?? post.theme}
            </span>
          )}
          <span className="text-xs text-text-faint">
            {CONTENT_TYPE_OPTIONS.find((t) => t.value === post.content_type)?.label}
          </span>
        </div>

        {isEditing ? (
          <div className="mt-2 flex flex-col gap-2">
            <Textarea rows={4} value={editCaption} onChange={(e) => onEditCaptionChange(e.target.value)} />
            <Textarea rows={2} value={editHashtags} onChange={(e) => onEditHashtagsChange(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={onSaveEdit}>
                Simpan
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 whitespace-pre-line text-sm text-text-muted">{post.caption}</p>
        )}

        {post.error_message && <p className="mt-1.5 text-xs text-danger">{post.error_message}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {post.status !== "published" && (
            <Input
              type="datetime-local"
              value={toDatetimeLocalValue(post.scheduled_at)}
              onChange={(e) => onSchedule(e.target.value)}
              className="!w-auto text-xs"
            />
          )}
          {post.status === "published" && post.published_at && (
            <span className="text-xs text-text-faint">Published {formatDateTime(post.published_at)}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-row gap-1.5 sm:flex-col">
        {post.status !== "published" && !isEditing && (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold"
            title="Edit caption"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold"
          title="Salin caption"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold"
          title="Download foto"
        >
          <Download className="h-4 w-4" />
        </button>
        {post.status !== "published" && (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold disabled:opacity-50"
            title={instagramConfigured ? "Publish ke Instagram" : "Instagram belum terhubung"}
          >
            {publishing ? <UploadCloud className="h-4 w-4 animate-pulse" /> : <Instagram className="h-4 w-4" />}
          </button>
        )}
        {post.status !== "published" && (
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-danger"
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
