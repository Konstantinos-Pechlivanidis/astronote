import shopifyApi from './axios';
/**
 * Contact Type Definitions
 */
export interface Contact {
  id: number;
  phoneE164: string;
  phone?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null;
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactsListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  gender?: 'male' | 'female' | 'other';
  filter?: 'all' | 'male' | 'female' | 'consented' | 'nonconsented';
  hasBirthDate?: 'true' | 'false';
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'birthDate';
  sortOrder?: 'asc' | 'desc';
}

export interface ContactsListResponse {
  contacts: Contact[];
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
  phoneE164: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null;
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
  tags?: string[];
}

export interface UpdateContactRequest {
  phoneE164?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  birthDate?: string | null;
  smsConsent?: 'opted_in' | 'opted_out' | 'unknown';
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
    if (params?.gender) queryParams.gender = params.gender;
    if (params?.filter) queryParams.filter = params.filter;
    if (params?.hasBirthDate) queryParams.hasBirthDate = params.hasBirthDate;
    if (params?.sortBy) queryParams.sortBy = params.sortBy;
    if (params?.sortOrder) queryParams.sortOrder = params.sortOrder;

    const response = await shopifyApi.get<ContactsListResponse>('/contacts', {
      params: queryParams,
    });
    // Response interceptor already extracts data
    return response as unknown as ContactsListResponse;
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
  get: async (id: number): Promise<Contact> => {
    const response = await shopifyApi.get<Contact>(`/contacts/${id}`);
    // Response interceptor already extracts data
    return response as unknown as Contact;
  },

  /**
   * Create a new contact
   */
  create: async (data: CreateContactRequest): Promise<Contact> => {
    const response = await shopifyApi.post<Contact>('/contacts', data);
    // Response interceptor already extracts data
    return response as unknown as Contact;
  },

  /**
   * Update an existing contact
   */
  update: async (id: number, data: UpdateContactRequest): Promise<Contact> => {
    const response = await shopifyApi.put<Contact>(`/contacts/${id}`, data);
    // Response interceptor already extracts data
    return response as unknown as Contact;
  },

  /**
   * Delete a contact
   */
  delete: async (id: number): Promise<void> => {
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

