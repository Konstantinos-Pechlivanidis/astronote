import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, CheckCircle, XCircle, Loader } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import { useImportContacts } from '../hooks/useImportContacts';
import { useImportJob } from '../hooks/useImportJob';
import { contactsApi } from '../../../api/modules/contacts';
import { toast } from 'sonner';

export default function ContactsImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [jobId, setJobId] = useState(null);

  const importMutation = useImportContacts();
  const { data: jobStatus } = useImportJob(jobId, !!jobId);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        toast.error('Only .xlsx files are allowed');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await contactsApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'contacts_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    importMutation.mutate(selectedFile, {
      onSuccess: (jobId) => {
        setJobId(jobId);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
    });
  };

  const isProcessing = jobStatus?.status === 'pending' || jobStatus?.status === 'active';
  const isCompleted = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed';

  return (
    <div>
      <PageHeader
        title="Import Contacts"
        subtitle="Upload an Excel file to import contacts in bulk"
      />

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Download Template */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Download Template</h3>
          <p className="text-sm text-gray-600 mb-4">
            Download the Excel template to see the required format for importing contacts.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        {/* File Upload */}
        {!jobId && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload File</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select an Excel (.xlsx) file to import. Maximum file size: 10MB.
            </p>
            <div className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>{selectedFile.name}</span>
                  <span className="text-gray-500">
                    ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
              )}
              <button
                onClick={handleUpload}
                disabled={!selectedFile || importMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload & Import
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Import Progress */}
        {jobId && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Progress</h3>
            {isProcessing && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-sm text-gray-700">Processing import...</span>
                </div>
                {jobStatus?.progress && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
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
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
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
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Import completed successfully!</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-700">Contacts created:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {jobStatus.results.created || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-700">Contacts skipped:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {jobStatus.results.skipped || 0}
                    </span>
                  </div>
                  {jobStatus.results.errors && jobStatus.results.errors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {jobStatus.results.errors.slice(0, 10).map((error, idx) => (
                          <li key={idx} className="text-xs">
                            {error}
                          </li>
                        ))}
                      </ul>
                      {jobStatus.results.errors.length > 10 && (
                        <p className="text-xs text-gray-500 mt-2">
                          ... and {jobStatus.results.errors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate('/app/contacts')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View Contacts
                </button>
              </div>
            )}

            {isFailed && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Import failed</span>
                </div>
                <p className="text-sm text-gray-700">{jobStatus?.error || 'Unknown error occurred'}</p>
                <button
                  onClick={() => {
                    setJobId(null);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

