'use client';

import { useMemo, useRef, useEffect } from 'react';
import { IPhoneFrame } from './IPhoneFrame';
import { ChevronLeft } from 'lucide-react';
import { getSmsSegments } from '@/src/lib/sms/smsSegments';

export interface SmsInPhonePreviewProps {
  variant?: 'retail' | 'shopify';
  senderName?: string;
  message: string;
  showCounts?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SMS Messages Preview Inside iPhone Frame
 * iOS-like Messages UI with retail app tokens (light mode)
 * Messages appear at bottom with auto-scroll behavior
 */
export function SmsInPhonePreview({
  variant = 'retail',
  senderName = 'Astronote',
  message,
  showCounts = true,
  size = 'md',
}: SmsInPhonePreviewProps) {
  const sms = useMemo(() => getSmsSegments(message || ''), [message]);
  const characterCount = (message || '').length;

  // Extract URLs from message for link preview
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: string[] = message.match(urlRegex) || [];
  const hasLinks = urls.length > 0;

  // Theme accent color
  const accentColor = 'var(--color-accent)';

  // Refs for scroll management
  const conversationRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);

  // Auto-scroll to bottom when message changes (if user is near bottom)
  useEffect(() => {
    if (!conversationRef.current || !messagesEndRef.current || !message) return;

    const container = conversationRef.current;
    const threshold = 50; // pixels from bottom
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

    // Only auto-scroll if user is near bottom
    if (isNearBottom || !isUserScrolledUpRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      isUserScrolledUpRef.current = false;
    }
  }, [message]);

  // Track user scroll to detect manual scrolling up
  useEffect(() => {
    const container = conversationRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100; // pixels from bottom
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      isUserScrolledUpRef.current = !isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Screen content (iOS Messages UI with retail tokens)
  const screenContent = (
    <div className="flex h-full w-full flex-col min-h-0 bg-background text-text-primary">
      {/* Messages Header - iOS-like but with retail tokens */}
      <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-3">
        {/* Back chevron (decorative) */}
        <ChevronLeft className="h-5 w-5 text-accent shrink-0" strokeWidth={2} />
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            {senderName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text-primary">{senderName}</div>
            <div className="text-[11px] text-text-tertiary">Messages</div>
          </div>
        </div>
      </div>

      {/* Conversation Area (scrollable inside screen) */}
      <div
        ref={conversationRef}
        className="flex-1 min-h-0 overflow-y-auto bg-surface-light px-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border) transparent',
        }}
      >
        {/* Flex container to push messages to bottom */}
        <div className="flex min-h-full flex-col">
          {/* Spacer to push messages to bottom (iOS-like behavior) */}
          {message && <div className="flex-1 min-h-0" />}

          {/* Messages List */}
          {message ? (
            <div className="py-4 space-y-2">
              {/* Message Bubble (received style - iOS-like) */}
              <div className="flex justify-start">
                <div
                  className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-background px-3.5 py-2.5"
                  style={{
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08), 0 0.5px 1px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.4] text-text-primary p-1">
                    {message.split(urlRegex).map((part, idx) => {
                      if (urls.includes(part)) {
                        return (
                          <a
                            key={idx}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline break-all"
                            style={{ color: accentColor }}
                          >
                            {part}
                          </a>
                        );
                      }
                      return <span key={idx}>{part}</span>;
                    })}
                  </p>
                </div>
              </div>

              {/* Link Preview (if URLs exist) - iOS-like cards */}
              {hasLinks && (
                <div className="space-y-2">
                  {urls.map((url, idx) => (
                    <div key={idx} className="flex justify-start">
                      <div
                        className="max-w-[80%] overflow-hidden rounded-xl border border-border bg-background"
                        style={{
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08), 0 0.5px 1px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 transition-colors hover:bg-surface-light"
                        >
                          <div
                            className="break-all text-[13px] font-medium leading-snug"
                            style={{ color: accentColor }}
                          >
                            {url}
                          </div>
                          <div className="mt-1.5 text-[11px] text-text-tertiary">Tap to open</div>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scroll anchor (invisible element at bottom) */}
              <div ref={messagesEndRef} className="h-0" />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center min-h-0 py-4">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-dashed border-border bg-background px-3.5 py-2.5">
                <p className="text-center text-sm text-text-secondary">Your message will appear here...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {/* iPhone Frame with Messages UI */}
      <IPhoneFrame theme={variant} size={size}>
        {screenContent}
      </IPhoneFrame>

      {/* Footer Counters (below phone) */}
      {showCounts && (
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Characters:</span>
            <span
              className={`font-medium ${
                characterCount > 160
                  ? 'text-orange-500'
                  : characterCount > 140
                    ? 'text-yellow-500'
                    : 'text-text-primary'
              }`}
            >
              {characterCount}
            </span>
          </div>
          <span className="text-text-tertiary">•</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Encoding:</span>
            <span className="font-medium text-text-primary">{sms.encoding.toUpperCase()}</span>
          </div>
          <span className="text-text-tertiary">•</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Segments:</span>
            <span
              className={`font-medium ${
                sms.segments > 1 ? 'text-orange-500' : 'text-text-primary'
              }`}
            >
              {sms.segments} {sms.segments === 1 ? 'part' : 'parts'}
            </span>
          </div>
          <span className="text-text-tertiary">•</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Units:</span>
            <span className="font-medium text-text-primary">
              {sms.units}/{sms.perSegment}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
