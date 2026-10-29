import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Round, RoundPhoto } from '../types';

const BUCKET = 'round-photos';
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

interface Props {
  round: Round;
  readOnly?: boolean;
  onBack: () => void;
}

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      // 아래 img 태그 방식으로 재시도
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

// 폰에서 먼저 줄여서 올린다: 긴 변 1600px, JPEG
async function shrinkImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, tw, th);
  if ('close' in img) img.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', JPEG_QUALITY);
  });
}

export default function RoundPhotos({ round, readOnly = false, onBack }: Props) {
  const [photos, setPhotos] = useState<RoundPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from('round_photos')
        .select('*')
        .eq('round_id', round.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoadError(true);
      } else {
        setPhotos((data ?? []) as RoundPhoto[]);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [round.id]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadError(null);
    setUploading({ done: 0, total: files.length });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUploadError('로그인 정보를 찾지 못했어요. 앱을 다시 열어 주세요.');
      setUploading(null);
      return;
    }

    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      try {
        const blob = await shrinkImage(files[i]);
        const path = `${user.id}/${round.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        const { data: row, error: insErr } = await supabase
          .from('round_photos')
          .insert({ round_id: round.id, user_id: user.id, path })
          .select()
          .single();
        if (insErr || !row) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr ?? new Error('insert');
        }
        setPhotos(prev => [...prev, row as RoundPhoto]);
      } catch {
        failed += 1;
      }
      setUploading({ done: i + 1, total: files.length });
    }

    if (failed > 0) {
      setUploadError(
        failed === files.length
          ? '사진을 올리지 못했어요. 사진 저장소가 아직 준비되지 않았거나 네트워크 문제일 수 있어요.'
          : `${files.length}장 중 ${failed}장을 올리지 못했어요.`,
      );
    }
    setUploading(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete() {
    if (viewerIndex === null) return;
    const target = photos[viewerIndex];
    if (!target) return;
    setDeleting(true);
    const { error: rowErr } = await supabase.from('round_photos').delete().eq('id', target.id);
    if (rowErr) {
      setDeleting(false);
      setConfirmDelete(false);
      setUploadError('사진을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    await supabase.storage.from(BUCKET).remove([target.path]);
    setPhotos(prev => prev.filter(p => p.id !== target.id));
    setDeleting(false);
    setConfirmDelete(false);
    setViewerIndex(prev => {
      if (prev === null) return null;
      const remaining = photos.length - 1;
      if (remaining <= 0) return null;
      return Math.min(prev, remaining - 1);
    });
  }

  function showPrev() {
    setViewerIndex(prev => (prev === null ? null : (prev - 1 + photos.length) % photos.length));
  }
  function showNext() {
    setViewerIndex(prev => (prev === null ? null : (prev + 1) % photos.length));
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || photos.length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (dx > 50) showPrev();
    else if (dx < -50) showNext();
  }

  const subtitle = [round.date, round.course_name].filter(Boolean).join(' · ');
  const viewerPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface flex items-center justify-center">
        <p className="text-gray-500 text-sm">불러오는 중..</p>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-surface flex flex-col overflow-hidden">
      <div className="bg-[#1B4332] text-white px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <button onClick={onBack} className="flex items-center gap-1 text-green-200 text-sm mb-3 active:opacity-70">
          <ChevronLeft size={16} />
          라운드 요약으로
        </button>
        <h2 className="text-xl font-bold">사진</h2>
        <p className="text-green-200 text-sm mt-1">{subtitle}{subtitle ? ' · ' : ''}{photos.length}장</p>
      </div>

      <div className="px-4 py-5 space-y-4 pb-28 overflow-y-auto flex-1">
        {loadError && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-500 text-sm">
            사진 목록을 불러오지 못했어요.
          </div>
        )}

        {!readOnly && (
          <input
            ref={fileInputRef}
            id="round-photo-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading !== null}
              className="aspect-square rounded-xl border-2 border-dashed border-[#1B4332] text-[#1B4332] font-semibold text-sm flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform disabled:opacity-60"
            >
              <Plus size={26} />
              {uploading ? `${uploading.done}/${uploading.total} 올리는 중` : '사진 추가'}
            </button>
          )}

          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewerIndex(i)}
              className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative active:opacity-80"
            >
              <img src={publicUrl(p.path)} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>

        {photos.length === 0 && !loadError && (
          <p className="text-center text-gray-400 text-sm">아직 사진이 없어요</p>
        )}

        {uploadError && (
          <p className="text-center text-red-500 text-sm">{uploadError}</p>
        )}
      </div>

      {viewerPhoto && (
        <div className="fixed inset-0 z-50 bg-black text-white flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="flex items-center justify-between px-4 text-sm" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}>
            <button onClick={() => setViewerIndex(null)} className="flex items-center gap-1 active:opacity-70">
              <X size={18} />
              닫기
            </button>
            <span className="opacity-80">{(viewerIndex ?? 0) + 1} / {photos.length}</span>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center px-2">
            <img src={publicUrl(viewerPhoto.path)} alt="" className="max-w-full max-h-full object-contain" />
          </div>

          <div className="flex items-center justify-between px-4 text-sm" style={{ paddingTop: '0.75rem', paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
            <span className="opacity-80">{formatDate(viewerPhoto.created_at)} 올림</span>
            <div className="flex items-center gap-4">
              {photos.length > 1 && (
                <>
                  <button onClick={showPrev} className="p-1 active:opacity-70" aria-label="이전 사진"><ChevronLeft size={22} /></button>
                  <button onClick={showNext} className="p-1 active:opacity-70" aria-label="다음 사진"><ChevronRight size={22} /></button>
                </>
              )}
              {!readOnly && (
                <button onClick={() => setConfirmDelete(true)} className="text-red-300 font-bold active:opacity-70">
                  삭제
                </button>
              )}
            </div>
          </div>

          {confirmDelete && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
              <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setConfirmDelete(false)} />
              <div className="relative bg-card rounded-2xl shadow-2xl p-6 w-full max-w-[340px] text-gray-800">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={22} className="text-red-500" />
                </div>
                <h3 className="text-base font-bold text-center mb-2">사진 삭제</h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
                  이 사진을 삭제할까요?<br />삭제한 사진은 복구할 수 없습니다.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(false)} disabled={deleting}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
                    취소
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50">
                    {deleting ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
