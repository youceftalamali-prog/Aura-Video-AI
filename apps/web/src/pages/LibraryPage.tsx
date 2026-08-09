import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Alert, Spinner, Badge, Input } from '@aura/ui';
import type { Project, Asset } from '@aura/types';
import { api } from '../lib/api';
import { downloadAssetById } from '../lib/download';

export function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'projects' | 'assets'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [p, a] = await Promise.all([api.listProjects(), api.listAssets()]);
      setProjects(p);
      setAssets(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('library.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function createProject() {
    if (!newName.trim()) return;
    try {
      await api.createProject({ name: newName.trim() });
      setNewName('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.createFailed'));
    }
  }

  async function removeProject(id: string) {
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  }

  async function exportVideo(id: string) {
    try {
      await downloadAssetById(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VIDEO_DOWNLOAD_FAILED');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
            <Badge variant="info">{t('library.title')}</Badge>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/video" className="text-slate-600 hover:text-slate-900">{t('common.video')}</Link>
            <Link to="/templates" className="text-slate-600 hover:text-slate-900">{t('templates.title')}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{t('library.projectsAndAssets')}</h1>
          <div className="flex gap-2">
            <Button size="sm" variant={tab === 'projects' ? 'primary' : 'outline'} onClick={() => setTab('projects')}>{t('library.projects')}</Button>
            <Button size="sm" variant={tab === 'assets' ? 'primary' : 'outline'} onClick={() => setTab('assets')}>{t('library.assets')}</Button>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {loading && <div className="flex justify-center py-12"><Spinner /></div>}

        {!loading && tab === 'projects' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                <div className="min-w-[200px] flex-1">
                  <Input label={t('common.newProjectName')} value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <Button onClick={createProject}>{t('library.createProject')}</Button>
              </CardContent>
            </Card>
            {projects.length === 0 && <p className="text-slate-500">{t('library.noProjects')}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <Card key={p.id}>
                  <CardContent className="space-y-2 pt-6 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <Badge variant={p.status === 'completed' ? 'success' : 'default'}>{p.status}</Badge>
                    </div>
                    {p.description && <p className="text-slate-500 line-clamp-2">{p.description}</p>}
                    <p className="text-xs text-slate-400">{new Date(p.updatedAt).toLocaleString()}</p>
                    {p.videoUrl && (
                      <a href={p.videoUrl} target="_blank" rel="noreferrer" className="text-indigo-600">{t('library.openVideo')}</a>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/video?projectId=${p.id}`)}>{t('library.openInStudio')}</Button>
                      <Button size="sm" variant="outline" onClick={() => removeProject(p.id)}>{t('common.delete')}</Button>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 break-all">{p.id}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!loading && tab === 'assets' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {assets.length === 0 && <p className="text-slate-500">{t('library.emptyAssets')}</p>}
            {assets.map((a) => (
              <Card key={a.id}>
                <CardContent className="space-y-2 pt-6 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{a.name}</p>
                    <Badge variant="default">{a.type}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">{a.mimeType} · {(a.sizeBytes / 1024).toFixed(1)} KB · {a.status}</p>
                  {a.type === 'video' && a.url && (
                    <video src={a.url} controls className="max-h-40 w-full rounded bg-black" />
                  )}
                  <div className="flex gap-2">
                    {a.status === 'ready' && (
                      <Button size="sm" onClick={() => exportVideo(a.id)}>{t('video.downloadVideo')}</Button>
                    )}
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 self-center">{t('common.open')}</a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
