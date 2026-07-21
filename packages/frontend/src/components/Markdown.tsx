import type { ReactNode } from "react";
import "./Markdown.css";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: code spans first so ** or _ inside `code` aren't treated as emphasis.
  // Underscore emphasis requires word boundaries so identifiers like FOO_BAR_BAZ aren't mangled.
  const pattern =
    /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|(?<![\w_])_([^_]+)_(?![\w_])|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [whole, code, bold, boldAlt, italic, italicAlt, linkText, linkHref] = match;
    if (code !== undefined) {
      nodes.push(<code key={key++}>{code}</code>);
    } else if (bold !== undefined || boldAlt !== undefined) {
      nodes.push(<strong key={key++}>{bold ?? boldAlt}</strong>);
    } else if (italic !== undefined || italicAlt !== undefined) {
      nodes.push(<em key={key++}>{italic ?? italicAlt}</em>);
    } else if (linkText !== undefined) {
      nodes.push(
        <a key={key++} href={linkHref} target="_blank" rel="noopener noreferrer">
          {linkText}
        </a>,
      );
    } else {
      nodes.push(whole);
    }
    lastIndex = match.index + whole.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const QUOTE_RE = /^>\s?(.*)$/;
const FENCE_RE = /^ {0,3}```/;

export default function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const indent = line.match(/^ */)?.[0].length ?? 0;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i].startsWith(" ".repeat(indent)) ? lines[i].slice(indent) : lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre className="md-code-block" key={key++}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={key++}>{renderInline(heading[2])}</Tag>);
      i++;
      continue;
    }

    if (HR_RE.test(line.trim())) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        const m = lines[i].match(QUOTE_RE);
        quoteLines.push(m?.[1] ?? "");
        i++;
      }
      blocks.push(<blockquote key={key++}>{renderInline(quoteLines.join(" "))}</blockquote>);
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i])) {
        const m = lines[i].match(UL_RE);
        items.push(m?.[1] ?? "");
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list content has no stable identity
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i])) {
        const m = lines[i].match(OL_RE);
        items.push(m?.[1] ?? "");
        i++;
      }
      blocks.push(
        <ol key={key++}>
          {items.map((item, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list content has no stable identity
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines until a blank line or a new block starts.
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !FENCE_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !HR_RE.test(lines[i].trim()) &&
      !QUOTE_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(paraLines.join(" "))}</p>);
  }

  return <div className="md-content">{blocks}</div>;
}
