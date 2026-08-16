import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryTemplate } from '@aura/types';

const FORMATS = ['9:16', '1:1', '16:9'];

function useTemplateUrl(template: LibraryTemplate): string {
  return `/dashboard?template=${encodeURIComponent(template.slug)}`;
}

export function TemplatePhoneCard({ template, showSupportedFormats = true }: { template: LibraryTemplate; showSupportedFormats?: boolean }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  const url = useTemplateUrl(template);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !template.previewVideoUrl || !template.hasRealPreview) return;
    if (hover) v.play().catch(() => undefined);
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hover, template]);

  return (
    <div className="group flex flex-col gap-2">
      <Link
        to={url}
        aria-label={template.name}
        className="text-center"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <div className="aura-phone mx-auto w-40 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_60px_-12px_rgba(168,85,247,0.45)] sm:w-44">
          <div className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25" />
          <div className={`aspect-[9/16] ${hover ? 'bg-black' : 'bg-gradient-to-br from-zinc-900 via-[#171225] to-black'}`}>
            {template.hasRealPreview && template.previewVideoUrl ? (
              <video
                ref={videoRef}
                src={template.previewVideoUrl}
                muted
                playsInline
                loop
                preload="none"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col justify-end p-3 text-left">
                <span className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-300/90">{template.category}</span>
                <span className="mt-0.5 text-sm font-semibold leading-snug text-white drop-shadow">{template.name}</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-100">
                    {template.durationSeconds ?? 0}s
                  </span>
                  <span className="rounded bg-fuchsia-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-100">
                    {template.aspectRatio}
                  </span>
                </div>
              </div>
            )}
            {hover && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur transition group-hover:scale-110">
                  <span className="ml-0.5 text-sm text-white">▶</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      <div className="text-center">
        <p className="mx-auto max-w-[11rem] truncate text-[13px] font-semibold text-white" title={template.name}>
          {template.name}
        </p>
        <p className="text-[11px] capitalize text-violet-300/70">{template.category}</p>
        {showSupportedFormats && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            {FORMATS.map((f) => (
              <span
                key={f}
                className={
                  f === template.aspectRatio
                    ? 'rounded bg-fuchsia-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-100'
                    : 'rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium text-violet-300/60'
                }
              >
                {f}
              </span>
            ))}
          </div>
        )}
        {template.isPremium && (
          <span className="mt-1 inline-block rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
            {t('templates.premium', { defaultValue: 'Premium' })}
          </span>
        )}
      </div>

      <Link
        to={url}
        className="aura-btn-primary w-full px-3 py-2 text-xs opacity-90 transition group-hover:opacity-100"
        aria-label={`${t('templates.useTemplate', { defaultValue: 'Use template' })} — ${template.name}`}
      >
        {t('templates.useTemplate', { defaultValue: 'Use template' })} →
      </Link>
    </div>
  );
}