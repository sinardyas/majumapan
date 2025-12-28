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

// Health check
routes.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default routes;
