import { useTranslation } from 'react-i18next';
import { useLanguage } from '../language/LanguageProvider';
import { useState, FormEvent, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Alert, Spinner, Badge } from '@aura/ui';
import type { ProductAnalysis, CreativeStrategy, Storyboard, VideoGenerationJobPublic, VideoCostEstimate, AspectRatio } from '@aura/types';
import { api } from '../lib/api';
import { VideoResultCard } from '../components/VideoResultCard';

export function VideoStudioPage() {
  const { t } = useTranslation();
  const { videoLanguage, contentLanguage } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [strategy, setStrategy] = useState<CreativeStrategy | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [projectId, setProjectId] = useState('');
  const [estimate, setEstimate] = useState<VideoCostEstimate | null>(null);
  const [job, setJob] = useState<VideoGenerationJobPublic | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [brandName, setBrandName] = useState('');
  const [templates, setTemplates] = useState<{ id: string; name: string; platform: string; aspectRatio: string }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [captionPreview, setCaptionPreview] = useState<string | null>(null);

  useEffect(() => {
    api.getBrandKit().then((b) => setBrandName(b.brandName)).catch(() => undefined);
    api.listStudioTemplates().then((list) => setTemplates(list.map((x) => ({ id: x.id, name: x.name, platform: x.platform, aspectRatio: x.aspectRatio })))).catch(() => undefined);
  }, []);


  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function analyze(e: FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const a = await api.analyzeProductText({ language: videoLanguage, contentLanguage, videoLanguage,   name, description });
      setAnalysis(a);
      const s = await api.generateStrategy({ language: videoLanguage, contentLanguage, videoLanguage,   productAnalysis: a });
      setStrategy(s);
      const script = await api.generateScript({ language: videoLanguage, contentLanguage, videoLanguage,   productAnalysis: a, creativeStrategy: s });
      const sb = await api.generateStoryboard({ language: videoLanguage, contentLanguage, videoLanguage,   adScript: script, creativeStrategy: s, aspectRatio });
      setStoryboard(sb);
      setAspectRatio(sb.aspectRatio);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('video.pipelineFailed'));
    } finally { setLoading(false); }
  }

  async function runEstimate() {
    if (!storyboard) return;
    setError(null);
    try {
      const est = await api.estimateVideoCost({ 
        duration: storyboard.duration,
        scenes: storyboard.scenes.map((s) => ({ order: s.order, duration: s.duration, visualPrompt: s.visualPrompt })),
        mode: imageUrl ? 'image_to_video' : 'storyboard',
        sourceImageUrl: imageUrl || undefined,
      });
      setEstimate(est);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('video.estimateFailed'));
    }
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (!storyboard || !projectId) { setError(t('video.projectIdRequired')); return; }
    setError(null); setLoading(true); setJob(null);
    try {
      const result = await api.generateVideo({ language: videoLanguage, contentLanguage, videoLanguage,  
        projectId,
        aspectRatio,
        duration: storyboard.duration,
        mode: imageUrl ? 'image_to_video' : 'storyboard',
        sourceImageUrl: imageUrl || undefined,
        scenes: storyboard.scenes.map((s) => ({
          order: s.order,
          duration: s.duration,
          visualPrompt: s.visualPrompt,
          onScreenText: s.textOverlay,
          cameraDirection: s.cameraDirection,
          imageUrl: imageUrl || undefined,
        })),
        idempotencyKey: `web-${projectId}-${Date.now()}`,
      });
      setJob({
        id: result.jobId, status: result.status, progress: null, currentStage: 'queued',
        provider: 'openai', outputUrl: null, assetId: null, error: null, projectId,
        creditsCharged: result.creditsCharged, createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), completedAt: null,
      });
      startPolling(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates.generationFailed'));
    } finally { setLoading(false); }
  }

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getVideoJob(jobId);
        setJob(status);
        if (['completed', 'failed', 'canceled'].includes(status.status) && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch { /* keep last */ }
    }, 3000);
  }

  async function cancel() {
    if (!job) return;
    try {
      const s = await api.cancelVideoJob(job.id);
      setJob(s);
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
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
            <Badge variant="info">{t('video.title')}</Badge>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/ai" className="text-slate-600 hover:text-slate-900">AI</Link>
            <Link to="/creative" className="text-slate-600 hover:text-slate-900">{t('nav.creative')}</Link>
            <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">{t('nav.dashboard')}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('video.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('video.analyzeBuild')}</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <Card>
          <CardHeader><CardTitle>1. Product input</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={analyze} className="space-y-4">
              <Input label={t('common.productName')} value={name} onChange={(e) => setName(e.target.value)} required />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('common.description')}</label>
                <textarea className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>
              <Input label="Product image URL (optional, enables image-to-video)" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <Button type="submit" loading={loading}>{t('video.analyzeBuild')}</Button>
            </form>
          </CardContent>
        </Card>


        <Card>
          <CardHeader><CardTitle>{t('common.brandKit')}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Input label={t('common.brandName')} value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            <Button type="button" variant="secondary" size="sm" onClick={async () => {
              try { await api.updateBrandKit({  brandName }); } catch (err) { setError(err instanceof Error ? err.message : t('video.brandUpdateFailed')); }
            }}>{t('video.saveBrand')}</Button>
          </CardContent>
        </Card>

        {templates.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{t('templates.title')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {templates.map((tpl) => (
                <button key={tpl.id} type="button" onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`w-full rounded-lg border p-3 text-start text-sm ${selectedTemplateId === tpl.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                  <span className="font-medium">{tpl.name}</span>
                  <span className="ms-2 text-slate-500">{tpl.platform} · {tpl.aspectRatio}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {storyboard && (
          <Card>
            <CardHeader><CardTitle>{t('video.voiceAndCaptions')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3}
                placeholder={t('video.voiceoverScript')} value={voiceText} onChange={(e) => setVoiceText(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={async () => {
                  try {
                    const v = await api.generateVoice({ language: videoLanguage, contentLanguage, videoLanguage,   text: voiceText || storyboard.scenes.map(s => s.textOverlay || s.visualPrompt).join('. ') });
                    setVoiceUrl(v.url);
                  } catch (err) { setError(err instanceof Error ? err.message : t('video.voiceFailed')); }
                }}>{t('video.generateVoice')}</Button>
                <Button type="button" size="sm" variant="outline" onClick={async () => {
                  try {
                    const text = voiceText || storyboard.scenes.map(s => s.textOverlay || '').filter(Boolean).join('. ');
                    const c = await api.captionsFromText({  text, totalDuration: storyboard.duration });
                    setCaptionPreview(`${c.segments.length} caption segments`);
                  } catch (err) { setError(err instanceof Error ? err.message : t('video.captionsFailed')); }
                }}>{t('video.buildCaptions')}</Button>
              </div>
              {voiceUrl && <audio controls src={voiceUrl} className="w-full" />}
              {captionPreview && <p className="text-sm text-slate-600">{captionPreview}</p>}
            </CardContent>
          </Card>
        )}

        {analysis && (
          <Card>
            <CardHeader><CardTitle>{t('ai.productColon')} {analysis.productName}</CardTitle></CardHeader>
            <CardContent className="text-sm">{analysis.shortDescription}</CardContent>
          </Card>
        )}

        {strategy && (
          <Card>
            <CardHeader><CardTitle>{t('creative.strategy')}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>{t('creative.hookColon')}</strong> {strategy.hook}</p>
              <p><strong>{t('video.ctaColon')}</strong> {strategy.callToAction}</p>
            </CardContent>
          </Card>
        )}

        {storyboard && (
          <Card>
            <CardHeader><CardTitle>Storyboard ({storyboard.scenes.length} scenes)</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {storyboard.scenes.map((s) => (
                <div key={s.sceneId} className="rounded border border-slate-100 p-3">
                  <p className="font-medium">#{s.order} · {s.duration}s</p>
                  <p className="text-slate-600">{s.visualPrompt}</p>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {(['9:16', '16:9', '1:1', '4:5'] as AspectRatio[]).map((ar) => (
                  <Button key={ar} type="button" size="sm" variant={aspectRatio === ar ? 'primary' : 'outline'} onClick={() => setAspectRatio(ar)}>{ar}</Button>
                ))}
              </div>
              <Button type="button" variant="secondary" onClick={runEstimate}>{t('video.estimateCredits')}</Button>
              {estimate && (
                <p className="text-slate-700">{t('video.estimatedCostColon')} <strong>{estimate.credits}</strong> credits ({estimate.mode})</p>
              )}
              <form onSubmit={generate} className="space-y-3 pt-2">
                <Input label="Project ID (UUID)" value={projectId} onChange={(e) => setProjectId(e.target.value)} required />
                <Button type="submit" loading={loading}>{t('video.generateVideo')}</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {job && (
          <Card>
            <CardHeader><CardTitle>{t('video.generationJob')}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'info'}>{job.status}</Badge>
                {job.currentStage && <Badge variant="default">{job.currentStage}</Badge>}
                {job.progress !== null && <Badge variant="default">{job.progress}%</Badge>}
                <Badge variant="default">{job.creditsCharged} credits</Badge>
              </div>
              <p className="text-slate-500">Job: {job.id}</p>
              {job.error && <Alert variant="error">{job.error}</Alert>}
              {job.status === 'completed' && (job.outputUrl || job.assetId) && (
                <VideoResultCard
                  title={t('video.generatedAd')}
                  videoUrl={job.outputUrl}
                  assetId={job.assetId}
                  status={job.status}
                  createdAt={job.completedAt || job.updatedAt}
                />
              )}
              {job.status !== 'completed' && job.outputUrl && (
                <video src={job.outputUrl} controls className="max-h-96 w-full rounded-lg bg-black" />
              )}
              {['queued', 'processing', 'composing', 'rendering'].includes(job.status) && (
                <div className="flex items-center gap-3">
                  <Spinner size="sm" />
                  <span>{t('video.pipelineRunning')}</span>
                  <Button variant="outline" size="sm" onClick={cancel}>{t('common.cancel')}</Button>
                </div>
              )}
              {job.status === 'failed' && (
                <Button onClick={() => storyboard && projectId && generate({ preventDefault() {} } as FormEvent)}>{t('common.retry')}</Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
