interface JsonViewerProps {
  data: Record<string, unknown>;
  className?: string;
}

export function JsonViewer({ data, className = '' }: JsonViewerProps) {
  return (
    <pre className={`text-xs font-mono bg-surface-900 text-green-400 rounded-lg p-3 overflow-x-auto ${className}`}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
