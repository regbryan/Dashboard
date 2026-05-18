"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Renders a Markdown document with Mermaid `\`\`\`mermaid` blocks
 * rendered as actual diagrams. Mermaid loads lazily from a CDN so
 * we don't add it to the production bundle for every page.
 *
 * Used by the admin-only /dev/* dev-docs routes — kept deliberately
 * minimal: no markdown sanitization library, no syntax highlighter,
 * just enough to surface the architecture / schema / flow diagrams
 * we want stakeholders to be able to click into.
 *
 * Markdown features supported:
 *   - headings (#, ##, ###)
 *   - paragraphs
 *   - inline code with backticks
 *   - bold (**) and italic (*)
 *   - bulleted lists (-)
 *   - ordered lists (1.)
 *   - blockquotes (>)
 *   - tables (GitHub pipe syntax)
 *   - mermaid code blocks → live SVG
 *   - other code blocks → plain <pre>
 *
 * Anything richer (footnotes, task lists, nested lists) gets rendered
 * as plain text — these docs are operator-facing, not Substack posts.
 */
export default function DocViewer({ markdown }: { markdown: string }) {
  const rootId = useId();
  const mermaidLoaded = useRef(false);
  const [, force] = useState(0);

  // `markdown` is the actual trigger for re-rendering. Biome can't see it
  // because the effect queries DOM mounted by the sibling
  // dangerouslySetInnerHTML below — dropping the dep would stop mermaid from
  // re-rendering when the doc text changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    let cancelled = false;
    const renderMermaid = async () => {
      const nodes = document.querySelectorAll<HTMLElement>(
        `[data-doc-root="${rootId}"] [data-mermaid]`
      );
      if (nodes.length === 0) return;
      if (!mermaidLoaded.current) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.getElementById("mermaid-cdn");
          if (existing) return resolve();
          const s = document.createElement("script");
          s.id = "mermaid-cdn";
          s.src = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("mermaid load failed"));
          document.head.appendChild(s);
        });
        mermaidLoaded.current = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = (window as any).mermaid;
        m.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            background: "#0a0a14",
            primaryColor: "#1a1a2e",
            primaryTextColor: "#dcdce4",
            primaryBorderColor: "rgba(255,255,255,0.18)",
            lineColor: "#8a8a98",
            secondaryColor: "#13121f",
            tertiaryColor: "#0f0f1a",
            fontFamily: "var(--font-jakarta), system-ui, sans-serif",
          },
          securityLevel: "loose",
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (window as any).mermaid;
      for (const node of Array.from(nodes)) {
        if (cancelled) return;
        if (node.getAttribute("data-rendered") === "true") continue;
        const src = node.getAttribute("data-mermaid") ?? "";
        const id = `${rootId}-${Array.from(nodes).indexOf(node)}`;
        try {
          const { svg } = await m.render(id, src);
          node.innerHTML = svg;
          node.setAttribute("data-rendered", "true");
        } catch (err) {
          node.innerHTML = `<pre style="color:#fca5a5;font-size:12px;">${escapeHtml(
            err instanceof Error ? err.message : "Mermaid render failed"
          )}</pre>`;
        }
      }
      force((n) => n + 1);
    };
    renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [markdown, rootId]);

  return (
    <div
      data-doc-root={rootId}
      className="doc-viewer"
      style={{
        color: "#dcdce4",
        fontSize: "14px",
        lineHeight: 1.7,
        maxWidth: "920px",
        margin: "0 auto",
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown produces our own escaped HTML from trusted .md files bundled into the build (docs/architecture, docs/schema, docs/flows). No user-supplied content reaches this prop. /dev/* is admin-gated.
      dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
    />
  );
}

// ─── Minimal markdown renderer ───────────────────────────────────────

function renderMarkdown(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block (including mermaid)
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const code = buf.join("\n");
      if (lang === "mermaid") {
        out.push(
          `<div data-mermaid="${escapeAttr(code)}" style="background:#0a0a14;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:18px;margin:18px 0;overflow:auto;">${escapeHtml(
            "Loading diagram…"
          )}</div>`
        );
      } else {
        out.push(
          `<pre style="background:#0a0a14;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 16px;overflow:auto;font-size:12.5px;line-height:1.55;color:#bfbfcc;font-family:ui-monospace,SF Mono,Menlo,monospace;">${escapeHtml(
            code
          )}</pre>`
        );
      }
      continue;
    }
    // Heading
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = inline(heading[2]);
      const size = level === 1 ? "30px" : level === 2 ? "22px" : "16px";
      const weight = level === 3 ? 600 : 600;
      const mt = level === 1 ? "0" : level === 2 ? "32px" : "22px";
      const mb = level === 1 ? "16px" : "10px";
      const color = level === 1 ? "white" : "#dcdce4";
      out.push(
        `<h${level} style="font-size:${size};font-weight:${weight};margin:${mt} 0 ${mb};color:${color};letter-spacing:-0.01em;">${text}</h${level}>`
      );
      i++;
      continue;
    }
    // Table — detect header row + separator
    if (
      line.startsWith("|") &&
      lines[i + 1]?.match(/^\|[\s:|-]+\|$/)
    ) {
      const header = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2; // skip separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }
      out.push(renderTable(header, rows));
      continue;
    }
    // Blockquote
    if (line.startsWith("> ")) {
      out.push(
        `<blockquote style="margin:14px 0;padding:8px 14px;border-left:3px solid rgba(192,132,252,0.4);background:rgba(192,132,252,0.04);color:#bfbfcc;font-size:13px;">${inline(
          line.slice(2)
        )}</blockquote>`
      );
      i++;
      continue;
    }
    // Bulleted list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(
        `<ul style="margin:10px 0 14px;padding-left:22px;color:#bfbfcc;">${items.join("")}</ul>`
      );
      continue;
    }
    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(
          `<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`
        );
        i++;
      }
      out.push(
        `<ol style="margin:10px 0 14px;padding-left:22px;color:#bfbfcc;">${items.join("")}</ol>`
      );
      continue;
    }
    // Blank line → paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Default: paragraph (gather consecutive non-blank lines)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !lines[i].startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith("|") &&
      !lines[i].startsWith("> ")
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(
      `<p style="margin:0 0 14px;color:#bfbfcc;">${inline(buf.join(" "))}</p>`
    );
  }
  return out.join("\n");
}

function renderTable(header: string[], rows: string[][]): string {
  const th = header
    .map(
      (h) =>
        `<th style="text-align:left;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.14);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9999a6;font-weight:600;">${inline(
          h
        )}</th>`
    )
    .join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c) =>
              `<td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;color:#dcdce4;vertical-align:top;">${inline(
                c
              )}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<div style="overflow-x:auto;margin:14px 0;border:1px solid rgba(255,255,255,0.08);border-radius:10px;"><table style="width:100%;border-collapse:collapse;"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function inline(text: string): string {
  // Escape first, then re-apply markup transformations
  let s = escapeHtml(text);
  // Bold
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic (single asterisk, not inside bold)
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  // Inline code
  s = s.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;font-size:12.5px;font-family:ui-monospace,SF Mono,Menlo,monospace;color:#e9d5ff;">$1</code>'
  );
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, "&#10;");
}
