import prisma from './prisma.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { createStripeCheckoutSession } from './stripe.js';

/**
 * Billing Service
 * Handles credit management, Stripe integration, and transaction history
 */

/**
 * Credit packages configuration
 */
const CREDIT_PACKAGES = [
  {
    id: 'package_1000',
    name: '1,000 SMS Credits',
    credits: 1000,
    priceEUR: 29.99,
    priceUSD: 32.99,
    stripePriceIdEUR: process.env.STRIPE_PRICE_ID_1000_EUR || 'price_1000_credits_eur',
    stripePriceIdUSD: process.env.STRIPE_PRICE_ID_1000_USD || 'price_1000_credits_usd',
    description: 'Perfect for small businesses getting started',
    popular: false,
    features: ['1,000 SMS messages', 'No expiration', 'Priority support'],
  },
  {
    id: 'package_5000',
    name: '5,000 SMS Credits',
    credits: 5000,
    priceEUR: 129.99,
    priceUSD: 142.99,
    stripePriceIdEUR: process.env.STRIPE_PRICE_ID_5000_EUR || 'price_5000_credits_eur',
    stripePriceIdUSD: process.env.STRIPE_PRICE_ID_5000_USD || 'price_5000_credits_usd',
    description: 'Great value for growing businesses',
    popular: true,
    features: ['5,000 SMS messages', 'No expiration', 'Priority support', '13% savings'],
  },
  {
    id: 'package_10000',
    name: '10,000 SMS Credits',
    credits: 10000,
    priceEUR: 229.99,
    priceUSD: 252.99,
    stripePriceIdEUR: process.env.STRIPE_PRICE_ID_10000_EUR || 'price_10000_credits_eur',
    stripePriceIdUSD: process.env.STRIPE_PRICE_ID_10000_USD || 'price_10000_credits_usd',
    description: 'Best value for high-volume senders',
    popular: false,
    features: ['10,000 SMS messages', 'No expiration', 'Priority support', '23% savings'],
  },
  {
    id: 'package_25000',
    name: '25,000 SMS Credits',
    credits: 25000,
    priceEUR: 499.99,
    priceUSD: 549.99,
    stripePriceIdEUR: process.env.STRIPE_PRICE_ID_25000_EUR || 'price_25000_credits_eur',
    stripePriceIdUSD: process.env.STRIPE_PRICE_ID_25000_USD || 'price_25000_credits_usd',
    description: 'Enterprise solution for maximum reach',
    popular: false,
    features: ['25,000 SMS messages', 'No expiration', 'Dedicated support', '33% savings'],
  },
];

/**
 * Get credit balance for store
 * @param {string} storeId - Store ID
 * @returns {Promise<Object>} Balance information
 */
export async function getBalance(storeId) {
  logger.info('Getting balance', { storeId });

  const shop = await prisma.shop.findUnique({
    where: { id: storeId },
    select: { credits: true, currency: true },
  });

  if (!shop) {
    throw new NotFoundError('Shop');
  }

  logger.info('Balance retrieved', { storeId, credits: shop.credits });

  return {
    credits: shop.credits || 0,
    balance: shop.credits || 0, // Alias for consistency
    currency: shop.currency || 'EUR',
  };
}

/**
 * Get available credit packages
 * @param {string} currency - Currency code (EUR or USD), defaults to EUR
 * @returns {Array} Available packages with currency-specific pricing
 */
export function getPackages(currency = 'EUR') {
  logger.info('Getting credit packages', { currency });

  return CREDIT_PACKAGES.map(pkg => ({
    id: pkg.id,
    name: pkg.name,
    credits: pkg.credits,
    price: currency === 'USD' ? pkg.priceUSD : pkg.priceEUR,
    currency,
    description: pkg.description,
    popular: pkg.popular,
    features: pkg.features,
  }));
}

/**
 * Get package by ID
 * @param {string} packageId - Package ID
 * @returns {Object} Package details
 */
export function getPackageById(packageId) {
  const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);

  if (!pkg) {
    throw new NotFoundError('Package');
  }

  return pkg;
}

/**
 * Create Stripe checkout session for credit purchase
 * @param {string} storeId - Store ID
 * @param {string} packageId - Package ID
 * @param {Object} returnUrls - Success and cancel URLs
 * @returns {Promise<Object>} Checkout session
 */
export async function createPurchaseSession(storeId, packageId, returnUrls, requestedCurrency = null) {
  logger.info('Creating purchase session', { storeId, packageId, requestedCurrency });

  // Validate package
  let pkg;
  try {
    pkg = getPackageById(packageId);
    logger.debug('Package found', { packageId, credits: pkg.credits });
  } catch (packageError) {
    logger.error('Invalid package ID', { packageId, error: packageError.message });
    throw packageError;
  }

  // Get shop details with currency
  let shop;
  try {
    shop = await prisma.shop.findUnique({
      where: { id: storeId },
      select: { id: true, shopDomain: true, shopName: true, currency: true },
    });

    if (!shop) {
      logger.error('Shop not found in database', { storeId });
      throw new NotFoundError('Shop');
    }

    logger.debug('Shop found', { storeId, shopDomain: shop.shopDomain, currency: shop.currency });
  } catch (shopError) {
    logger.error('Failed to retrieve shop', { storeId, error: shopError.message });
    throw shopError;
  }

  // Validate return URLs
  if (!returnUrls.successUrl || !returnUrls.cancelUrl) {
    throw new ValidationError('Success and cancel URLs are required');
  }

  // Select currency: use requested currency if provided and valid, otherwise use shop currency, fallback to EUR
  // Only allow EUR or USD
  const validCurrencies = ['EUR', 'USD'];
  let currency = 'EUR';

  if (requestedCurrency && validCurrencies.includes(requestedCurrency.toUpperCase())) {
    currency = requestedCurrency.toUpperCase();
  } else if (shop.currency && validCurrencies.includes(shop.currency.toUpperCase())) {
    currency = shop.currency.toUpperCase();
  }

  const price = currency === 'USD' ? pkg.priceUSD : pkg.priceEUR;
  const stripePriceId = currency === 'USD'
    ? pkg.stripePriceIdUSD
    : pkg.stripePriceIdEUR;

  // Validate Stripe price ID - must start with 'price_' and be a valid Stripe price ID format
  if (!stripePriceId) {
    logger.error('Missing Stripe price ID', {
      currency,
      packageId,
      priceIdEUR: pkg.stripePriceIdEUR,
      priceIdUSD: pkg.stripePriceIdUSD,
    });
    throw new ValidationError(`Stripe price ID is not configured for ${currency}. Please set STRIPE_PRICE_ID_${pkg.credits}_${currency} environment variable.`);
  }

  // Check if it's a placeholder (fallback value) - these won't work with Stripe
  const isPlaceholder = stripePriceId.includes('_credits_') || !stripePriceId.startsWith('price_');
  if (isPlaceholder) {
    logger.warn('Using placeholder Stripe price ID - this will fail with Stripe API', {
      currency,
      stripePriceId,
      packageId,
      message: 'Please configure actual Stripe price IDs in environment variables',
    });
    // Don't throw here - let Stripe API return the actual error for better debugging
  }

  logger.debug('Stripe configuration', {
    currency,
    price,
    stripePriceId,
    packageId,
  });

  // Create billing transaction record
  const transaction = await prisma.billingTransaction.create({
    data: {
      shopId: storeId,
      creditsAdded: pkg.credits,
      amount: Math.round(price * 100), // Convert to cents
      currency, // Use shop currency
      packageType: packageId,
      stripeSessionId: 'pending', // Will be updated after Stripe session creation
      status: 'pending',
    },
  });

  // Create Stripe checkout session
  let session;
  try {
    logger.debug('Calling Stripe checkout session creation', {
      storeId,
      shopDomain: shop.shopDomain,
      packageId,
      stripePriceId,
      currency,
    });

    session = await createStripeCheckoutSession({
      packageId,
      credits: pkg.credits,
      price,
      currency,
      stripePriceId, // Use selected price ID based on currency
      shopId: storeId,
      shopDomain: shop.shopDomain,
      successUrl: returnUrls.successUrl,
      cancelUrl: returnUrls.cancelUrl,
      metadata: {
        storeId,
        packageId,
        transactionId: transaction.id,
        credits: pkg.credits.toString(),
      },
    });

    logger.debug('Stripe checkout session created', {
      sessionId: session?.id,
      sessionUrl: session?.url,
    });
  } catch (stripeError) {
    logger.error('Failed to create Stripe checkout session', {
      error: stripeError.message,
      errorName: stripeError.name,
      errorStack: stripeError.stack,
      storeId,
      packageId,
      stripePriceId,
      currency,
    });

    // Clean up the transaction record if Stripe session creation fails
    try {
      await prisma.billingTransaction.delete({
        where: { id: transaction.id },
      });
      logger.debug('Cleaned up failed transaction record', { transactionId: transaction.id });
    } catch (cleanupError) {
      logger.warn('Failed to clean up transaction record', {
        transactionId: transaction.id,
        error: cleanupError.message,
      });
    }

    throw stripeError;
  }

  // Update transaction with Stripe session ID
  await prisma.billingTransaction.update({
    where: { id: transaction.id },
    data: { stripeSessionId: session.id },
  });

  logger.info('Purchase session created', {
    storeId,
    packageId,
    sessionId: session.id,
    transactionId: transaction.id,
  });

  // Return package info without internal Stripe price IDs
  const packageInfo = {
    id: pkg.id,
    name: pkg.name,
    credits: pkg.credits,
    price: currency === 'USD' ? pkg.priceUSD : pkg.priceEUR,
    currency,
    description: pkg.description,
    popular: pkg.popular,
    features: pkg.features,
  };

  return {
    sessionId: session.id,
    sessionUrl: session.url,
    transactionId: transaction.id,
    package: packageInfo,
  };
}

/**
 * Handle successful Stripe payment
 * @param {Object} stripeEvent - Stripe webhook event
 * @returns {Promise<Object>} Processing result
 */
export async function handleStripeWebhook(stripeEvent) {
  logger.info('Handling Stripe webhook', {
    type: stripeEvent.type,
    eventId: stripeEvent.id,
  });

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    // Support both shopId and storeId (they are the same - shop.id)
    const storeId = session.metadata.storeId || session.metadata.shopId;
    const { transactionId, credits } = session.metadata;

    if (!storeId) {
      logger.error('Missing storeId/shopId in session metadata', {
        sessionId: session.id,
        metadata: session.metadata,
      });
      throw new ValidationError('Missing storeId/shopId in session metadata');
    }

    if (!transactionId) {
      logger.error('Missing transactionId in session metadata', {
        sessionId: session.id,
        metadata: session.metadata,
      });
      throw new ValidationError('Missing transactionId in session metadata');
    }

    if (!credits) {
      logger.error('Missing credits in session metadata', {
        sessionId: session.id,
        metadata: session.metadata,
      });
      throw new ValidationError('Missing credits in session metadata');
    }

    logger.info('Processing completed checkout', {
      storeId,
      transactionId,
      sessionId: session.id,
    });

    // Find transaction
    const transaction = await prisma.billingTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      logger.error('Transaction not found', { transactionId });
      throw new NotFoundError('Transaction');
    }

    if (transaction.status === 'completed') {
      logger.warn('Transaction already completed', { transactionId });
      return { status: 'already_processed' };
    }

    // Update transaction status
    await prisma.billingTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'completed',
        stripePaymentId: session.payment_intent,
      },
    });

    // Add credits to shop
    await addCredits(storeId, parseInt(credits), `stripe:${session.id}`, {
      transactionId,
      sessionId: session.id,
      paymentIntent: session.payment_intent,
    });

    logger.info('Purchase completed successfully', {
      storeId,
      transactionId,
      creditsAdded: credits,
    });

    return {
      status: 'success',
      storeId,
      creditsAdded: parseInt(credits),
    };
  }

  // Handle refund events
  if (stripeEvent.type === 'charge.refunded' || stripeEvent.type === 'payment_intent.refunded') {
    const refund = stripeEvent.data.object;
    const paymentIntentId = refund.payment_intent || refund.id;

    logger.info('Processing refund webhook', {
      refundId: refund.id,
      paymentIntentId,
      amount: refund.amount,
      currency: refund.currency,
    });

    // Find the original billing transaction by payment intent ID
    const transaction = await prisma.billingTransaction.findFirst({
      where: {
        stripePaymentId: paymentIntentId,
        status: 'completed',
      },
    });

    if (!transaction) {
      logger.warn('Transaction not found for refund', {
        paymentIntentId,
        refundId: refund.id,
      });
      // Don't throw - refund might be for a different system
      return { status: 'ignored', reason: 'transaction_not_found' };
    }

    // Calculate credits to refund (proportional if partial refund)
    const originalAmount = transaction.amount; // Amount in cents
    const refundAmount = refund.amount; // Refund amount in cents
    const creditsToRefund = Math.floor(
      (transaction.creditsAdded * refundAmount) / originalAmount,
    );

    // Process refund
    await processRefund(
      transaction.shopId,
      transaction.id,
      creditsToRefund,
      refund.id,
      {
        paymentIntentId,
        refundAmount,
        originalAmount,
        currency: refund.currency,
      },
    );

    return {
      status: 'success',
      storeId: transaction.shopId,
      creditsRefunded: creditsToRefund,
    };
  }

  return { status: 'ignored', type: stripeEvent.type };
}

/**
 * Add credits to store balance
 * @param {string} storeId - Store ID
 * @param {number} credits - Credits to add
 * @param {string} ref - Reference (e.g., 'stripe:session_id')
 * @param {Object} meta - Additional metadata
 * @returns {Promise<Object>} Updated balance
 */
export async function addCredits(storeId, credits, ref, meta = {}) {
  logger.info('Adding credits', { storeId, credits, ref });

  if (credits <= 0) {
    throw new ValidationError('Credits must be positive');
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update shop credits
    const shop = await tx.shop.update({
      where: { id: storeId },
      data: {
        credits: { increment: credits },
      },
      select: { credits: true },
    });

    // Create wallet transaction record
    await tx.walletTransaction.create({
      data: {
        shopId: storeId,
        type: 'purchase',
        credits,
        ref,
        meta,
      },
    });

    return shop;
  });

  logger.info('Credits added successfully', {
    storeId,
    creditsAdded: credits,
    newBalance: result.credits,
  });

  return {
    credits: result.credits,
    added: credits,
  };
}

/**
 * Deduct credits from store balance
 * @param {string} storeId - Store ID
 * @param {number} credits - Credits to deduct
 * @param {string} ref - Reference (e.g., 'campaign:campaign_id')
 * @param {Object} meta - Additional metadata
 * @returns {Promise<Object>} Updated balance
 */
export async function deductCredits(storeId, credits, ref, meta = {}) {
  logger.info('Deducting credits', { storeId, credits, ref });

  if (credits <= 0) {
    throw new ValidationError('Credits must be positive');
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Check current balance
    const shop = await tx.shop.findUnique({
      where: { id: storeId },
      select: { credits: true },
    });

    if (!shop) {
      throw new NotFoundError('Shop');
    }

    if (shop.credits < credits) {
      throw new ValidationError(`Insufficient credits. Available: ${shop.credits}, Required: ${credits}`);
    }

    // Update shop credits
    const updatedShop = await tx.shop.update({
      where: { id: storeId },
      data: {
        credits: { decrement: credits },
      },
      select: { credits: true },
    });

    // Create wallet transaction record
    await tx.walletTransaction.create({
      data: {
        shopId: storeId,
        type: 'debit',
        credits: -credits, // Negative for debit
        ref,
        meta,
      },
    });

    return updatedShop;
  });

  logger.info('Credits deducted successfully', {
    storeId,
    creditsDeducted: credits,
    newBalance: result.credits,
  });

  return {
    credits: result.credits,
    deducted: credits,
  };
}

/**
 * Process refund for a purchase
 * Deducts credits and creates refund transaction records
 * @param {string} storeId - Store ID
 * @param {string} transactionId - Original BillingTransaction ID
 * @param {number} creditsToRefund - Credits to refund (defaults to original amount)
 * @param {string} refundId - Stripe refund ID
 * @param {Object} meta - Additional metadata
 * @returns {Promise<Object>} Refund result
 */
export async function processRefund(storeId, transactionId, creditsToRefund = null, refundId = null, meta = {}) {
  logger.info('Processing refund', {
    storeId,
    transactionId,
    creditsToRefund,
    refundId,
  });

  // Find original transaction
  const transaction = await prisma.billingTransaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    logger.error('Transaction not found for refund', { transactionId });
    throw new NotFoundError('Transaction');
  }

  if (transaction.shopId !== storeId) {
    logger.error('Transaction does not belong to store', {
      transactionId,
      storeId,
      transactionShopId: transaction.shopId,
    });
    throw new ValidationError('Transaction does not belong to this store');
  }

  if (transaction.status !== 'completed') {
    logger.error('Cannot refund non-completed transaction', {
      transactionId,
      status: transaction.status,
    });
    throw new ValidationError('Can only refund completed transactions');
  }

  // Use original credits if not specified
  const credits = creditsToRefund || transaction.creditsAdded;

  if (credits <= 0) {
    throw new ValidationError('Refund credits must be positive');
  }

  // Use atomic transaction for refund processing
  const result = await prisma.$transaction(async (tx) => {
    // Check current balance
    const shop = await tx.shop.findUnique({
      where: { id: storeId },
      select: { credits: true },
    });

    if (!shop) {
      throw new NotFoundError('Shop');
    }

    // Deduct credits (allow negative balance for refunds if needed)
    const updatedShop = await tx.shop.update({
      where: { id: storeId },
      data: {
        credits: { decrement: credits },
      },
      select: { credits: true },
    });

    // Create wallet transaction record for refund
    await tx.walletTransaction.create({
      data: {
        shopId: storeId,
        type: 'refund',
        credits: -credits, // Negative for refund
        ref: refundId ? `stripe:refund:${refundId}` : `refund:${transactionId}`,
        meta: {
          originalTransactionId: transactionId,
          refundId,
          ...meta,
        },
      },
    });

    // Update billing transaction status to refunded (or create a refund record)
    // For now, we'll mark it as refunded in metadata
    await tx.billingTransaction.update({
      where: { id: transactionId },
      data: {
        // Keep status as completed but add refund info in a note
        // Alternatively, you could add a refundedAt field
      },
    });

    return updatedShop;
  });

  logger.info('Refund processed successfully', {
    storeId,
    transactionId,
    creditsRefunded: credits,
    newBalance: result.credits,
  });

  return {
    credits: result.credits,
    refunded: credits,
    transactionId,
  };
}

/**
 * Get transaction history
 * @param {string} storeId - Store ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Transaction history
 */
export async function getTransactionHistory(storeId, filters = {}) {
  const {
    page = 1,
    pageSize = 20,
    type,
    startDate,
    endDate,
  } = filters;

  logger.info('Getting transaction history', { storeId, filters });

  const where = { shopId: storeId };

  if (type && ['purchase', 'debit', 'credit', 'refund', 'adjustment'].includes(type)) {
    where.type = type;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(pageSize),
      skip: (parseInt(page) - 1) * parseInt(pageSize),
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  const totalPages = Math.ceil(total / parseInt(pageSize));

  logger.info('Transaction history retrieved', { storeId, total, returned: transactions.length });

  return {
    transactions,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
    },
  };
}

/**
 * Get billing history (Stripe transactions)
 * @param {string} storeId - Store ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Billing history
 */
export async function getBillingHistory(storeId, filters = {}) {
  const {
    page = 1,
    pageSize = 20,
    status,
  } = filters;

  logger.info('Getting billing history', { storeId, filters });

  const where = { shopId: storeId };

  if (status && ['pending', 'completed', 'failed'].includes(status)) {
    where.status = status;
  }

  const [transactions, total] = await Promise.all([
    prisma.billingTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(pageSize),
      skip: (parseInt(page) - 1) * parseInt(pageSize),
    }),
    prisma.billingTransaction.count({ where }),
  ]);

  const totalPages = Math.ceil(total / parseInt(pageSize));

  logger.info('Billing history retrieved', { storeId, total, returned: transactions.length });

  // Transform transactions to include frontend-friendly fields
  const transformedTransactions = transactions.map(transaction => {
    // Get package info from packageType
    let packageName = 'N/A';
    let packageCredits = transaction.creditsAdded;

    try {
      const pkg = getPackageById(transaction.packageType);
      packageName = pkg.name;
      packageCredits = pkg.credits;
    } catch (error) {
      // Package not found, use defaults
      packageName = transaction.packageType || 'N/A';
    }

    // Convert amount from cents to currency
    const amountInCurrency = transaction.amount ? (transaction.amount / 100).toFixed(2) : 0;

    return {
      id: transaction.id,
      packageName,
      credits: transaction.creditsAdded,
      creditsAdded: transaction.creditsAdded, // Keep for backward compatibility
      amount: parseFloat(amountInCurrency), // Amount in currency (not cents)
      amountCents: transaction.amount, // Keep original in cents for reference
      price: parseFloat(amountInCurrency), // Alias for amount
      currency: transaction.currency || 'EUR',
      status: transaction.status,
      packageType: transaction.packageType,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      // Include package info for backward compatibility
      package: {
        name: packageName,
        credits: packageCredits,
      },
    };
  });

  return {
    transactions: transformedTransactions,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1,
    },
  };
}

export default {
  getBalance,
  getPackages,
  getPackageById,
  createPurchaseSession,
  handleStripeWebhook,
  addCredits,
  deductCredits,
  getTransactionHistory,
  getBillingHistory,
};

