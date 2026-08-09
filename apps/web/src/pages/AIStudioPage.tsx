import { useTranslation } from 'react-i18next';
import { useLanguage } from '../language/LanguageProvider';
import { useState, FormEvent, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  Spinner,
  Badge,
} from '@aura/ui';
import type { ProductAnalysis, AIAssistantResponse } from '@aura/types';
import { api } from '../lib/api';

type SourceMode = 'text' | 'url' | 'image';

export function AIStudioPage() {
  const { t } = useTranslation();
  const { aiOutputLanguage, contentLanguage } = useLanguage();
  const [mode, setMode] = useState<SourceMode>('text');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);

  const [assistantMessage, setAssistantMessage] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantResult, setAssistantResult] = useState<AIAssistantResponse | null>(null);

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAnalysis(null);
    setAssistantResult(null);
    setLoading(true);
    try {
      if (mode === 'text') {
        const result = await api.analyzeProductText({ language: contentLanguage, contentLanguage,   name, description });
        setAnalysis(result);
      } else if (mode === 'url') {
        const result = await api.analyzeProductUrl({ language: contentLanguage, contentLanguage,   url });
        setAnalysis(result.analysis);
      } else {
        const result = await api.analyzeProductImage({ language: contentLanguage, contentLanguage,  
          imageUrl: imageUrl || undefined,
          imageBase64: imageBase64 || undefined,
          mimeType,
          name: name || undefined,
          description: description || undefined,
        });
        setAnalysis(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ai.analysisFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAssistant(e: FormEvent) {
    e.preventDefault();
    setAssistantError(null);
    setAssistantResult(null);
    setAssistantLoading(true);
    try {
      const result = await api.aiAssistant({ 
        language: aiOutputLanguage, aiOutputLanguage, contentLanguage,
        message: assistantMessage,
        productAnalysis: analysis ?? undefined,
      });
      setAssistantResult(result);
    } catch (err) {
      setAssistantError(err instanceof Error ? err.message : t('ai.assistantFailed'));
    } finally {
      setAssistantLoading(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1]! : result;
      setImageBase64(base64);
      setImageUrl('');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">
              Aura Video AI
            </Link>
            <Badge variant="info">{t('ai.title')}</Badge>
          </div>
          <Link to="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('ai.productStudio')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('ai.analyzeIntro')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('ai.productSource')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['text', 'url', 'image'] as SourceMode[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={mode === m ? 'primary' : 'outline'}
                  onClick={() => setMode(m)}
                >
                  {m === 'text' ? t('common.text') : m === 'url' ? t('common.productUrl') : t('common.image')}
                </Button>
              ))}
            </div>

            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}

            <form onSubmit={handleAnalyze} className="space-y-4">
              {mode === 'text' && (
                <>
                  <Input
                    label={t('common.productName')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={300}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Description
                    </label>
                    <textarea
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      maxLength={8000}
                    />
                  </div>
                </>
              )}

              {mode === 'url' && (
                <Input
                  label={t('common.productUrl')}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="https://example.com/product"
                />
              )}

              {mode === 'image' && (
                <>
                  <Input
                    label="Image URL (optional)"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => {
                      setImageUrl(e.target.value);
                      setImageBase64(null);
                    }}
                    placeholder="https://..."
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Or upload image
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-slate-600"
                    />
                    {imageBase64 && (
                      <p className="mt-1 text-xs text-emerald-600">{t('ai.imageLoaded')}</p>
                    )}
                  </div>
                  <Input
                    label="Product name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Notes (optional)
                    </label>
                    <textarea
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button type="submit" loading={loading} disabled={loading}>
                Analyze Product
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-600">
            <Spinner /> Analyzing with AI…
          </div>
        )}

        {analysis && !loading && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('ai.productAnalysis')}</CardTitle>
                <Badge variant="success">
                  Confidence {Math.round(analysis.confidence * 100)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-500">{t('common.name')}</p>
                <p className="text-lg font-semibold text-slate-900">{analysis.productName}</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">{t('ai.shortDescription')}</p>
                <p className="text-slate-800">{analysis.shortDescription}</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">{t('common.category')}</p>
                <p>{analysis.category}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListBlock title={t('ai.targetAudience')} items={analysis.targetAudience} />
                <ListBlock title={t('ai.keyBenefits')} items={analysis.keyBenefits} />
                <ListBlock title={t('ai.features')} items={analysis.features} />
                <ListBlock title={t('ai.sellingPoints')} items={analysis.sellingPoints} />
                <ListBlock title={t('ai.keywords')} items={analysis.keywords} />
                <ListBlock title={t('ai.adAngles')} items={analysis.suggestedAdAngles} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-slate-500">{t('ai.brandTone')}</p>
                  <p>{analysis.brandTone}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-500">{t('ai.visualStyle')}</p>
                  <p>{analysis.visualStyle}</p>
                </div>
              </div>
              <div>
                <p className="font-medium text-slate-500">{t('ai.callToAction')}</p>
                <p className="font-semibold text-indigo-700">{analysis.callToAction}</p>
              </div>
              <div>
                <p className="font-medium text-slate-500">{t('ai.longDescription')}</p>
                <p className="whitespace-pre-wrap text-slate-700">{analysis.longDescription}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('ai.assistant')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-slate-500">
              What do you want to create? Example: &quot;أريد فيديو إعلاني احترافي لهذا المنتج&quot;
            </p>
            {assistantError && (
              <Alert variant="error" className="mb-4">
                {assistantError}
              </Alert>
            )}
            <form onSubmit={handleAssistant} className="space-y-4">
              <textarea
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
                value={assistantMessage}
                onChange={(e) => setAssistantMessage(e.target.value)}
                required
                maxLength={4000}
                placeholder="Describe what you want to create…"
              />
              <Button type="submit" loading={assistantLoading} variant="secondary">
                Detect intent
              </Button>
            </form>

            {assistantResult && (
              <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info">{assistantResult.intent.intent}</Badge>
                  {assistantResult.intent.requestedFormat && (
                    <Badge variant="default">{assistantResult.intent.requestedFormat}</Badge>
                  )}
                  <Badge variant="success">
                    {Math.round(assistantResult.intent.confidence * 100)}% confidence
                  </Badge>
                </div>
                <p>
                  <span className="font-medium text-slate-500">{t('ai.summaryColon')} </span>
                  {assistantResult.intent.summary}
                </p>
                <p>
                  <span className="font-medium text-slate-500">{t('ai.productColon')} </span>
                  {assistantResult.product?.productName ?? '—'}
                </p>
                <p>
                  <span className="font-medium text-slate-500">{t('ai.nextStepColon')} </span>
                  {assistantResult.recommendedNextStep}
                </p>
                <p className="text-slate-700">{assistantResult.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 font-medium text-slate-500">{title}</p>
      <ul className="list-inside list-disc space-y-0.5 text-slate-800">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
