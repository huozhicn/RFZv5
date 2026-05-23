/**
 * Lightweight Markdown → JSX renderer.
 * Supports: **bold**, *italic*, `code`, ```code blocks```, | tables |, - lists
 * No dependencies. ~60 lines.
 */
import React from 'react'

interface TableData {
  headers: string[]
  rows: string[][]
}

export function parseMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (/^```/.test(line.trim())) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing ```
      nodes.push(
        <pre key={nodes.length} style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, fontSize: 12, overflow: 'auto', margin: '8px 0' }}>
          <code>{buf.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Table
    if (line.includes('|') && lines[i + 1]?.includes('---')) {
      const headerLine = line
      i += 2 // skip separator
      const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean)
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean))
        i++
      }
      nodes.push(<MarkdownTable key={nodes.length} headers={headers} rows={rows} />)
      continue
    }

    // Unordered list
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*]\s/, ''))
        i++
      }
      nodes.push(
        <ul key={nodes.length} style={{ margin: '4px 0', paddingLeft: 20, fontSize: 13 }}>
          {items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
        </ul>
      )
      continue
    }

    // Empty line → break
    if (line.trim() === '') {
      i++
      continue
    }

    // Regular paragraph
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !/^```/.test(lines[i].trim()) && !(lines[i].includes('|') && lines[i + 1]?.includes('---')) && !/^[\s]*[-*]\s/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    if (para.length > 0) {
      nodes.push(
        <p key={nodes.length} style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.6 }}>
          {renderInline(para.join('\n'))}
        </p>
      )
    }
  }

  return nodes
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Tokenize: **bold**, *italic*, `code`, plain text
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    if (match[1]) {
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[4]}</em>)
    } else if (match[5]) {
      parts.push(<code key={key++} style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 3, fontSize: 12 }}>{match[6]}</code>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push(text.slice(last))
  }
  return parts
}

function MarkdownTable({ headers, rows }: TableData) {
  return (
    <div style={{ overflow: 'auto', margin: '8px 0', border: '1px solid #e8e8e8', borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e8e8e8', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid #f0f0f0' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '5px 10px', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
