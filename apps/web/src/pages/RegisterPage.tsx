import { useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Alert } from '@aura/ui';
import { api, setAccessToken } from '../lib/api';
import { LanguageSelector } from '../components/LanguageSelector';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.register({ fullName, email, password });
      setAccessToken(data.tokens.accessToken);
      // refresh optional
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute end-4 top-4">
        <LanguageSelector />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.registerTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t('common.fullName')} value={fullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} required />
            <Input label={t('common.email')} type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required />
            <Input label={t('common.password')} type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required />
            <Button type="submit" className="w-full" loading={loading}>{t('common.signUp')}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-600">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-indigo-600">{t('common.signIn')}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
