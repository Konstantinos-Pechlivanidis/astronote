'use client';

import { useMemo } from 'react';
import { IPhoneFrame } from './IPhoneFrame';
import { ChevronLeft } from 'lucide-react';

export interface SmsInPhonePreviewProps {
  variant?: 'retail' | 'shopify';
  senderName?: string;
  message: string;
  timestampLabel?: string;
  showCounts?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SMS Messages Preview Inside iPhone Frame
 * Displays iOS Messages UI with sender, timestamp, message bubble, and counters
 */
export function SmsInPhonePreview({
  variant = 'retail',
  senderName = 'Astronote',
  message,
  timestampLabel = 'Now',
  showCounts = true,
  size = 'md',
}: SmsInPhonePreviewProps) {
  // Calculate SMS segments (simple 160-char segmentation)
  const smsSegments = useMemo(() => {
    if (!message) return 0;
    return Math.ceil(message.length / 160);
  }, [message]);

  const characterCount = message.length;

  // Extract URLs from message for link preview
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls: string[] = message.match(urlRegex) || [];
  const hasLinks = urls.length > 0;

  // Theme accent color
  const accentColor = variant === 'retail' ? '#0ABAB5' : '#0ABAB5'; // Both use Tiffany for now

  // Screen content (iOS Messages UI)
  const screenContent = (
    <>
      {/* Messages Header */}
      <div className="bg-[#f2f2f7] border-b border-[#c6c6c8] px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* Back chevron (decorative) */}
          <ChevronLeft className="w-5 h-5 text-[#007aff]" strokeWidth={2} />
          <div className="flex items-center gap-2.5 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
              style={{ backgroundColor: accentColor }}
            >
              {senderName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#000]">{senderName}</div>
            </div>
          </div>
          <div className="text-[11px] text-[#8e8e93]">{timestampLabel}</div>
        </div>
      </div>

      {/* Conversation Area (scrollable inside screen) */}
      <div
        className="bg-[#f2f2f7] px-4 py-3 min-h-[200px] max-h-[400px] overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#c6c6c8 transparent',
        }}
      >
        {message ? (
          <div className="space-y-2">
            {/* Message Bubble (received style) */}
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-white shadow-sm">
                <p className="text-[15px] leading-[1.4] text-[#000] whitespace-pre-wrap break-words">
                  {message.split(urlRegex).map((part, idx) => {
                    if (urls.includes(part)) {
                      return (
                        <a
                          key={idx}
                          href={part}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
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

            {/* Link Preview (if URLs exist) */}
            {hasLinks && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-xl overflow-hidden bg-white border border-[#c6c6c8] shadow-sm">
                  {urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 hover:bg-[#f9f9f9] transition-colors"
                    >
                      <div className="text-[13px] font-medium truncate" style={{ color: accentColor }}>
                        {url}
                      </div>
                      <div className="text-[11px] text-[#8e8e93] mt-1">Tap to open</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-[13px] text-[#8e8e93] text-center px-4">
              Your message will appear here...
            </p>
          </div>
        )}
      </div>
    </>
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
              {characterCount}/160
            </span>
          </div>
          <span className="text-text-tertiary">•</span>
          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Segments:</span>
            <span
              className={`font-medium ${
                smsSegments > 1 ? 'text-orange-500' : 'text-text-primary'
              }`}
            >
              {smsSegments} {smsSegments === 1 ? 'part' : 'parts'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

