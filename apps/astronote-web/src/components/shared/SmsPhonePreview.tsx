'use client';

import { useMemo } from 'react';

export interface SmsPhonePreviewProps {
  senderName?: string;
  message: string;
  phoneNumber?: string;
  timestamp?: string;
  accentColor?: string;
  mode?: 'retail' | 'shopify';
  maxPreviewLines?: number;
  showCounts?: boolean;
}

/**
 * Shared SMS Phone Preview Component
 * Displays SMS message in an iPhone-style frame with live character/segment counts
 */
export function SmsPhonePreview({
  senderName = 'Astronote',
  message,
  phoneNumber,
  timestamp = 'Now',
  accentColor: _accentColor = '#0ABAB5',
  mode: _mode = 'retail',
  maxPreviewLines: _maxPreviewLines = 10,
  showCounts = true,
}: SmsPhonePreviewProps) {
  // Calculate SMS segments (simple 160-char segmentation)
  // TODO: Upgrade to GSM-7 vs UCS-2 detection later
  const smsSegments = useMemo(() => {
    if (!message) return 0;
    return Math.ceil(message.length / 160);
  }, [message]);

  const characterCount = message.length;
  const isLongMessage = characterCount > 160;

  // Extract URLs from message for link preview (simple regex)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.match(urlRegex) || [];
  const hasLinks = urls.length > 0;

  // Format phone number for display
  const displayPhone = phoneNumber
    ? phoneNumber.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '+$1 *** *** $4')
    : '+30 *** *** 123';

  return (
    <div className="w-full max-w-[360px] mx-auto lg:mx-0" aria-label="SMS message preview">
      {/* iPhone Frame */}
      <div className="relative mx-auto" style={{ maxWidth: '100%' }}>
        {/* Outer bezel */}
        <div className="relative bg-[#1a1a1a] rounded-[2.5rem] p-2 shadow-2xl">
          {/* Screen */}
          <div className="bg-[#000] rounded-[2rem] overflow-hidden">
            {/* Status bar */}
            <div className="h-6 bg-[#000] flex items-center justify-between px-4 text-white text-[10px] font-medium">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-2 border border-white rounded-sm">
                  <div className="w-full h-full bg-white rounded-sm" style={{ width: '75%' }} />
                </div>
                <div className="w-1 h-1 bg-white rounded-full" />
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
            </div>

            {/* Dynamic Island hint (subtle) */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#000] rounded-full border border-white/10" />

            {/* Messages App Header */}
            <div className="bg-[#f2f2f7] border-b border-[#c6c6c8] px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-white">
                      {senderName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#000]">{senderName}</div>
                    <div className="text-[11px] text-[#8e8e93]">{displayPhone}</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#8e8e93]">{timestamp}</div>
              </div>
            </div>

            {/* Message Area (scrollable) */}
            <div
              className="bg-[#f2f2f7] px-4 py-3 min-h-[200px] max-h-[400px] overflow-y-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#c6c6c8 transparent',
              }}
            >
              {message ? (
                <div className="space-y-2">
                  {/* Message Bubble */}
                  <div className="flex justify-start">
                    <div
                      className="max-w-[75%] rounded-2xl rounded-tl-sm px-3 py-2 bg-white shadow-sm"
                      style={{
                        borderTopLeftRadius: '4px',
                      }}
                    >
                      <p className="text-[15px] leading-[1.4] text-[#000] whitespace-pre-wrap break-words">
                        {message}
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
                            <div className="text-[13px] font-medium text-[#007aff] truncate">
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

            {/* Home indicator (iPhone X+) */}
            <div className="h-8 bg-[#000] flex items-center justify-center">
              <div className="w-32 h-1 bg-white/30 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Counts Footer */}
      {showCounts && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Characters</span>
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
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">SMS Segments</span>
            <span
              className={`font-medium ${
                smsSegments > 1 ? 'text-orange-500' : 'text-text-primary'
              }`}
            >
              {smsSegments} {smsSegments === 1 ? 'part' : 'parts'}
            </span>
          </div>
          {isLongMessage && (
            <div className="mt-2 rounded-lg border border-orange-500/20 bg-orange-500/10 p-2">
              <p className="text-xs text-orange-600">
                Long message: Will be split into {smsSegments} SMS part{smsSegments !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

