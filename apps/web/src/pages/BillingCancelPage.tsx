import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@aura/ui';
import { AppShell } from '../components/AppShell';

export function BillingCancelPage() {
  const { t } = useTranslation();
  return (
    <AppShell title={t('billing.title')}>
      <Card>
        <CardHeader><CardTitle>{t('billing.checkoutCanceled')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>{t('billing.cancel')}</p>
          <Link to="/billing"><Button>{t('billing.backToBilling')}</Button></Link>
        </CardContent>
      </Card>
    </AppShell>
  );
}
