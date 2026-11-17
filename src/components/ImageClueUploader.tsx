import { useCallback, useRef, useState } from 'react';
import { ImageIcon, Loader2, ScanLine, X } from 'lucide-react';
import type { ClueCategory } from '../types/mystery.ts';
import type { DetectiveCase } from '../types/mystery.ts';

interface ImageClueAnalysis {
  title: string;
  detail: string;
  category: ClueCategory;
  imageDataUrl: string;
}

interface ImageClueUploaderProps {
  activeCase: DetectiveCase;
  isBusy: boolean;
  onImageClueAnalyzed: (analysis: ImageClueAnalysis) => void;
  onCancel: () => void;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix — only send raw base64 to the server
      const base64 = result.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function ImageClueUploader({
  activeCase,
  isBusy,
  onImageClueAnalyzed,
  onCancel,
}: ImageClueUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported (JPEG, PNG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 5 MB. Please compress or crop it first.');
      return;
    }
    setSelectedFile(file);
    const dataUrl = await fileToDataUrl(file);
    setPreviewUrl(dataUrl);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile || !previewUrl || isAnalyzing || isBusy) return;
    setError(null);
    setIsAnalyzing(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      const res = await fetch('/api/clue/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: selectedFile.type,
          caseData: activeCase,
        }),
      });
      const data = await res.json() as {
        title?: string;
        detail?: string;
        category?: ClueCategory;
        error?: string;
      };
      if (!res.ok || !data.title) {
        throw new Error(data.error ?? 'Image analysis failed.');
      }
      onImageClueAnalyzed({
        title: data.title,
        detail: data.detail ?? '',
        category: data.category ?? 'physical',
        imageDataUrl: previewUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not analyze the image.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile, previewUrl, isAnalyzing, isBusy, activeCase, onImageClueAnalyzed]);

  const handleClear = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      {!previewUrl ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
            isDragging
              ? 'border-[#C9A45C] bg-[#C9A45C]/5'
              : 'border-[#C9A45C]/25 bg-[#0B0A09] hover:border-[#C9A45C]/60 hover:bg-[#C9A45C]/5'
          }`}
        >
          <ImageIcon className="w-8 h-8 text-[#C9A45C]/60" />
          <div className="text-center space-y-1">
            <p className="text-sm text-[#E8DEC8]">
              Drop a crime-scene photo or sketch
            </p>
            <p className="text-xs text-[#9C9281]">
              JPEG, PNG, WebP, GIF · Max 5 MB · Click to browse
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleInputChange}
          />
        </div>
      ) : (
        /* Preview + Analyze */
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border border-[#C9A45C]/25 bg-[#0B0A09]">
            <img
              src={previewUrl}
              alt="Selected crime-scene image"
              className="w-full max-h-56 object-contain"
            />
            {/* Shimmer overlay while analyzing */}
            {isAnalyzing && (
              <div className="absolute inset-0 bg-[#0B0A09]/75 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-[#C9A45C] animate-spin" />
                <p className="text-xs font-mono text-[#C9A45C]">
                  Raazi is examining the evidence…
                </p>
                <div className="w-48 space-y-1.5">
                  <div className="h-2 bg-[#C9A45C]/20 rounded animate-pulse" />
                  <div className="h-2 bg-[#C9A45C]/15 rounded animate-pulse w-4/5" />
                  <div className="h-2 bg-[#C9A45C]/10 rounded animate-pulse w-3/5" />
                </div>
              </div>
            )}
            {/* Clear button */}
            {!isAnalyzing && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-2 right-2 p-1.5 bg-[#0B0A09]/80 border border-[#C9A45C]/25 rounded-md text-[#9C9281] hover:text-[#E8DEC8] transition-colors cursor-pointer"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={isAnalyzing || isBusy}
              className="flex-1 py-2.5 px-4 text-sm font-semibold bg-[#C9A45C] text-[#0B0A09] rounded-md hover:bg-[#d8b671] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ScanLine className="w-4 h-4" />
              <span>{isAnalyzing ? 'Analyzing…' : 'Analyze with Gemini'}</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isAnalyzing}
              className="px-4 py-2.5 text-sm font-medium border border-[#C9A45C]/25 text-[#9C9281] hover:text-[#E8DEC8] rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-[#B54842] px-1">{error}</p>
      )}
    </div>
  );
}
