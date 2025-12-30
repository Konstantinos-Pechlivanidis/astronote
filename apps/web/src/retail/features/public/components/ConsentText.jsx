export default function ConsentText({ text, required = false }) {
  if (!text) return null;

  return (
    <div className="mt-4 p-3 bg-gray-50 rounded-md">
      <p className="text-xs text-gray-700 leading-relaxed">{text}</p>
      {required && (
        <p className="text-xs text-gray-600 mt-2 font-medium">
          * Consent is required to proceed
        </p>
      )}
    </div>
  );
}

