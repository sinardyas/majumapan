import { db } from './index';
import {
  stores,
  users,
  categories,
  products,
  stock,
  discounts,
  appSettings,
} from './schema';
import { hashPassword } from '../utils/password';

async function seed() {
  console.log('Starting database seed...');

  try {
    // Clear existing data (in reverse order of dependencies)
    console.log('Clearing existing data...');
    await db.delete(stock);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(discounts);
    await db.delete(users);
    await db.delete(stores);
    await db.delete(appSettings);

    // Seed app settings
    console.log('Seeding app settings...');
    await db.insert(appSettings).values([
      { key: 'tax_rate', value: '0.11' },
      { key: 'currency', value: 'IDR' },
      { key: 'currency_symbol', value: 'Rp' },
      { key: 'transaction_prefix', value: 'TXN' },
      { key: 'local_retention_days', value: '30' },
      { key: 'eod_operational_day_start_hour', value: '6' },
      { key: 'eod_allow_auto_transition', value: 'true' },
      { key: 'eod_notification_emails', value: '[]' },
    ]);

    // Seed stores
    console.log('Seeding stores...');
    const [downtownStore] = await db.insert(stores).values([
      {
        name: 'Downtown Store',
        address: '123 Main Street, Downtown',
        phone: '(555) 123-4567',
        isActive: true,
      },
    ]).returning();

    const [mallStore] = await db.insert(stores).values([
      {
        name: 'Mall Branch',
        address: '456 Shopping Center, Level 2',
        phone: '(555) 987-6543',
        isActive: true,
      },
    ]).returning();

    // Seed users
    console.log('Seeding users...');
    const adminPasswordHash = await hashPassword('admin123');
    const managerPasswordHash = await hashPassword('manager123');
    const cashierPasswordHash = await hashPassword('cashier123');

    await db.insert(users).values([
      {
        email: 'admin@pos.local',
        passwordHash: adminPasswordHash,
        name: 'System Admin',
        role: 'admin',
        storeId: null, // Admin has access to all stores
        pin: '000000',
        isActive: true,
      },
      {
        email: 'manager@downtown.pos.local',
        passwordHash: managerPasswordHash,
        name: 'Downtown Manager',
        role: 'manager',
        storeId: downtownStore.id,
        pin: '111111',
        isActive: true,
      },
      {
        email: 'cashier1@downtown.pos.local',
        passwordHash: cashierPasswordHash,
        name: 'John Cashier',
        role: 'cashier',
        storeId: downtownStore.id,
        pin: '123456',
        isActive: true,
      },
      {
        email: 'cashier2@mall.pos.local',
        passwordHash: cashierPasswordHash,
        name: 'Jane Cashier',
        role: 'cashier',
        storeId: mallStore.id,
        pin: '654321',
        isActive: true,
      },
    ]);

    // Seed categories for Downtown Store
    console.log('Seeding categories...');
    const [electronicsCategory] = await db.insert(categories).values({
      storeId: downtownStore.id,
      name: 'Electronics',
      description: 'Electronic devices and accessories',
      isActive: true,
    }).returning();

    const [beveragesCategory] = await db.insert(categories).values({
      storeId: downtownStore.id,
      name: 'Beverages',
      description: 'Drinks and refreshments',
      isActive: true,
    }).returning();

    const [snacksCategory] = await db.insert(categories).values({
      storeId: downtownStore.id,
      name: 'Snacks',
      description: 'Chips, chocolates, and more',
      isActive: true,
    }).returning();

    const [householdCategory] = await db.insert(categories).values({
      storeId: downtownStore.id,
      name: 'Household',
      description: 'Household essentials',
      isActive: true,
    }).returning();

    const [personalCareCategory] = await db.insert(categories).values({
      storeId: downtownStore.id,
      name: 'Personal Care',
      description: 'Health and personal care items',
      isActive: true,
    }).returning();

    // Seed products for Downtown Store
    console.log('Seeding products...');
    const productsData = [
      // Electronics
      {
        storeId: downtownStore.id,
        categoryId: electronicsCategory.id,
        sku: 'ELEC-001',
        barcode: '1234567890123',
        name: 'Wireless Earbuds',
        description: 'Bluetooth 5.0 wireless earbuds with charging case',
        price: '775000',
        costPrice: '387500',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: electronicsCategory.id,
        sku: 'ELEC-002',
        barcode: '1234567890124',
        name: 'USB-C Cable',
        description: '6ft USB-C to USB-C charging cable',
        price: '200000',
        costPrice: '62000',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: electronicsCategory.id,
        sku: 'ELEC-003',
        barcode: '1234567890125',
        name: 'Phone Case',
        description: 'Universal smartphone protective case',
        price: '310000',
        costPrice: '93000',
        isActive: true,
      },
      // Beverages
      {
        storeId: downtownStore.id,
        categoryId: beveragesCategory.id,
        sku: 'BEV-001',
        barcode: '2234567890123',
        name: 'Cola 500ml',
        description: 'Classic cola soft drink',
        price: '38500',
        costPrice: '12400',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: beveragesCategory.id,
        sku: 'BEV-002',
        barcode: '2234567890124',
        name: 'Orange Juice 1L',
        description: '100% fresh orange juice',
        price: '77500',
        costPrice: '31000',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: beveragesCategory.id,
        sku: 'BEV-003',
        barcode: '2234567890125',
        name: 'Mineral Water 500ml',
        description: 'Natural spring water',
        price: '23000',
        costPrice: '4650',
        isActive: true,
      },
      // Snacks
      {
        storeId: downtownStore.id,
        categoryId: snacksCategory.id,
        sku: 'SNK-001',
        barcode: '3234567890123',
        name: 'Potato Chips',
        description: 'Classic salted potato chips 150g',
        price: '62000',
        costPrice: '23250',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: snacksCategory.id,
        sku: 'SNK-002',
        barcode: '3234567890124',
        name: 'Chocolate Bar',
        description: 'Milk chocolate bar 100g',
        price: '46500',
        costPrice: '15500',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: snacksCategory.id,
        sku: 'SNK-003',
        barcode: '3234567890125',
        name: 'Mixed Nuts 200g',
        description: 'Premium roasted mixed nuts',
        price: '124000',
        costPrice: '62000',
        isActive: true,
      },
      // Household
      {
        storeId: downtownStore.id,
        categoryId: householdCategory.id,
        sku: 'HH-001',
        barcode: '4234567890123',
        name: 'Paper Towels',
        description: '2-ply paper towel roll',
        price: '69500',
        costPrice: '31000',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: householdCategory.id,
        sku: 'HH-002',
        barcode: '4234567890124',
        name: 'Dish Soap',
        description: 'Liquid dish soap 500ml',
        price: '62000',
        costPrice: '23250',
        isActive: true,
      },
      // Personal Care
      {
        storeId: downtownStore.id,
        categoryId: personalCareCategory.id,
        sku: 'PC-001',
        barcode: '5234567890123',
        name: 'Hand Sanitizer',
        description: 'Antibacterial hand gel 250ml',
        price: '93000',
        costPrice: '31000',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        categoryId: personalCareCategory.id,
        sku: 'PC-002',
        barcode: '5234567890124',
        name: 'Toothpaste',
        description: 'Whitening toothpaste 100ml',
        price: '69500',
        costPrice: '27900',
        isActive: true,
      },
    ];

    const insertedProducts = await db.insert(products).values(productsData).returning();

    // Seed stock for all products
    console.log('Seeding stock...');
    const stockData = insertedProducts.map((product, index) => ({
      storeId: downtownStore.id,
      productId: product.id,
      quantity: 50 + (index * 10), // Varying stock levels
      lowStockThreshold: 10,
    }));

    await db.insert(stock).values(stockData);

    // Seed discounts
    console.log('Seeding discounts...');
    await db.insert(discounts).values([
      {
        storeId: downtownStore.id,
        code: 'WELCOME10',
        name: 'Welcome Discount',
        description: 'Rp 150.000 off your first purchase',
        discountType: 'fixed',
        discountScope: 'cart',
        value: '150000',
        minPurchaseAmount: '500000',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        code: 'SAVE20',
        name: '20% Off Sale',
        description: '20% off your entire cart',
        discountType: 'percentage',
        discountScope: 'cart',
        value: '20.00',
        minPurchaseAmount: '1000000',
        maxDiscountAmount: '500000',
        isActive: true,
      },
      {
        storeId: downtownStore.id,
        code: 'SUMMER15',
        name: 'Summer Sale',
        description: '15% off for summer season',
        discountType: 'percentage',
        discountScope: 'cart',
        value: '15.00',
        usageLimit: 100,
        isActive: true,
      },
    ]);

    console.log('\n========================================');
    console.log('Database seeded successfully!');
    console.log('========================================\n');
    console.log('Test Accounts:');
    console.log('----------------------------------------');
    console.log('Admin:    admin@pos.local / admin123 (PIN: 000000)');
    console.log('Manager:  manager@downtown.pos.local / manager123 (PIN: 111111)');
    console.log('Cashier:  cashier1@downtown.pos.local / cashier123 (PIN: 123456)');
    console.log('Cashier:  cashier2@mall.pos.local / cashier123 (PIN: 654321)');
    console.log('----------------------------------------\n');
    console.log('Discount Codes:');
    console.log('----------------------------------------');
    console.log('WELCOME10 - Rp 150.000 off (min Rp 500.000 purchase)');
    console.log('SAVE20 - 20% off (min Rp 1.000.000, max Rp 500.000 discount)');
    console.log('SUMMER15 - 15% off (limited to 100 uses)');
    console.log('----------------------------------------\n');

  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
}

// Run seed
seed()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
