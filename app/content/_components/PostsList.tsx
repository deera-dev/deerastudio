"use client";
// Kartu 3 — daftar semua konten yang sudah dibuat (draft/scheduled/
// published/failed).
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
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
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>3. Semua Konten</CardTitle>
      </CardHeader>
      <CardBody>
        {loadingPosts ? (
          <p className="py-6 text-center text-sm text-text-faint">Memuat...</p>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-faint">Belum ada konten dibuat.</p>
        ) : (
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
        )}
      </CardBody>
    </Card>
  );
}
