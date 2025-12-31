'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, Download, CheckCircle, Loader, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { useImportContacts } from '@/src/features/shopify/contacts/hooks/useContactMutations';
import type { ImportContactItem } from '@/src/lib/shopify/api/contacts';

/**
 * Contacts Import Page
 * Import contacts from CSV file
 */
export default function ContactsImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ phone: string; error: string }>;
  } | null>(null);

  const importMutation = useImportContacts();

  // Generate sample CSV content
  const generateSampleCSV = () => {
    const sampleData = [
      ['phoneE164', 'firstName', 'lastName', 'email', 'gender', 'birthDate', 'smsConsent', 'tags'],
      ['+306977123456', 'John', 'Doe', 'john.doe@example.com', 'male', '1990-05-15', 'opted_in', 'VIP,Customer'],
      ['+306977123457', 'Jane', 'Smith', 'jane.smith@example.com', 'female', '1985-08-22', 'opted_in', 'Customer'],
      ['+306977123458', 'Alex', 'Johnson', '', 'other', '', 'opted_in', ''],
      ['+306977123459', 'Maria', 'Garcia', 'maria@example.com', 'female', '1992-12-01', 'opted_out', 'Newsletter'],
    ];
    return sampleData.map((row) => row.join(',')).join('\n');
  };

  const downloadSampleCSV = () => {
    const csvContent = generateSampleCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample-contacts.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        alert('Please select a CSV file');
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      setImportResult(null);
    }
  };

  // Parse CSV file to JSON
  const parseCSV = (csvText: string): ImportContactItem[] => {
    const lines = csvText.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    // Simple CSV parser that handles quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim()); // Add last field
      return result;
    };

    // Parse header row
    const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
    const phoneE164Index = headers.findIndex((h) => h.toLowerCase() === 'phonee164');

    if (phoneE164Index === -1) {
      throw new Error('CSV file must contain a "phoneE164" column');
    }

    // Parse data rows
    const contacts: ImportContactItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line).map((v) => v.replace(/^"|"$/g, '').trim());

        // Skip if phone is missing
        if (!values[phoneE164Index] || values[phoneE164Index] === '') {
          continue;
        }

        const contact: ImportContactItem = {
          phoneE164: values[phoneE164Index],
        };

        headers.forEach((header, index) => {
          const value = values[index] || '';
          const headerLower = header.toLowerCase();

          // Handle different field names (case-insensitive, supports snake_case)
          if (headerLower === 'phonee164' || headerLower === 'phone') {
            contact.phoneE164 = value;
          } else if (headerLower === 'firstname' || headerLower === 'first_name') {
            contact.firstName = value || null;
          } else if (headerLower === 'lastname' || headerLower === 'last_name') {
            contact.lastName = value || null;
          } else if (headerLower === 'email') {
            contact.email = value || null;
          } else if (headerLower === 'gender') {
            contact.gender = (value as 'male' | 'female' | 'other') || null;
          } else if (headerLower === 'birthdate' || headerLower === 'birth_date') {
            contact.birthDate = value || null;
          } else if (headerLower === 'smsconsent' || headerLower === 'sms_consent') {
            contact.smsConsent = (value as 'opted_in' | 'opted_out' | 'unknown') || 'unknown';
          } else if (headerLower === 'tags') {
            contact.tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];
          }
        });

        contacts.push(contact);
      } catch (error) {
        // Skip invalid rows
        if (process.env.NODE_ENV === 'development') {
          console.error(`Error parsing row ${i + 1}:`, error);
        }
      }
    }

    if (contacts.length === 0) {
      throw new Error('No valid contacts found in CSV file');
    }

    if (contacts.length > 1000) {
      throw new Error('Maximum 1000 contacts per import');
    }

    return contacts;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    setIsUploading(true);
    setImportResult(null);

    try {
      // Read file
      const text = await selectedFile.text();

      // Parse CSV
      const contacts = parseCSV(text);

      // Import contacts
      const result = await importMutation.mutateAsync({ contacts });

      setImportResult(result);
      setSelectedFile(null);
      setFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to import contacts';
      alert(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/app/shopify/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </Button>
        </Link>
        <div className="flex-1">
          <RetailPageHeader
            title="Import Contacts"
            description="Upload a CSV file to import contacts in bulk"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload Section */}
        <RetailCard className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Upload CSV File</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="file-input" className="mb-2 block text-sm font-medium text-text-secondary">
                Select CSV File
              </label>
              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white hover:file:bg-accent/90"
                disabled={isUploading}
              />
              {fileName && (
                <p className="mt-2 text-sm text-text-secondary">Selected: {fileName}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Contacts
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={downloadSampleCSV}>
                <Download className="mr-2 h-4 w-4" />
                Download Sample
              </Button>
            </div>
          </div>
        </RetailCard>

        {/* Instructions */}
        <RetailCard className="p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">CSV Format</h3>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Required Columns:</h4>
              <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
                <li><code className="bg-surface-light px-1 rounded">phoneE164</code> - Phone number in E.164 format (e.g., +306977123456)</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">Optional Columns:</h4>
              <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
                <li><code className="bg-surface-light px-1 rounded">firstName</code> - First name</li>
                <li><code className="bg-surface-light px-1 rounded">lastName</code> - Last name</li>
                <li><code className="bg-surface-light px-1 rounded">email</code> - Email address</li>
                <li><code className="bg-surface-light px-1 rounded">gender</code> - male, female, or other</li>
                <li><code className="bg-surface-light px-1 rounded">birthDate</code> - Birth date (YYYY-MM-DD)</li>
                <li><code className="bg-surface-light px-1 rounded">smsConsent</code> - opted_in, opted_out, or unknown</li>
                <li><code className="bg-surface-light px-1 rounded">tags</code> - Comma-separated tags</li>
              </ul>
            </div>

            <div className="rounded-lg bg-surface-light border border-border p-3">
              <p className="text-xs text-text-tertiary">
                <strong>Note:</strong> Maximum 1000 contacts per import. The CSV file must include a header row.
              </p>
            </div>
          </div>
        </RetailCard>
      </div>

      {/* Import Result */}
      {importResult && (
        <RetailCard className="mt-6 p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            {importResult.errors.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-400" />
            )}
            Import Results
          </h3>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            <div>
              <div className="text-sm font-medium text-text-secondary mb-1">Total</div>
              <div className="text-2xl font-bold text-text-primary">{importResult.total}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-secondary mb-1">Created</div>
              <div className="text-2xl font-bold text-green-400">{importResult.created}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-secondary mb-1">Updated</div>
              <div className="text-2xl font-bold text-blue-400">{importResult.updated}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-text-secondary mb-1">Skipped</div>
              <div className="text-2xl font-bold text-red-400">{importResult.skipped}</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-2">
                Errors ({importResult.errors.length})
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-lg bg-surface-light border border-border p-3">
                <ul className="space-y-1 text-xs text-text-secondary">
                  {importResult.errors.map((error, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{error.phone}:</span> {error.error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Link href="/app/shopify/contacts">
              <Button>View Contacts</Button>
            </Link>
          </div>
        </RetailCard>
      )}
    </div>
  );
}

