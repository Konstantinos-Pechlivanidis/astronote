'use client';

import React, { ReactNode } from 'react';
import { IPhoneFrame, IPhoneFrameProps } from './IPhoneFrame';

export interface IPhoneFrameRetailProps extends Omit<IPhoneFrameProps, 'bezelColor' | 'bezelGradient' | 'screenBg' | 'statusBarBg' | 'statusBarText' | 'islandBg' | 'islandBorder' | 'homeIndicatorBg' | 'homeIndicatorColor'> {
  children: ReactNode;
}

/**
 * Retail-themed iPhone Frame
 * Light mode styling with Tiffany accent (#0ABAB5)
 */
export function IPhoneFrameRetail({ children, ...props }: IPhoneFrameRetailProps) {
  // Retail theme tokens (light mode)
  const retailTheme = {
    bezelColor: '#1a1a1a',
    bezelGradient: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    screenBg: '#000000',
    statusBarBg: '#000000',
    statusBarText: '#ffffff',
    islandBg: '#000000',
    islandBorder: 'rgba(255, 255, 255, 0.1)',
    homeIndicatorBg: '#000000',
    homeIndicatorColor: 'rgba(255, 255, 255, 0.3)',
  };

  return (
    <IPhoneFrame {...props} {...retailTheme}>
      {children}
    </IPhoneFrame>
  );
}

