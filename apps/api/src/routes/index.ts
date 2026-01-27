import { Hono } from 'hono';
import auth from './auth';
import stores from './stores';
import users from './users';
import categories from './categories';
import products from './products';
import stock from './stock';
import discounts from './discounts';
import transactions from './transactions';
import sync from './sync';
import auditLogs from './audit-logs';
import data from './data';
import settings from './settings';
import reports from './reports';
import shifts from './shifts';
import dayClose from './day-close';
import pendingCarts from './pending-carts';
import devices from './devices';
import vouchers from './vouchers';

const routes = new Hono();

// Mount routes
routes.route('/auth', auth);
routes.route('/stores', stores);
routes.route('/users', users);
routes.route('/categories', categories);
routes.route('/products', products);
routes.route('/stock', stock);
routes.route('/discounts', discounts);
routes.route('/transactions', transactions);
routes.route('/sync', sync);
routes.route('/audit-logs', auditLogs);
routes.route('/data', data);
routes.route('/settings', settings);
routes.route('/reports', reports);
routes.route('/shifts', shifts);
routes.route('/day-close', dayClose);
routes.route('/pending-carts', pendingCarts);
routes.route('/devices', devices);
routes.route('/vouchers', vouchers);

// Health check
routes.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default routes;
