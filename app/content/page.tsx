"use client";
// Content Studio (Agustus 2026) — generate caption+hashtag Instagram dari
// foto produk yang SUDAH ADA di katalog Deera, simpan sbg draft, atur
// jadwal, lalu publish (Instagram) atau salin manual. TIDAK generate
// gambar produk apa pun di sini — foto diambil apa adanya, kecuali lewat
// fitur AI opsional (Poster/Foto Marketing/Foto Gabungan Grup).
//
// File ini SENGAJA tipis — orchestrator saja. Semua state & fetch logic
// hidup di app/content/_hooks/*, semua JSX kompleks di
// app/content/_components/*. Lihat _lib/types.ts utk tipe & konstanta
// bersama.
//
// Dua alur foto yang TIDAK bisa jalan bersamaan:
// - 1 produk terpilih -> alur biasa: pilih foto individual (PhotoPickerGrid)
//   + Poster AI + Foto Marketing AI per-slide.
// - 2-5 produk terpilih ("mode grup") -> GroupComboPanel: SEMUA produk
//   digabung jadi 1 frame per foto cerita (useGroupCombo), bukan lagi foto
//   individual per produk.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Sparkles } from "lucide-react";
import type { ContentPostTheme } from "@/types/database";

import { useProductSelection } from "./_hooks/useProductSelection";
import { usePhotoSelection } from "./_hooks/usePhotoSelection";
import { useMarketingPhotos } from "./_hooks/useMarketingPhotos";
import { useGroupCombo } from "./_hooks/useGroupCombo";
import { usePosterAi } from "./_hooks/usePosterAi";
import { useCaptionGeneration } from "./_hooks/useCaptionGeneration";
import { useCalendar } from "./_hooks/useCalendar";
import { useContentPosts } from "./_hooks/useContentPosts";

import { ProductPicker } from "./_components/ProductPicker";
import { GroupContentNotice } from "./_components/GroupContentNotice";
import { GroupComboPanel } from "./_components/GroupComboPanel";
import { PhotoPickerGrid } from "./_components/PhotoPickerGrid";
import { ContentSettingsFields } from "./_components/ContentSettingsFields";
import { PosterPanel } from "./_components/PosterPanel";
import { CaptionResultPanel } from "./_components/CaptionResultPanel";
import { CalendarPanel } from "./_components/CalendarPanel";
import { PostsList } from "./_components/PostsList";

export default function ContentStudioPage() {
  const [theme, setTheme] = useState<ContentPostTheme>("brand_awareness");
  const [extraNotes, setExtraNotes] = useState("");

  const productSelection = useProductSelection();
  const { selectedProduct, isGroupContent, selectedProducts } = productSelection;

  const photoSelection = usePhotoSelection();
  const marketingPhotos = useMarketingPhotos(selectedProduct?.kode, theme, extraNotes);
  const posterAi = usePosterAi(selectedProduct, theme, extraNotes, marketingPhotos.applyHeadlineSceneIdea);
  const groupCombo = useGroupCombo(selectedProducts, theme, extraNotes);

  // Foto final post ini — mode grup pakai hasil "Foto Gabungan Grup",
  // mode 1-produk pakai foto individual (dengan override AI kalau ada).
  const finalImageUrls = isGroupContent
    ? groupCombo.resultUrls
    : photoSelection.selectedPhotoUrls.map(marketingPhotos.effectivePhotoUrl);

  const additionalProductKodes = isGroupContent ? selectedProducts.slice(1).map((p) => p.kode) : [];
  const contentPosts = useContentPosts();
  const captionGen = useCaptionGeneration(
    selectedProduct,
    theme,
    photoSelection.contentType,
    extraNotes,
    additionalProductKodes,
    isGroupContent,
    () => {
      contentPosts.loadPosts();
      groupCombo.resetAll();
    }
  );
  const calendar = useCalendar(contentPosts.loadPosts);

  // Reset semua state turunan produk primer HANYA saat kode produk primer
  // itu sendiri berubah — bukan setiap kali selectedProducts berubah,
  // supaya milih/lepas produk ke-2..5 tidak menghapus progres yang sudah
  // digenerate utk primer (lihat useProductSelection.selectProduct).
  useEffect(() => {
    photoSelection.setSelectedPhotoUrls(selectedProduct?.image ? [selectedProduct.image] : []);
    captionGen.resetAll();
    posterAi.resetAll();
    marketingPhotos.resetAll();
    groupCombo.resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.kode]);

  // Format konten otomatis kepromosikan ke Carousel begitu 2+ foto cerita
  // grup terkumpul (mirror dari usePhotoSelection utk mode 1-produk).
  useEffect(() => {
    if (groupCombo.resultUrls.length > 1 && photoSelection.contentType === "feed_single") {
      photoSelection.setContentTypeChecked("carousel");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCombo.resultUrls.length]);

  function usePosterAsPhoto() {
    if (!posterAi.posterPreviewUrl) return;
    if (isGroupContent) {
      groupCombo.overrideSceneUrl(0, posterAi.posterPreviewUrl);
    } else {
      photoSelection.setSelectedPhotoUrls((prev) => [posterAi.posterPreviewUrl as string, ...prev.slice(1)]);
    }
    toast.success("Poster dipakai sebagai foto post");
  }

  const canGenerate = !!selectedProduct && finalImageUrls.length > 0 && !captionGen.generating;
  const canSaveDraft = !!captionGen.generatedCaption && finalImageUrls.length > 0 && !captionGen.savingDraft;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketing"
        title="Content Studio"
        description="Generate caption & hashtag Instagram dari foto produk yang sudah ada, atur kalender bulanan, lalu publish langsung atau salin manual."
      />

      {!contentPosts.instagramConfigured && (
        <div className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-text-muted">
          <span className="font-medium text-gold-soft">Instagram belum terhubung.</span> Caption &
          kalender tetap bisa digenerate penuh — tinggal disalin manual. Publish langsung baru bisa
          jalan setelah Meta App Review disetujui (butuh akun Instagram Business + Meta Developer App),
          lalu isi <code className="text-xs">INSTAGRAM_ACCESS_TOKEN</code> &{" "}
          <code className="text-xs">INSTAGRAM_BUSINESS_ACCOUNT_ID</code> di <code className="text-xs">.env</code> — lihat README.
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Generate Caption</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <ProductPicker
              productQuery={productSelection.productQuery}
              onQueryChange={productSelection.setProductQuery}
              productResults={productSelection.productResults}
              loadingProducts={productSelection.loadingProducts}
              selectedProducts={selectedProducts}
              onSelect={productSelection.selectProduct}
            />

            {isGroupContent && (
              <GroupContentNotice products={selectedProducts} onRemove={productSelection.removeProduct} />
            )}

            {isGroupContent && (
              <GroupComboPanel
                productCount={selectedProducts.length}
                readySourceCount={groupCombo.readySourceCount}
                sceneCount={groupCombo.sceneCount}
                onSceneCountChange={groupCombo.changeSceneCount}
                scenes={groupCombo.scenes}
                onSceneIdeaChange={groupCombo.updateSceneIdea}
                generatingStory={groupCombo.generatingStory}
                onSuggestStory={groupCombo.handleSuggestStory}
                onGenerateScene={groupCombo.handleGenerateScene}
              />
            )}

            {selectedProduct && !isGroupContent && (
              <PhotoPickerGrid
                options={productSelection.photoOptions}
                selectedUrls={photoSelection.selectedPhotoUrls}
                contentType={photoSelection.contentType}
                onToggle={photoSelection.togglePhoto}
              />
            )}

            {selectedProduct && (
              <>
                <ContentSettingsFields
                  contentType={photoSelection.contentType}
                  onContentTypeChange={photoSelection.setContentTypeChecked}
                  theme={theme}
                  onThemeChange={setTheme}
                  extraNotes={extraNotes}
                  onExtraNotesChange={setExtraNotes}
                />

                <PosterPanel
                  isGroupContent={isGroupContent}
                  posterHeadline={posterAi.posterHeadline}
                  suggestingHeadline={posterAi.suggestingHeadline}
                  onSuggestHeadline={posterAi.handleSuggestHeadline}
                  onUpdateLine={posterAi.updatePosterLine}
                  onAddLine={posterAi.addPosterLine}
                  onRemoveLine={posterAi.removePosterLine}
                  sceneIdea={marketingPhotos.sceneIdea}
                  selectedPhotoUrls={isGroupContent ? [] : photoSelection.selectedPhotoUrls}
                  marketingOverrides={marketingPhotos.marketingOverrides}
                  slotSceneIdea={marketingPhotos.slotSceneIdea}
                  onSlotSceneIdeaChange={marketingPhotos.updateSlotSceneIdea}
                  onGenerateSlot={marketingPhotos.handleGenerateMarketingPhoto}
                  onResetSlot={marketingPhotos.resetMarketingOverride}
                  generatingStoryboard={marketingPhotos.generatingStoryboard}
                  onSuggestStoryboard={() => marketingPhotos.handleSuggestStoryboard(photoSelection.selectedPhotoUrls)}
                  posterSubtitle={posterAi.posterSubtitle}
                  onSubtitleChange={(v) => {
                    posterAi.setPosterSubtitle(v);
                    posterAi.setPosterPreviewUrl(null);
                  }}
                  showBottomCaption={posterAi.showBottomCaption}
                  onShowBottomCaptionChange={(v) => {
                    posterAi.setShowBottomCaption(v);
                    posterAi.setPosterPreviewUrl(null);
                  }}
                  posterBottomCaption={posterAi.posterBottomCaption}
                  onBottomCaptionChange={(v) => {
                    posterAi.setPosterBottomCaption(v);
                    posterAi.setPosterPreviewUrl(null);
                  }}
                  generatingBottomCaption={posterAi.generatingBottomCaption}
                  onRegenerateBottomCaption={posterAi.handleRegenerateBottomCaption}
                  showProductCode={posterAi.showProductCode}
                  onShowProductCodeChange={(v) => {
                    posterAi.setShowProductCode(v);
                    posterAi.setPosterPreviewUrl(null);
                  }}
                  showColors={posterAi.showColors}
                  onShowColorsChange={(v) => {
                    posterAi.setShowColors(v);
                    posterAi.setPosterPreviewUrl(null);
                  }}
                  posterColorsCount={posterAi.posterColors.length}
                  renderingPoster={posterAi.renderingPoster}
                  onRenderPoster={() => {
                    if (!selectedProduct || finalImageUrls.length === 0) return;
                    posterAi.handleRenderPoster(finalImageUrls[0], selectedProduct.kode);
                  }}
                  posterPreviewUrl={posterAi.posterPreviewUrl}
                  onUsePosterAsPhoto={usePosterAsPhoto}
                />

                <Button type="button" loading={captionGen.generating} disabled={!canGenerate} onClick={captionGen.handleGenerateCaption}>
                  <Sparkles className="h-4 w-4" />
                  {captionGen.generatedCaption ? "Generate Ulang" : "Generate Caption"}
                </Button>

                {captionGen.generatedCaption && (
                  <CaptionResultPanel
                    caption={captionGen.generatedCaption}
                    onCaptionChange={captionGen.setGeneratedCaption}
                    hashtags={captionGen.generatedHashtags}
                    onHashtagsChange={captionGen.setGeneratedHashtags}
                    savingDraft={captionGen.savingDraft}
                    canSave={canSaveDraft}
                    onSaveDraft={() => captionGen.handleSaveDraft(finalImageUrls)}
                  />
                )}
              </>
            )}
          </CardBody>
        </Card>

        <CalendarPanel
          monthStart={calendar.monthStart}
          onMonthStartChange={calendar.setMonthStart}
          postsPerWeek={calendar.postsPerWeek}
          onPostsPerWeekChange={calendar.setPostsPerWeek}
          generatingCalendar={calendar.generatingCalendar}
          onGenerate={calendar.handleGenerateCalendar}
        />
      </div>

      <PostsList
        posts={contentPosts.posts}
        loadingPosts={contentPosts.loadingPosts}
        editingId={contentPosts.editingId}
        editCaption={contentPosts.editCaption}
        onEditCaptionChange={contentPosts.setEditCaption}
        editHashtags={contentPosts.editHashtags}
        onEditHashtagsChange={contentPosts.setEditHashtags}
        onStartEdit={contentPosts.startEdit}
        onCancelEdit={() => contentPosts.setEditingId(null)}
        onSaveEdit={contentPosts.saveEdit}
        onSchedule={contentPosts.handleSchedule}
        onPublish={contentPosts.handlePublish}
        onDelete={contentPosts.handleDelete}
        onCopy={contentPosts.copyCaption}
        onDownload={(post) => contentPosts.downloadImage(post.image_urls[0], `${post.product_kode}-${post.id}.jpg`)}
        publishingId={contentPosts.publishingId}
        instagramConfigured={contentPosts.instagramConfigured}
      />
    </AppShell>
  );
}
