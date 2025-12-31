'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, CheckCircle, XCircle, Loader, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { RetailPageHeader } from '@/src/components/retail/RetailPageHeader';
import { RetailPageLayout } from '@/src/components/retail/RetailPageLayout';
import { useImportContacts } from '@/src/features/retail/contacts/hooks/useImportContacts';
import { useImportJob } from '@/src/features/retail/contacts/hooks/useImportJob';
import { contactsApi } from '@/src/lib/retail/api/contacts';

export default function ContactsImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const importMutation = useImportContacts();
  const { data: jobStatus } = useImportJob(jobId, !!jobId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        alert('Only .xlsx files are allowed');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      const res = await contactsApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'contacts_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      alert('Please select a file');
      return;
    }

    importMutation.mutate(selectedFile, {
      onSuccess: (newJobId) => {
        setJobId(newJobId);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      onError: (error: any) => {
        const message = error?.response?.data?.message || 'Failed to upload file';
        alert(message);
      },
    });
  };

  const isProcessing = jobStatus?.status === 'pending' || jobStatus?.status === 'active';
  const isCompleted = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';

  return (
    <RetailPageLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/app/retail/contacts">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Contacts
            </Button>
          </Link>
        </div>
        <RetailPageHeader
          title="Import Contacts"
          description="Upload an Excel file to import contacts in bulk"
        />

        <div className="mb-6 flex items-center gap-3">
          <Upload className="h-8 w-8 text-accent" />
          <h1 className="text-3xl font-bold text-text-primary">Import Contacts</h1>
        </div>

        <RetailCard className="space-y-6 p-6">
          {/* Download Template */}
          <div>
            <h3 className="mb-2 text-lg font-semibold text-text-primary">Download Template</h3>
            <p className="mb-4 text-sm text-text-secondary">
              Download the Excel template to see the required format for importing contacts.
            </p>
            <Button
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate}
              variant="outline"
              size="sm"
            >
              {isDownloadingTemplate ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </>
              )}
            </Button>
          </div>

          {/* File Upload */}
          {!jobId && (
            <div>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Upload File</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Select an Excel (.xlsx) file to import. Maximum file size: 10MB.
              </p>
              <div className="space-y-4">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    className="block w-full cursor-pointer text-sm text-text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent hover:file:bg-accent/20"
                  />
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-text-primary">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>{selectedFile.name}</span>
                    <span className="text-text-tertiary">
                      ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                )}
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || importMutation.isPending}
                  size="sm"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload & Import
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {jobId && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-text-primary">Import Progress</h3>
              {isProcessing && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Loader className="h-5 w-5 animate-spin text-accent" />
                    <span className="text-sm text-text-secondary">Processing import...</span>
                  </div>
                  {jobStatus?.progress && (
                    <div>
                      <div className="mb-1 flex justify-between text-sm text-text-secondary">
                        <span>
                          Processed: {jobStatus.progress.processed} / {jobStatus.progress.total}
                        </span>
                        <span>
                          {jobStatus.progress.total > 0
                            ? Math.round((jobStatus.progress.processed / jobStatus.progress.total) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-light">
                        <div
                          className="h-2 rounded-full bg-accent transition-all"
                          style={{
                            width: `${
                              jobStatus.progress.total > 0
                                ? (jobStatus.progress.processed / jobStatus.progress.total) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isCompleted && jobStatus?.results && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Import completed successfully!</span>
                  </div>
                  <div className="space-y-2 rounded-lg bg-surface-light p-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Contacts created:</span>
                      <span className="text-sm font-medium text-text-primary">
                        {jobStatus.results.created || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-text-secondary">Contacts skipped:</span>
                      <span className="text-sm font-medium text-text-primary">
                        {jobStatus.results.skipped || 0}
                      </span>
                    </div>
                    {jobStatus.results.errors && jobStatus.results.errors.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-red-400">Errors:</p>
                        <ul className="space-y-1 text-sm text-text-secondary">
                          {jobStatus.results.errors.slice(0, 10).map((error, idx) => (
                            <li key={idx} className="text-xs">
                              {error}
                            </li>
                          ))}
                        </ul>
                        {jobStatus.results.errors.length > 10 && (
                          <p className="mt-2 text-xs text-text-tertiary">
                            ... and {jobStatus.results.errors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => router.push('/app/retail/contacts')}
                    size="sm"
                  >
                    View Contacts
                  </Button>
                </div>
              )}

              {isFailed && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Import failed</span>
                  </div>
                  <p className="text-sm text-text-secondary">{jobStatus?.error || 'Unknown error occurred'}</p>
                  <Button
                    onClick={() => {
                      setJobId(null);
                      setSelectedFile(null);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          )}
        </RetailCard>
      </div>
    </RetailPageLayout>
  );
}

