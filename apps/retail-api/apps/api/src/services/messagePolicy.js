const MESSAGE_TYPES = {
  MARKETING: 'marketing',
  SERVICE: 'service',
};

const linePatterns = [
  /^ *(view|claim) offer:.*$/gim,
  /^ *to unsubscribe.*$/gim,
];

const urlPatterns = [
  /https?:\/\/\S*\/o\/[^\s]+/gi,
  /https?:\/\/\S*\/retail\/o\/[^\s]+/gi,
  /https?:\/\/\S*\/tracking\/offer\/[^\s]+/gi,
  /https?:\/\/\S*\/s\/[^\s]+/gi,
  /https?:\/\/\S*\/retail\/s\/[^\s]+/gi,
  /https?:\/\/\S*\/unsubscribe\/[^\s]+/gi,
];

function isMessageType(value) {
  return value === MESSAGE_TYPES.MARKETING || value === MESSAGE_TYPES.SERVICE;
}

function normalizeMessageType(value) {
  return value === MESSAGE_TYPES.SERVICE ? MESSAGE_TYPES.SERVICE : MESSAGE_TYPES.MARKETING;
}

function shouldAppendUnsubscribe(messageType) {
  return normalizeMessageType(messageType) === MESSAGE_TYPES.MARKETING;
}

function shouldAppendOffer(messageType, hasOffer) {
  return normalizeMessageType(messageType) === MESSAGE_TYPES.MARKETING && Boolean(hasOffer);
}

function stripLinkBlocks(text) {
  let output = text || '';
  [...linePatterns, ...urlPatterns].forEach((pattern) => {
    output = output.replace(pattern, '');
  });
  return output.replace(/\n{3,}/g, '\n\n').trim();
}

function getMessagePolicy(messageType, hasOffer, options = {}) {
  const normalized = normalizeMessageType(messageType);
  const appendUnsubscribe = shouldAppendUnsubscribe(normalized);
  const appendOffer = shouldAppendOffer(normalized, hasOffer);
  const stripExisting =
    options.stripExisting !== undefined
      ? options.stripExisting
      : Boolean(appendUnsubscribe || appendOffer);

  return {
    messageType: normalized,
    appendUnsubscribe,
    appendOffer,
    stripExisting,
  };
}

function normalizeMessageBody(originalBody, policy, links = {}) {
  const resolvedPolicy = policy || getMessagePolicy(MESSAGE_TYPES.MARKETING, Boolean(links.offerUrl));
  let output = originalBody || '';

  if (resolvedPolicy.stripExisting) {
    output = stripLinkBlocks(output);
  }

  const appended = [];
  const safeOfferUrl = links.offerUrl || null;
  const safeUnsubUrl = links.unsubscribeUrl || null;

  if (resolvedPolicy.appendOffer && safeOfferUrl) {
    appended.push(`Claim Offer: ${safeOfferUrl}`);
  }

  if (resolvedPolicy.appendUnsubscribe && safeUnsubUrl) {
    appended.push(`To unsubscribe, tap: ${safeUnsubUrl}`);
  }

  if (appended.length) {
    output = `${output}\n\n${appended.join('\n\n')}`;
  }

  output = output.replace(/\n{3,}/g, '\n\n').trim();

  return {
    text: output,
    appended: {
      offer: Boolean(resolvedPolicy.appendOffer && safeOfferUrl),
      unsubscribe: Boolean(resolvedPolicy.appendUnsubscribe && safeUnsubUrl),
    },
  };
}

module.exports = {
  MESSAGE_TYPES,
  isMessageType,
  normalizeMessageType,
  shouldAppendUnsubscribe,
  shouldAppendOffer,
  getMessagePolicy,
  normalizeMessageBody,
  stripLinkBlocks,
};
