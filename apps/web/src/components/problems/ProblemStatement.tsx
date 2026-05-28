'use client';

import { Fragment } from 'react';
import type { Problem } from '@vyro/types';
import { cn } from '@/lib/utils';

// ── Inline markdown tokenizer ─────────────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, ~~strike~~, no XSS

type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'strike'; content: string };

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Pattern priority: code > bold > italic > strike
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', content: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('`'))  tokens.push({ type: 'code',   content: raw.slice(1, -1) });
    else if (raw.startsWith('**')) tokens.push({ type: 'bold',   content: raw.slice(2, -2) });
    else if (raw.startsWith('*'))  tokens.push({ type: 'italic', content: raw.slice(1, -1) });
    else if (raw.startsWith('~~')) tokens.push({ type: 'strike', content: raw.slice(2, -2) });
    last = m.index + raw.length;
  }

  if (last < text.length) tokens.push({ type: 'text', content: text.slice(last) });
  return tokens;
}

function InlineContent({ text }: { text: string }) {
  const tokens = tokenizeInline(text);
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'bold':   return <strong key={i} className="font-semibold text-white">{t.content}</strong>;
          case 'italic': return <em key={i} className="italic text-white/80">{t.content}</em>;
          case 'strike': return <s key={i} className="line-through text-white/40">{t.content}</s>;
          case 'code':
            return (
              <code key={i} className="px-1.5 py-0.5 rounded-md bg-[#00d4ff]/12 border border-[#00d4ff]/20 font-mono text-[11.5px] text-[#c9aeff] mx-0.5 align-[0.03em]">
                {t.content}
              </code>
            );
          default: return <Fragment key={i}>{t.content}</Fragment>;
        }
      })}
    </>
  );
}

// ── Block-level markdown renderer ────────────────────────────────────────────
// Handles: headings, code blocks, blockquotes, lists (ul/ol), paragraphs, ---

type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'codeblock'; lang: string; code: string }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' };

function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'codeblock', lang, code: codeLines.join('\n') });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings
    const h1m = line.match(/^#\s+(.+)/);
    const h2m = line.match(/^##\s+(.+)/);
    const h3m = line.match(/^###\s+(.+)/);
    if (h1m) { blocks.push({ type: 'h1', text: h1m[1] }); i++; continue; }
    if (h2m) { blocks.push({ type: 'h2', text: h2m[1] }); i++; continue; }
    if (h3m) { blocks.push({ type: 'h3', text: h3m[1] }); i++; continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: bqLines });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Skip blank lines between blocks
    if (!line.trim()) { i++; continue; }

    // Paragraph — collect consecutive non-blank, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) blocks.push({ type: 'paragraph', lines: paraLines });
  }

  return blocks;
}

function MarkdownBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'h1':
      return <h1 className="text-[17px] font-bold text-white mt-5 mb-2 first:mt-0"><InlineContent text={block.text} /></h1>;
    case 'h2':
      return <h2 className="text-[14px] font-bold text-white/90 mt-4 mb-1.5 first:mt-0"><InlineContent text={block.text} /></h2>;
    case 'h3':
      return <h3 className="text-[13px] font-semibold text-white/80 mt-3 mb-1 first:mt-0"><InlineContent text={block.text} /></h3>;

    case 'paragraph':
      return (
        <p className="text-[13px] leading-[1.75] text-white/70 mb-3 last:mb-0">
          {block.lines.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              <InlineContent text={line} />
            </Fragment>
          ))}
        </p>
      );

    case 'codeblock':
      return (
        <div className="my-3 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117]">
          {block.lang && (
            <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[9px] font-mono text-white/30 uppercase tracking-widest">
              {block.lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto font-mono text-[12px] text-[#c9d1d9] leading-relaxed whitespace-pre">
            <code>{block.code}</code>
          </pre>
        </div>
      );

    case 'blockquote':
      return (
        <blockquote className="my-3 pl-3.5 border-l-2 border-[#00d4ff]/50">
          {block.lines.map((l, i) => (
            <p key={i} className="text-[12.5px] text-white/55 leading-relaxed italic">
              <InlineContent text={l} />
            </p>
          ))}
        </blockquote>
      );

    case 'ul':
      return (
        <ul className="my-3 space-y-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-white/70 leading-[1.65]">
              <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-[#00d4ff]/70 shrink-0" />
              <span><InlineContent text={item} /></span>
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol className="my-3 space-y-1.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13px] text-white/70 leading-[1.65]">
              <span className="mt-0 text-[11px] font-mono font-semibold text-[#00d4ff]/80 tabular-nums shrink-0 w-5 text-right">
                {i + 1}.
              </span>
              <span><InlineContent text={item} /></span>
            </li>
          ))}
        </ol>
      );

    case 'hr':
      return <hr className="my-4 border-none h-px bg-white/[0.07]" />;

    default:
      return null;
  }
}

function Markdown({ content }: { content: string }) {
  const blocks = parseMarkdown(content);
  return (
    <div className="text-white/70">
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block} />
      ))}
    </div>
  );
}

// ── Difficulty badge ──────────────────────────────────────────────────────────

const DIFF_BADGE: Record<string, string> = {
  easy:   'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/25',
  medium: 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/25',
  hard:   'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/25',
};

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30 mb-3">
      {label}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProblemStatementProps {
  problem: Problem;
}

export function ProblemStatement({ problem }: ProblemStatementProps) {
  return (
    // No overflow-y-auto here — that's handled by the parent LeftPanel
    <div className="space-y-6">

      {/* ── Title + meta ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-start gap-3 mb-3 flex-wrap">
          <h1 className="text-[16px] font-bold text-white leading-snug flex-1 min-w-0">
            {problem.title}
          </h1>
          <span className={cn(
            'shrink-0 self-start text-[10px] font-bold px-2.5 py-1 rounded-lg border',
            DIFF_BADGE[problem.difficulty] ?? 'text-white/50 bg-white/5 border-white/10'
          )}>
            {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
          </span>
        </div>

        {/* Tags */}
        {problem.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {problem.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10.5px] text-[#00d4ff]/70 bg-[#00d4ff]/8 border border-[#00d4ff]/15 px-2.5 py-0.5 rounded-full font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Description ───────────────────────────────────────────────────── */}
      <div>
        <Markdown content={problem.description} />
      </div>

      {/* ── Examples ──────────────────────────────────────────────────────── */}
      {problem.examples?.length > 0 && (
        <div className="space-y-3">
          <SectionHeader label="Examples" />
          {problem.examples.map((example, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.07] bg-[#161b22]/60 overflow-hidden"
            >
              {/* Label */}
              <div className="px-4 py-2 border-b border-white/[0.05] bg-white/[0.02]">
                <span className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">
                  Example {i + 1}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Input */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                    Input
                  </p>
                  <pre className="font-mono text-[12px] text-white/85 bg-black/30 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre leading-relaxed border border-white/[0.06]">
                    {example.input}
                  </pre>
                </div>

                {/* Output */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/50 mb-1.5">
                    Output
                  </p>
                  <pre className="font-mono text-[12px] text-emerald-300 bg-emerald-400/5 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre leading-relaxed border border-emerald-400/[0.12]">
                    {example.output}
                  </pre>
                </div>

                {/* Explanation */}
                {example.explanation && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5">
                      Explanation
                    </p>
                    <p className="text-[12.5px] text-white/60 leading-relaxed">
                      <InlineContent text={example.explanation} />
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Constraints ───────────────────────────────────────────────────── */}
      {problem.constraints?.length > 0 && (
        <div>
          <SectionHeader label="Constraints" />
          <div className="rounded-xl border border-white/[0.07] bg-[#161b22]/40 px-4 py-3 space-y-2">
            {problem.constraints.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-[5px] w-1 h-1 rounded-full bg-[#00d4ff]/50 shrink-0" />
                <code className="font-mono text-[12px] text-[#c9d1d9]/80 leading-relaxed break-all">
                  <InlineContent text={c} />
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom padding so last element isn't right at the edge when scrolled */}
      <div className="h-2" />
    </div>
  );
}
