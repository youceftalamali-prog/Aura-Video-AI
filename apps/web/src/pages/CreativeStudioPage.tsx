import { useTranslation } from 'react-i18next';
import { useLanguage } from '../language/LanguageProvider';
import { useState, FormEvent, useEffect, useRef } from 'react';
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
import type {
  ProductAnalysis,
  CreativeStrategy,
  AdScript,
  Storyboard,
  TemplateRecommendation,
  VideoGenerationJobPublic,
} from '@aura/types';
import { api } from '../lib/api';

type Step = 'product' | 'strategy' | 'script' | 'storyboard' | 'template' | 'video';

export function CreativeStudioPage() {
  const { t } = useTranslation();
  const { contentLanguage, videoLanguage } = useLanguage();
  const [step, setStep] = useState<Step>('product');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [strategy, setStrategy] = useState<CreativeStrategy | null>(null);
  const [script, setScript] = useState<AdScript | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [recommendations, setRecommendations] = useState<TemplateRecommendation[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [projectId, setProjectId] = useState('');
  const [job, setJob] = useState<VideoGenerationJobPublic | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function analyzeProduct(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.analyzeProductText({ language: contentLanguage, contentLanguage, videoLanguage,  
        name: productName,
        description: productDescription,
      });
      setAnalysis(result);
      setStep('strategy');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ai.analysisFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function generateStrategy() {
    if (!analysis) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.generateStrategy({ language: contentLanguage, contentLanguage, videoLanguage,   productAnalysis: analysis });
      setStrategy(result);
      setStep('script');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creative.strategyFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function generateScript() {
    if (!analysis || !strategy) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.generateScript({ language: contentLanguage, contentLanguage, videoLanguage,  
        productAnalysis: analysis,
        creativeStrategy: strategy,
      });
      setScript(result);
      setStep('storyboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creative.scriptFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function generateStoryboard() {
    if (!script || !strategy) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.generateStoryboard({ language: contentLanguage, contentLanguage, videoLanguage,  
        adScript: script,
        creativeStrategy: strategy,
      });
      setStoryboard(result);
      setStep('template');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creative.storyboardFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function recommendTemplates() {
    if (!analysis || !strategy) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.recommendTemplate({ language: contentLanguage, contentLanguage, videoLanguage,  
        productAnalysis: analysis,
        creativeStrategy: strategy,
        limit: 5,
      });
      setRecommendations(result);
      if (result[0]) setSelectedTemplateId(result[0].templateId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creative.recommendationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function startVideo(e: FormEvent) {
    e.preventDefault();
    if (!storyboard || !projectId) {
      setError(t('common.projectIdRequired'));
      return;
    }
    setError(null);
    setLoading(true);
    setJob(null);
    try {
      const result = await api.generateVideo({ 
        projectId,
        templateId: selectedTemplateId ?? undefined,
        aspectRatio: storyboard.aspectRatio,
        duration: storyboard.duration,
        scenes: storyboard.scenes.map((s) => ({
          order: s.order,
          duration: s.duration,
          visualPrompt: s.visualPrompt,
          onScreenText: s.textOverlay,
          cameraDirection: s.cameraDirection,
        })),
      });
      setJob({
        id: result.jobId,
        status: result.status,
        progress: null,
        provider: 'none',
        currentStage: null, creditsCharged: 0, outputUrl: null,
        assetId: null,
        error: null,
        projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
      setStep('video');
      startPolling(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('creative.videoFailed'));
    } finally {
      setLoading(false);
    }
  }

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getVideoJob(jobId);
        setJob(status);
        if (
          status.status === 'completed' ||
          status.status === 'failed' ||
          status.status === 'canceled'
        ) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // keep last known status
      }
    }, 3000);
  }

  async function cancelJob() {
    if (!job) return;
    try {
      const status = await api.cancelVideoJob(job.id);
      setJob(status);
      if (pollRef.current) clearInterval(pollRef.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('billing.cancelFailed'));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">
              Aura Video AI
            </Link>
            <Badge variant="info">{t('creative.title')}</Badge>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/ai" className="text-slate-600 hover:text-slate-900">
              AI Studio
            </Link>
            <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('creative.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Product → Strategy → Script → {t('creative.storyboard')} → Template → Video job
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['product', t('creative.product')],
              ['strategy', t('creative.strategy')],
              ['script', t('creative.script')],
              ['storyboard', t('creative.storyboard')],
              ['template', t('creative.template')],
              ['video', t('creative.video')],
            ] as [Step, string][]
          ).map(([key, label]) => (
            <Badge key={key} variant={step === key ? 'info' : 'default'}>
              {label}
            </Badge>
          ))}
        </div>

        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {step === 'product' && (
          <Card>
            <CardHeader>
              <CardTitle>1. Product</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={analyzeProduct} className="space-y-4">
                <Input
                  label={t('common.productName')}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={4}
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" loading={loading}>
                  Analyze product
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {analysis && step !== 'product' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('ai.productColon')} {analysis.productName}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700">
              {analysis.shortDescription}
            </CardContent>
          </Card>
        )}

        {step === 'strategy' && analysis && (
          <Card>
            <CardHeader>
              <CardTitle>2. Creative Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={generateStrategy} loading={loading}>
                Generate strategy
              </Button>
            </CardContent>
          </Card>
        )}

        {strategy && (
          <Card>
            <CardHeader>
              <CardTitle>{t('creative.strategy')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>{t('creative.hookColon')}</strong> {strategy.hook}
              </p>
              <p>
                <strong>{t('creative.angleColon')}</strong> {strategy.creativeAngle}
              </p>
              <p>
                <strong>{t('creative.messageColon')}</strong> {strategy.keyMessage}
              </p>
              <p>
                <strong>{t('creative.durationColon')}</strong> {strategy.suggestedDuration}s · {strategy.suggestedAspectRatio}
              </p>
              {step === 'script' && (
                <Button className="mt-2" onClick={generateScript} loading={loading}>
                  {t('creative.generateScript')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {script && (
          <Card>
            <CardHeader>
              <CardTitle>Script ({script.duration}s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {script.scenes.map((s) => (
                <div key={s.order} className="rounded border border-slate-100 p-3">
                  <p className="font-medium">
                    Scene {s.order} · {s.duration}s
                  </p>
                  <p className="text-slate-600">{s.narration}</p>
                  <p className="text-slate-500">{s.visualDescription}</p>
                </div>
              ))}
              {step === 'storyboard' && (
                <Button onClick={generateStoryboard} loading={loading}>
                  {t('creative.generateStoryboard')}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {storyboard && (
          <Card>
            <CardHeader>
              <CardTitle>{t('creative.storyboard')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {storyboard.scenes.map((s) => (
                <div key={s.sceneId} className="rounded border border-slate-100 p-3">
                  <p className="font-medium">
                    #{s.order} · {s.duration}s · {s.cameraDirection}
                  </p>
                  <p className="text-slate-600">{s.visualPrompt}</p>
                </div>
              ))}
              {step === 'template' && (
                <Button onClick={recommendTemplates} loading={loading}>
                  Recommend templates
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('creative.templateRecommendations')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.map((r) => (
                <button
                  key={r.templateId}
                  type="button"
                  onClick={() => setSelectedTemplateId(r.templateId)}
                  className={`w-full rounded-lg border p-3 text-start text-sm ${
                    selectedTemplateId === r.templateId
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.name ?? r.templateId}</span>
                    <Badge variant={r.fit === 'excellent' ? 'success' : 'default'}>
                      {r.fit} · {Math.round(r.score * 100)}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-slate-500">{r.reason}</p>
                </button>
              ))}
              <form onSubmit={startVideo} className="space-y-3 pt-2">
                <Input
                  label="Project ID (UUID from your workspace)"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                  hint={t('creative.projectIdHint')}
                />
                <Button type="submit" loading={loading}>
                  Generate video
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {job && (
          <Card>
            <CardHeader>
              <CardTitle>{t('creative.videoGenerationJob')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    job.status === 'completed'
                      ? 'success'
                      : job.status === 'failed'
                        ? 'danger'
                        : 'info'
                  }
                >
                  {job.status}
                </Badge>
                {job.progress !== null && <Badge variant="default">{job.progress}%</Badge>}
              </div>
              <p className="text-slate-600">Job ID: {job.id}</p>
              {job.error && <Alert variant="error">{job.error}</Alert>}
              {job.outputUrl && (
                <div>
                  <p className="mb-2 font-medium">{t('common.output')}</p>
                  <video src={job.outputUrl} controls className="max-h-80 w-full rounded-lg bg-black" />
                  <a
                    href={job.outputUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-indigo-600"
                  >
                    {t('library.openVideo')}
                  </a>
                </div>
              )}
              {(job.status === 'queued' || job.status === 'processing') && (
                <div className="flex items-center gap-3">
                  <Spinner size="sm" />
                  <span className="text-slate-500">{t('creative.pollingStatus')}</span>
                  <Button variant="outline" size="sm" onClick={cancelJob}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading && step !== 'product' && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
      </main>
    </div>
  );
}
