import api from './axios';
import { endpoints } from './endpoints';

export type AutomationMessageType = 'marketing' | 'service';
export type AutomationEventType = 'appointment' | 'membership' | 'stay' | 'purchase' | 'visit' | 'custom';
export type AutomationEventStatus = 'scheduled' | 'completed' | 'canceled' | 'no_show';

export type AutomationTrigger =
  | {
      type: 'event';
      eventType: AutomationEventType;
      status?: AutomationEventStatus;
      timeField?: 'startAt' | 'endAt';
      offsetMinutes?: number;
    }
  | {
      type: 'inactivity';
      inactivityDays: number;
      eventTypes?: AutomationEventType[];
    };

export interface AutomationLibraryStats {
  sentLast7Days: number;
  sentLast30Days: number;
  lastRunAt?: string | null;
}

export interface AutomationLibraryPreset {
  key: string;
  name: string;
  description: string;
  messageType: AutomationMessageType;
  trigger: AutomationTrigger;
  defaultTemplate: string;
  isActive: boolean;
  messageBody: string;
  stats?: AutomationLibraryStats | null;
}

export interface AutomationLibraryResponse {
  businessProfile: string;
  presets: AutomationLibraryPreset[];
}

export interface AutomationLibraryUpdatePayload {
  isActive?: boolean;
  messageBody?: string;
}

export const automationLibraryApi = {
  list: () => api.get<AutomationLibraryResponse>(endpoints.automationLibrary.list),
  update: (key: string, data: AutomationLibraryUpdatePayload) =>
    api.put(endpoints.automationLibrary.update(key), data),
};
