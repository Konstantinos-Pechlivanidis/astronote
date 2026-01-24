const prisma = require('../lib/prisma');
const { debit } = require('./wallet.service');
const pino = require('pino');

const logger = pino({ name: 'credit-reservation' });

const RESERVATION_TTL_MINUTES = Number(process.env.CREDIT_RESERVATION_TTL_MINUTES || 1440); // 24h
const RESERVATION_REASON_DEFAULT = 'sms:reserve';

const buildExpiry = (minutes = RESERVATION_TTL_MINUTES) => new Date(Date.now() + minutes * 60 * 1000);

const normalizeIds = (ids) =>
  Array.from(
    new Set(
      (ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

async function reserveCreditsForMessages(ownerId, messageIds, opts = {}) {
  const ids = normalizeIds(messageIds);
  if (!ids.length) {
    return { reserved: 0, reused: 0, total: 0 };
  }

  const amountPerMessage = Number.isInteger(opts.amountPerMessage) && opts.amountPerMessage > 0
    ? opts.amountPerMessage
    : 1;
  const reason = opts.reason || RESERVATION_REASON_DEFAULT;
  const campaignId = opts.campaignId || null;
  const expiresAt = opts.expiresAt || buildExpiry();

  return prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: { ownerId },
      update: {},
      create: { ownerId, balance: 0, reservedBalance: 0 },
    });

    // Lock wallet row to prevent concurrent over-reservation
    await tx.$executeRaw`
      SELECT id FROM "Wallet" WHERE "ownerId" = ${ownerId} FOR UPDATE
    `;

    const wallet = await tx.wallet.findUnique({
      where: { ownerId },
      select: { id: true, balance: true, reservedBalance: true },
    });

    const existing = await tx.creditReservation.findMany({
      where: {
        ownerId,
        messageId: { in: ids },
      },
      select: { id: true, messageId: true, status: true, amount: true },
    });

    const existingByMessage = new Map(existing.map((row) => [row.messageId, row]));
    const toCreate = [];
    const toRevive = [];
    let reused = 0;

    for (const messageId of ids) {
      const current = existingByMessage.get(messageId);
      if (current && (current.status === 'reserved' || current.status === 'committed')) {
        reused += 1;
        continue;
      }
      if (current && (current.status === 'released' || current.status === 'expired')) {
        toRevive.push(current.id);
        continue;
      }
      toCreate.push({
        ownerId,
        messageId,
        amount: amountPerMessage,
        status: 'reserved',
        reason,
        campaignId,
        expiresAt,
      });
    }

    const reserveCount = toCreate.length + toRevive.length;
    const reservedBalance = wallet?.reservedBalance || 0;
    const balance = wallet?.balance || 0;
    const available = balance - reservedBalance;

    if (available < reserveCount * amountPerMessage) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    if (toRevive.length) {
      await tx.creditReservation.updateMany({
        where: { id: { in: toRevive } },
        data: {
          status: 'reserved',
          amount: amountPerMessage,
          reservedAt: new Date(),
          releasedAt: null,
          committedAt: null,
          expiresAt,
        },
      });
    }

    if (toCreate.length) {
      await tx.creditReservation.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    if (reserveCount > 0) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { increment: reserveCount * amountPerMessage } },
      });
    }

    return { reserved: reserveCount, reused, total: ids.length };
  });
}

async function reserveCredits(ownerId, amount, opts = {}) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('INVALID_AMOUNT');
  }

  const idempotencyKey = opts.idempotencyKey || null;
  const reason = opts.reason || RESERVATION_REASON_DEFAULT;
  const campaignId = opts.campaignId || null;
  const messageId = opts.messageId || null;
  const expiresAt = opts.expiresAt || buildExpiry();

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { ownerId },
      update: {},
      create: { ownerId, balance: 0, reservedBalance: 0 },
      select: { id: true, balance: true, reservedBalance: true },
    });

    if (idempotencyKey) {
      const existing = await tx.creditReservation.findUnique({
        where: {
          ownerId_idempotencyKey: { ownerId, idempotencyKey },
        },
      });
      if (existing) {
        return { reservation: existing, reserved: false };
      }
    }

    if (messageId) {
      const existing = await tx.creditReservation.findUnique({ where: { messageId } });
      if (existing) {
        return { reservation: existing, reserved: false };
      }
    }

    const available = (wallet.balance || 0) - (wallet.reservedBalance || 0);
    if (available < amount) {
      throw new Error('INSUFFICIENT_CREDITS');
    }

    const reservation = await tx.creditReservation.create({
      data: {
        ownerId,
        amount,
        status: 'reserved',
        reason,
        campaignId,
        messageId,
        idempotencyKey,
        expiresAt,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { reservedBalance: { increment: amount } },
    });

    return { reservation, reserved: true };
  });
}

async function commitReservationById(ownerId, reservationId, opts = {}, tx = null) {
  const execute = async (client) => {
    const reservation = await client.creditReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.ownerId !== ownerId) {
      return { committed: false, reason: 'reservation_missing' };
    }
    if (reservation.status === 'committed') {
      return { committed: false, alreadyCommitted: true, reservation };
    }
    if (reservation.status !== 'reserved') {
      return { committed: false, reason: `reservation_${reservation.status}`, reservation };
    }

    const wallet = await client.wallet.findUnique({
      where: { ownerId },
      select: { id: true, reservedBalance: true },
    });

    if (!wallet) {
      return { committed: false, reason: 'wallet_missing' };
    }

    const reservedBalance = wallet.reservedBalance || 0;
    if (reservedBalance < reservation.amount) {
      logger.warn({ ownerId, reservationId, reservedBalance, amount: reservation.amount }, 'Reserved balance below reservation amount');
    }

    await client.wallet.update({
      where: { id: wallet.id },
      data: { reservedBalance: { decrement: Math.min(reservedBalance, reservation.amount) } },
    });

    const billingResult = await debit(
      ownerId,
      reservation.amount,
      {
        reason: opts.reason || reservation.reason || 'sms:send',
        campaignId: opts.campaignId || reservation.campaignId || null,
        messageId: opts.messageId || reservation.messageId || null,
        meta: { ...(reservation.meta || {}), ...(opts.meta || {}), reservationId },
      },
      client,
    );

    const committedAt = new Date();
    await client.creditReservation.update({
      where: { id: reservation.id },
      data: { status: 'committed', committedAt },
    });

    return { committed: true, reservation, balance: billingResult.balance, billedAt: committedAt };
  };

  return tx ? execute(tx) : prisma.$transaction(execute);
}

async function commitReservationForMessage(ownerId, messageId, opts = {}, tx = null) {
  const execute = async (client) => {
    const reservation = await client.creditReservation.findUnique({ where: { messageId } });
    if (!reservation || reservation.ownerId !== ownerId) {
      return { committed: false, reason: 'reservation_missing' };
    }
    return commitReservationById(ownerId, reservation.id, { ...opts, messageId }, client);
  };

  return tx ? execute(tx) : prisma.$transaction(execute);
}

async function releaseReservationById(ownerId, reservationId, opts = {}, tx = null) {
  const execute = async (client) => {
    const reservation = await client.creditReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.ownerId !== ownerId) {
      return { released: false, reason: 'reservation_missing' };
    }
    if (reservation.status === 'released' || reservation.status === 'expired') {
      return { released: false, alreadyReleased: true, reservation };
    }
    if (reservation.status === 'committed') {
      return { released: false, reason: 'already_committed', reservation };
    }

    const wallet = await client.wallet.findUnique({
      where: { ownerId },
      select: { id: true, reservedBalance: true },
    });

    if (wallet) {
      const reservedBalance = wallet.reservedBalance || 0;
      await client.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { decrement: Math.min(reservedBalance, reservation.amount) } },
      });
    }

    const releasedAt = new Date();
    await client.creditReservation.update({
      where: { id: reservation.id },
      data: { status: 'released', releasedAt },
    });

    return { released: true, reservation, releasedAt };
  };

  return tx ? execute(tx) : prisma.$transaction(execute);
}

async function releaseReservationForMessage(ownerId, messageId, opts = {}, tx = null) {
  const execute = async (client) => {
    const reservation = await client.creditReservation.findUnique({ where: { messageId } });
    if (!reservation || reservation.ownerId !== ownerId) {
      return { released: false, reason: 'reservation_missing' };
    }
    return releaseReservationById(ownerId, reservation.id, opts, client);
  };

  return tx ? execute(tx) : prisma.$transaction(execute);
}

async function reconcileStaleReservations(options = {}) {
  const limit = Number(options.limit || process.env.CREDIT_RESERVATION_RECONCILE_LIMIT || 500);
  const minutes = Number(options.olderThanMinutes || RESERVATION_TTL_MINUTES);
  const threshold = new Date(Date.now() - minutes * 60 * 1000);

  const stale = await prisma.creditReservation.findMany({
    where: {
      status: 'reserved',
      OR: [
        { expiresAt: { lt: new Date() } },
        { expiresAt: null, reservedAt: { lt: threshold } },
      ],
    },
    take: limit,
    orderBy: { expiresAt: 'asc' },
  });

  if (!stale.length) {
    return { released: 0 };
  }

  const byOwner = new Map();
  for (const reservation of stale) {
    if (!byOwner.has(reservation.ownerId)) {
      byOwner.set(reservation.ownerId, []);
    }
    byOwner.get(reservation.ownerId).push(reservation);
  }

  let released = 0;
  for (const [ownerId, reservations] of byOwner.entries()) {
    const ids = reservations.map((r) => r.id);
    const totalAmount = reservations.reduce((sum, r) => sum + (r.amount || 0), 0);

    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { ownerId },
        select: { id: true, reservedBalance: true },
      });

      if (wallet) {
        const reservedBalance = wallet.reservedBalance || 0;
        const decrementBy = Math.min(reservedBalance, totalAmount);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { reservedBalance: { decrement: decrementBy } },
        });
      }

      await tx.creditReservation.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'expired',
          releasedAt: new Date(),
        },
      });
    });

    released += reservations.length;
  }

  logger.warn({ released, threshold: threshold.toISOString() }, 'Released stale credit reservations');
  return { released };
}

module.exports = {
  reserveCreditsForMessages,
  reserveCredits,
  commitReservationForMessage,
  commitReservationById,
  releaseReservationForMessage,
  releaseReservationById,
  reconcileStaleReservations,
};
