import { getDb } from '../../db/client.js';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository.js';
import { CreditRepository } from '../../domain/repositories/credit.repository.js';
import { BillingService } from './services/billing.service.js';
import { PayPalBillingService } from './services/paypal-billing.service.js';
import { PayPalWebhookService } from './services/paypal-webhook.service.js';
import { BillingController } from './controllers/billing.controller.js';
import { createBillingRoutes } from './routes/billing.routes.js';

export function createBillingModule() {
  const db = getDb();
  const workspaces = new WorkspaceRepository(db);
  const service = new BillingService(db, workspaces, new CreditRepository(db));
  const paypalBilling = new PayPalBillingService(db, workspaces);
  const paypalWebhook = new PayPalWebhookService(db);
  const controller = new BillingController(service, paypalBilling, paypalWebhook);
  const routes = createBillingRoutes(controller);
  return { routes, controller, service, paypalBilling, paypalWebhook };
}
