"use client";
// Daftar semua konten (draft/scheduled/published/failed) + edit caption,
// jadwal, publish ke Instagram, hapus, salin, download foto.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import type { ContentPost } from "@/types/database";

export function useContentPosts() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [instagramConfigured, setInstagramConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/content/instagram-status")
      .then((r) => r.json())
      .then((d) => setInstagramConfigured(Boolean(d.configured)))
      .catch(() => setInstagramConfigured(false));
  }, []);

  async function loadPosts() {
    setLoadingPosts(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("content_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setPosts((data as ContentPost[]) ?? []);
    setLoadingPosts(false);
  }

  useEffect(() => {
    loadPosts();
  }, []);

  function startEdit(post: ContentPost) {
    setEditingId(post.id);
    setEditCaption(post.caption);
    setEditHashtags(post.hashtags.join(" "));
  }

  async function saveEdit(post: ContentPost) {
    try {
      const res = await fetch(`/api/content-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: editCaption,
          hashtags: editHashtags.split(/\s+/).filter((h) => h.startsWith("#")),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan perubahan");
      toast.success("Perubahan tersimpan");
      setEditingId(null);
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan perubahan");
    }
  }

  async function handleSchedule(post: ContentPost, value: string) {
    try {
      const res = await fetch(`/api/content-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: value ? new Date(value).toISOString() : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal atur jadwal");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal atur jadwal");
    }
  }

  async function handlePublish(post: ContentPost) {
    setPublishingId(post.id);
    try {
      const res = await fetch(`/api/content-posts/${post.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish gagal");
      toast.success("Berhasil dipublish ke Instagram");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish gagal");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete(post: ContentPost) {
    const ok = await confirmDialog({
      title: "Hapus draft konten?",
      description: `Konten untuk "${post.product_kode}" akan dihapus permanen.`,
      confirmLabel: "Ya, hapus",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/content-posts/${post.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal hapus");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal hapus");
    }
  }

  function copyCaption(post: ContentPost) {
    const text = [post.caption, post.hashtags.join(" ")].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Caption disalin ke clipboard");
  }

  async function downloadImage(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  return {
    posts,
    loadingPosts,
    editingId,
    editCaption,
    setEditCaption,
    editHashtags,
    setEditHashtags,
    publishingId,
    instagramConfigured,
    loadPosts,
    startEdit,
    setEditingId,
    saveEdit,
    handleSchedule,
    handlePublish,
    handleDelete,
    copyCaption,
    downloadImage,
  };
}
