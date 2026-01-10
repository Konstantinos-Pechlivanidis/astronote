import shopifyApi from './axios';
/**
 * Contact Type Definitions
 */
export interface Contact {
  id: string; // Prisma uses String (cuid), not number
  phoneE164: string;
  phone?: string; // Retail-aligned field name
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null;
  birthday?: string | null; // Retail-aligned field name
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  smsConsentStatus?: 'opted_in' | 'opted_out' | null; // Retail-aligned field
  smsConsentAt?: string | null; // Retail-aligned field
  isSubscribed?: boolean; // Retail-aligned field
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  isSubscribed?: 'true' | 'false' | boolean; // Retail-aligned filter
  listId?: string; // Retail-aligned filter (segment/list ID)
  gender?: 'male' | 'female' | 'other';
  filter?: 'all' | 'male' | 'female' | 'consented' | 'nonconsented';
  hasBirthDate?: 'true' | 'false';
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'birthDate';
  sortOrder?: 'asc' | 'desc';
}

export interface ContactsListResponse {
  items?: Contact[]; // Retail-aligned field name
  contacts: Contact[]; // Backward compatibility
  total?: number; // Retail-aligned field
  page?: number; // Retail-aligned field
  pageSize?: number; // Retail-aligned field
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters?: {
    applied: Record<string, any>;
    available: {
      genders: string[];
      smsConsent: string[];
      filters: string[];
    };
  };
}

export interface ContactStats {
  total: number;
  optedIn: number;
  optedOut: number;
  smsConsent: {
    optedIn: number;
    optedOut: number;
    unknown: number;
    consentRate: number;
  };
  byGender: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
  gender: {
    male: number;
    female: number;
    other: number;
    unspecified: number;
  };
  birthDate: {
    withBirthDate: number;
    withoutBirthDate: number;
    birthDateRate: number;
  };
  automation: {
    birthdayEligible: number;
    smsEligible: number;
  };
}

export interface CreateContactRequest {
  phoneE164?: string; // Shopify field name
  phone?: string; // Retail-aligned field name (either phone or phoneE164 required)
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null; // Shopify field name
  birthday?: string | null; // Retail-aligned field name
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  isSubscribed?: boolean; // Retail-aligned field
  tags?: string[];
}

export interface UpdateContactRequest {
  phoneE164?: string; // Shopify field name
  phone?: string; // Retail-aligned field name
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null; // Shopify field name
  birthday?: string | null; // Retail-aligned field name
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  isSubscribed?: boolean; // Retail-aligned field
  tags?: string[];
}

export interface ImportContactItem {
  phoneE164: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null;
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  tags?: string[];
}

export interface ImportContactsRequest {
  contacts: ImportContactItem[];
}

export interface ImportContactsResponse {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    phone: string;
    error: string;
  }>;
}

/**
 * Contacts API Functions
 */
export const contactsApi = {
  /**
   * List contacts with filtering, search, and pagination
   */
  list: async (params?: ContactsListParams): Promise<ContactsListResponse> => {
    const queryParams: Record<string, string | number> = {};

    if (params?.page) queryParams.page = params.page;
    if (params?.pageSize) queryParams.pageSize = params.pageSize;
    if (params?.q) queryParams.q = params.q;
    if (params?.smsConsent) queryParams.smsConsent = params.smsConsent;
    if (params?.isSubscribed !== undefined) queryParams.isSubscribed = String(params.isSubscribed);
    if (params?.listId) queryParams.listId = params.listId;
    if (params?.gender) queryParams.gender = params.gender;
    if (params?.filter) queryParams.filter = params.filter;
    if (params?.hasBirthDate) queryParams.hasBirthDate = params.hasBirthDate;
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    const response = await shopifyApi.get<ContactsListResponse>('/contacts', {
      params: queryParams,
    });
    // Response interceptor already extracts data
    const data = response as unknown as ContactsListResponse;
    // Ensure backward compatibility: if items exists, also set contacts
    if (data.items && !data.contacts) {
      data.contacts = data.items;
    }
    return data;
  },

  /**
   * Get contact statistics
   */
  getStats: async (): Promise<ContactStats> => {
    const response = await shopifyApi.get<ContactStats>('/contacts/stats');
    // Response interceptor already extracts data
    return response as unknown as ContactStats;
  },

  /**
   * Get single contact by ID
   */
  get: async (id: string): Promise<Contact> => {
    const response = await shopifyApi.get<Contact>(`/contacts/${id}`);
    // Response interceptor already extracts data
    return response as unknown as Contact;
  },

  /**
   * Create a new contact
   */
  create: async (data: CreateContactRequest): Promise<Contact> => {
    // Map Retail field names to Shopify field names for API compatibility
    const apiData: any = { ...data };
    if (apiData.phone && !apiData.phoneE164) {
      apiData.phoneE164 = apiData.phone;
      delete apiData.phone;
    }
    if (apiData.birthday && !apiData.birthDate) {
      apiData.birthDate = apiData.birthday;
      delete apiData.birthday;
    }
    const response = await shopifyApi.post<Contact>('/contacts', apiData);
    // Response interceptor already extracts data
    return response as unknown as Contact;
  },

  /**
   * Update an existing contact
   */
  update: async (id: string, data: UpdateContactRequest): Promise<Contact> => {
    // Map Retail field names to Shopify field names for API compatibility
    const apiData: any = { ...data };
    if (apiData.phone && !apiData.phoneE164) {
      apiData.phoneE164 = apiData.phone;
      delete apiData.phone;
    }
    if (apiData.birthday !== undefined && apiData.birthDate === undefined) {
      apiData.birthDate = apiData.birthday;
      delete apiData.birthday;
    }
    const response = await shopifyApi.put<Contact>(`/contacts/${id}`, apiData);
    // Response interceptor already extracts data
    return response as unknown as Contact;
  },

  /**
   * Delete a contact
   */
  delete: async (id: string): Promise<void> => {
    await shopifyApi.delete(`/contacts/${id}`);
  },

  /**
   * Import contacts from CSV (parsed client-side)
   * Note: Frontend must parse CSV and send as JSON array
   */
  import: async (data: ImportContactsRequest): Promise<ImportContactsResponse> => {
    const response = await shopifyApi.post<ImportContactsResponse>('/contacts/import', data);
    // Response interceptor already extracts data
    return response as unknown as ImportContactsResponse;
  },
};

