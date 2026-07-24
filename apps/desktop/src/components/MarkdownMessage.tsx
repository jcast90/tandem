import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownMessage({
  text,
  onOpenFile,
}: {
  text: string;
  onOpenFile: (path: string, line?: number) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href = "", children }) => {
          const local = localFileTarget(href);
          if (local) {
            return (
              <button
                className="markdown-file-link"
                type="button"
                onClick={() => onOpenFile(local.path, local.line)}
              >
                {children}
              </button>
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function localFileTarget(href: string): { path: string; line?: number } | null {
  let value = href;
  try {
    value = decodeURIComponent(href);
  } catch {
    // Keep the original target if it is not URL encoded.
  }
  value = value.replace(/^file:\/\//, "");
  if (!value.startsWith("/")) return null;
  const fragment = value.match(/#L(\d+)$/);
  if (fragment) {
    return { path: value.slice(0, -fragment[0].length), line: Number(fragment[1]) };
  }
  const suffix = value.match(/:(\d+)(?::\d+)?$/);
  if (suffix) {
    return { path: value.slice(0, -suffix[0].length), line: Number(suffix[1]) };
  }
  return { path: value };
}
