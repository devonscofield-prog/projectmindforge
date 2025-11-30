import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  FileText,
  Users,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisMessageRendererProps {
  content: string;
  onSaveInsight?: (content: string) => void;
  isStreaming?: boolean;
}

// Section patterns to detect and render as collapsible cards
const SECTION_PATTERNS = [
  { pattern: /^#{1,3}\s*📊\s*(.+)$/m, icon: BarChart3, type: 'summary' },
  { pattern: /^#{1,3}\s*⚠️\s*(.+)$/m, icon: AlertTriangle, type: 'warning' },
  { pattern: /^#{1,3}\s*✅\s*(.+)$/m, icon: CheckCircle2, type: 'success' },
  { pattern: /^#{1,3}\s*💡\s*(.+)$/m, icon: Lightbulb, type: 'insight' },
  { pattern: /^#{1,3}\s*🔍\s*(.+)$/m, icon: Target, type: 'analysis' },
  { pattern: /^#{1,3}\s*👥\s*(.+)$/m, icon: Users, type: 'people' },
  { pattern: /^#{1,3}\s*📈\s*(.+)$/m, icon: TrendingUp, type: 'trend' },
  { pattern: /^#{1,3}\s*📄\s*(.+)$/m, icon: FileText, type: 'document' },
  { pattern: /^#{1,3}\s*EXECUTIVE SUMMARY/im, icon: BarChart3, type: 'summary' },
  { pattern: /^#{1,3}\s*KEY FINDINGS/im, icon: Target, type: 'analysis' },
  { pattern: /^#{1,3}\s*RECOMMENDATIONS/im, icon: Lightbulb, type: 'insight' },
  { pattern: /^#{1,3}\s*EVIDENCE/im, icon: FileText, type: 'document' },
  { pattern: /^#{1,3}\s*AREAS?.* IMPROVEMENT/im, icon: AlertTriangle, type: 'warning' },
  { pattern: /^#{1,3}\s*STRENGTHS/im, icon: CheckCircle2, type: 'success' },
];

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  summary: { bg: 'bg-primary/5', border: 'border-primary/20', icon: 'text-primary' },
  warning: { bg: 'bg-warning/5', border: 'border-warning/20', icon: 'text-warning' },
  success: { bg: 'bg-success/5', border: 'border-success/20', icon: 'text-success' },
  insight: { bg: 'bg-accent/5', border: 'border-accent/20', icon: 'text-accent' },
  analysis: { bg: 'bg-muted/50', border: 'border-border', icon: 'text-muted-foreground' },
  people: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', icon: 'text-blue-500' },
  trend: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', icon: 'text-emerald-500' },
  document: { bg: 'bg-muted/50', border: 'border-border', icon: 'text-muted-foreground' },
};

interface ParsedSection {
  title: string;
  content: string;
  type: string;
  Icon: React.ComponentType<{ className?: string }>;
}

function parseContentIntoSections(content: string): { sections: ParsedSection[]; plainContent: string } {
  // Split by markdown headers (##, ###)
  const headerRegex = /^(#{1,3})\s+(.+)$/gm;
  const parts: { header: string; level: number; content: string; startIndex: number }[] = [];
  
  let match;
  const matches: { index: number; header: string; level: number }[] = [];
  
  while ((match = headerRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      header: match[2],
      level: match[1].length,
    });
  }
  
  // If no headers found, return plain content
  if (matches.length === 0) {
    return { sections: [], plainContent: content };
  }
  
  // Extract sections between headers
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index;
    const endIndex = i < matches.length - 1 ? matches[i + 1].index : content.length;
    const sectionContent = content.slice(startIndex, endIndex).replace(/^#{1,3}\s+.+\n?/, '').trim();
    
    parts.push({
      header: matches[i].header,
      level: matches[i].level,
      content: sectionContent,
      startIndex: matches[i].index,
    });
  }
  
  // Content before first header
  const beforeFirstHeader = matches.length > 0 ? content.slice(0, matches[0].index).trim() : content;
  
  // Map parts to sections with detected types
  const sections: ParsedSection[] = parts.map(part => {
    let type = 'document';
    let Icon = FileText;
    
    // Check if header matches any pattern
    for (const pattern of SECTION_PATTERNS) {
      if (pattern.pattern.test(`## ${part.header}`)) {
        type = pattern.type;
        Icon = pattern.icon;
        break;
      }
    }
    
    return {
      title: part.header.replace(/^[📊⚠️✅💡🔍👥📈📄]\s*/, ''),
      content: part.content,
      type,
      Icon,
    };
  });
  
  return { sections, plainContent: beforeFirstHeader };
}

function CollapsibleSection({ section, defaultOpen = true }: { section: ParsedSection; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const styles = TYPE_STYLES[section.type] || TYPE_STYLES.document;
  
  const copyContent = () => {
    navigator.clipboard.writeText(`## ${section.title}\n\n${section.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn('rounded-lg border', styles.bg, styles.border)}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <section.Icon className={cn('h-4 w-4', styles.icon)} />
              <span className="font-medium text-sm">{section.title}</span>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0">
            <div className="analysis-markdown prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown components={markdownComponents}>
                {section.content}
              </ReactMarkdown>
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={copyContent}
                className="h-7 text-xs gap-1"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy section
                  </>
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Custom markdown components for better rendering
const markdownComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-4 rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-border bg-background">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-foreground uppercase tracking-wider whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-3 py-2 text-sm text-foreground whitespace-nowrap">
      {children}
    </td>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-bold mt-4 mb-2 text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-primary">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm text-foreground/90">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block p-3 rounded-lg bg-muted text-sm font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed my-2">{children}</p>
  ),
};

export function AnalysisMessageRenderer({ content, onSaveInsight, isStreaming }: AnalysisMessageRendererProps) {
  const { sections, plainContent } = useMemo(() => parseContentIntoSections(content), [content]);
  
  // If streaming or no sections detected, render as plain markdown
  if (isStreaming || sections.length === 0) {
    return (
      <div className="analysis-markdown prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Content before first section */}
      {plainContent && (
        <div className="analysis-markdown prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown components={markdownComponents}>
            {plainContent}
          </ReactMarkdown>
        </div>
      )}
      
      {/* Collapsible sections */}
      {sections.map((section, index) => (
        <CollapsibleSection 
          key={index} 
          section={section} 
          defaultOpen={index < 3} // First 3 sections open by default
        />
      ))}
    </div>
  );
}

export { markdownComponents };
