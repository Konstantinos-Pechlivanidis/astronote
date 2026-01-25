'use client';

import { useMemo } from 'react';

export interface SmsPhonePreviewDarkProps {
  title?: string;
  senderName?: string;
  message: string;
  timestamp?: string;
  phoneLabel?: string;
  showCounts?: boolean;
  accentColor?: string;
  className?: string;
}

/**
 * Marketing SMS Phone Preview Component (Dark Mode)
 * Premium iPhone-style preview for landing pages with dark mode styling
 */
export function SmsPhonePreviewDark({
  title,
  senderName = 'Astronote',
  message,
  timestamp = 'Now',
  phoneLabel,
  showCounts = true,
  accentColor = '#12C6B5',
  className = '',
}: SmsPhonePreviewDarkProps) {
  // Calculate SMS segments (simple 160-char segmentation)
  const smsSegments = useMemo(() => {
    if (!message) return 0;
    return Math.ceil(message.length / 160);
  }, [message]);

  const characterCount = message.length;

  // Extract URLs from message for link preview
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.match(urlRegex) || [];
  const hasLinks = urls.length > 0;

  // Format phone number for display
  const displayPhone = phoneLabel || '+30 *** *** 123';

  return (
    <div className={`w-full ${className}`} aria-label="SMS message preview">
      {/* Premium Container with Glow */}
      <div className="relative">
        {/* Subtle glow behind phone */}
        <div
          className="absolute inset-0 rounded-[2.5rem] blur-2xl opacity-20"
          style={{
            background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
          }}
        />

        {/* Live Preview Badge */}
        {title && (
          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-medium text-text-secondary">{title}</span>
            </div>
          </div>
        )}

        {/* iPhone Frame */}
        <div className="relative">
          {/* Outer bezel with gradient */}
          <div
            className="relative rounded-[2.5rem] p-2 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 50%, #1a1a1a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Screen */}
            <div className="bg-[#070A0F] rounded-[2rem] overflow-hidden border border-white/5">
              {/* Status bar */}
              <div className="h-6 bg-[#070A0F] flex items-center justify-between px-4 text-white/70 text-[10px] font-medium">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-2 border border-white/30 rounded-sm">
                    <div
                      className="h-full bg-white/70 rounded-sm"
                      style={{ width: '75%' }}
                    />
                  </div>
                  <div className="w-1 h-1 bg-white/50 rounded-full" />
                  <div className="w-1 h-1 bg-white/50 rounded-full" />
                </div>
              </div>

              {/* Dynamic Island hint (subtle) */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#070A0F] rounded-full border border-white/5" />

              {/* Messages App Header (Dark Mode) */}
              <div className="bg-[#0F1419] border-b border-white/5 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                      }}
                    >
                      <span className="text-[11px] font-semibold text-white">
                        {senderName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-white">{senderName}</div>
                      <div className="text-[11px] text-white/50">{displayPhone}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/50">{timestamp}</div>
                </div>
              </div>

              {/* Message Area (scrollable, dark) */}
              <div
                className="bg-[#070A0F] px-4 py-3 min-h-[200px] max-h-[400px] overflow-y-auto"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent',
                }}
              >
                {message ? (
                  <div className="space-y-2">
                    {/* Message Bubble (Dark Mode - received style) */}
                    <div className="flex justify-start">
                      <div
                        className="max-w-[75%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-lg"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderTopLeftRadius: '4px',
                        }}
                      >
                        <p className="text-[15px] leading-[1.4] text-white/90 whitespace-pre-wrap break-words">
                          {message}
                        </p>
                      </div>
                    </div>

                    {/* Link Preview (Dark Mode) */}
                    {hasLinks && (
                      <div className="flex justify-start">
                        <div
                          className="max-w-[75%] rounded-xl overflow-hidden shadow-lg"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          {urls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-3 hover:bg-white/5 transition-colors"
                            >
                              <div
                                className="text-[13px] font-medium truncate"
                                style={{ color: accentColor }}
                              >
                                {url}
                              </div>
                              <div className="text-[11px] text-white/40 mt-1">Tap to open</div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <p className="text-[13px] text-white/40 text-center px-4">
                      Your message will appear here...
                    </p>
                  </div>
                )}
              </div>

              {/* Home indicator (iPhone X+) */}
              <div className="h-8 bg-[#070A0F] flex items-center justify-center">
                <div className="w-32 h-1 bg-white/20 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Counts Footer (Marketing-friendly chips) */}
        {showCounts && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div
              className="rounded-full border px-3 py-1.5"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <span className="text-xs text-white/50 mr-2">Characters</span>
              <span
                className={`text-xs font-semibold ${
                  characterCount > 160
                    ? 'text-orange-400'
                    : characterCount > 140
                      ? 'text-yellow-400'
                      : 'text-white'
                }`}
              >
                {characterCount}/160
              </span>
            </div>
            <div
              className="rounded-full border px-3 py-1.5"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <span className="text-xs text-white/50 mr-2">Segments</span>
              <span
                className={`text-xs font-semibold ${
                  smsSegments > 1 ? 'text-orange-400' : 'text-white'
                }`}
              >
                {smsSegments} {smsSegments === 1 ? 'part' : 'parts'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
