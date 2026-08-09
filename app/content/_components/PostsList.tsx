"use client";
// Kartu 3 — daftar semua konten yang sudah dibuat (draft/scheduled/
// published/failed).
//
// REVISI Agustus 2026 v2 (feedback admin: "dibuat pagination aja ya,
// nanti makin banyak malah susah liatnya, dan bikin search juga ya") —
// tambah search bar (kode produk) + kontrol pagination, data-nya sendiri
// sudah di-page/search server-side di useContentPosts.ts.
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { ContentPost } from "@/types/database";
import { PostCard } from "./PostCard";

export function PostsList({
  posts,
  loadingPosts,
  editingId,
  editCaption,
  onEditCaptionChange,
  editHashtags,
  onEditHashtagsChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onSchedule,
  onPublish,
  onDelete,
  onCopy,
  onDownload,
  publishingId,
  instagramConfigured,
  searchInput,
  onSearchInputChange,
  search,
  page,
  onPageChange,
  totalCount,
  totalPages,
}: {
  posts: ContentPost[];
  loadingPosts: boolean;
  editingId: string | null;
  editCaption: string;
  onEditCaptionChange: (v: string) => void;
  editHashtags: string;
  onEditHashtagsChange: (v: string) => void;
  onStartEdit: (post: ContentPost) => void;
  onCancelEdit: () => void;
  onSaveEdit: (post: ContentPost) => void;
  onSchedule: (post: ContentPost, value: string) => void;
  onPublish: (post: ContentPost) => void;
  onDelete: (post: ContentPost) => void;
  onCopy: (post: ContentPost) => void;
  onDownload: (post: ContentPost) => void;
  publishingId: string | null;
  instagramConfigured: boolean;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  search: string;
  page: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  totalPages: number;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>3. Semua Konten</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <Input
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            placeholder="Cari kode produk..."
            className="pl-9"
          />
        </div>

        {loadingPosts ? (
          <p className="py-6 text-center text-sm text-text-faint">Memuat...</p>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-faint">
            {search ? `Tidak ada konten dengan kode produk yang cocok "${search}".` : "Belum ada konten dibuat."}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isEditing={editingId === post.id}
                  editCaption={editCaption}
                  onEditCaptionChange={onEditCaptionChange}
                  editHashtags={editHashtags}
                  onEditHashtagsChange={onEditHashtagsChange}
                  onStartEdit={() => onStartEdit(post)}
                  onSaveEdit={() => onSaveEdit(post)}
                  onCancelEdit={onCancelEdit}
                  onSchedule={(value) => onSchedule(post, value)}
                  onPublish={() => onPublish(post)}
                  onDelete={() => onDelete(post)}
                  onCopy={() => onCopy(post)}
                  onDownload={() => onDownload(post)}
                  publishing={publishingId === post.id}
                  instagramConfigured={instagramConfigured}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-text-faint">
                <span>
                  {totalCount} konten total · halaman {page + 1} dari {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => onPageChange(Math.max(0, page - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Sebelumnya
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                  >
                    Berikutnya
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
