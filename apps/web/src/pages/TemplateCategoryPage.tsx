import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, Alert, Spinner, Badge } from '@aura/ui';
import type { LibraryTemplate } from '@aura/types';
import { api } from '../lib/api';

function TemplateCard({ template }: { template: LibraryTemplate }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);

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
    <Link to={`/templates/view/${template.slug}`} className="block">
      <Card
        className="overflow-hidden transition hover:shadow-md"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className="relative aspect-[9/16] bg-slate-900">
          {template.hasRealPreview && template.previewVideoUrl ? (
            <video
              ref={videoRef}
              src={template.previewVideoUrl}
              muted
              playsInline
              loop
              className="h-full w-full object-cover"
              preload="none"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-300">
              <span className="text-sm font-medium">{template.name}</span>
              <span className="text-xs text-slate-500">{t('templates.previewPlaceholder')}</span>
            </div>
          )}
          <div className="absolute bottom-2 start-2 end-2 flex justify-between">
            <Badge variant="default">{template.durationSeconds ?? 0}s</Badge>
            <Badge variant="info">{template.aspectRatio}</Badge>
          </div>
        </div>
        <CardContent className="space-y-1 p-3">
          <p className="text-sm font-medium text-slate-900">{template.name}</p>
          <p className="line-clamp-2 text-xs text-slate-500">{template.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function TemplateCategoryPage() {
  const { t } = useTranslation();
  const { category } = useParams<{ category: string }>();
  const [items, setItems] = useState<LibraryTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    api
      .listTemplatesByCategory(category)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failed')))
      .finally(() => setLoading(false));
  }, [category, t]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/templates" className="text-sm text-indigo-600">
            ← {t('templates.categories')}
          </Link>
          <Link to="/dashboard" className="text-lg font-bold text-indigo-600">
            Aura Video AI
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold capitalize text-slate-900">
            {category} {t('templates.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('templates.categoryDesc')}</p>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        {loading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
        {!loading && items.length === 0 && (
          <p className="text-slate-500">{t('templates.noPublished')}</p>
        )}
      </main>
    </div>
  );
}
