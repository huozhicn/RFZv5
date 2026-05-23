import type { AgentAction, NavigateAction, FilterAction, HighlightAction, OpenDetailAction, OpenCreateAction, DownloadAction, RefreshAction } from './types'

export interface TableController {
  setFilter: (field: string, value: string) => void
  highlightRows: (rowIds: string[]) => void
  refresh: () => void
}

export interface DetailController {
  openDetail: (recordId: string) => void
  openCreate: (table: string, prefill?: Record<string, unknown>) => void
}

interface DispatchContext {
  router: any
  tableRefs: Map<string, TableController>
  detailRef: DetailController
}

/** Get the currently active table name from the URL hash */
function currentHashTable(): string | null {
  const match = window.location.hash.slice(1).match(/^\/tables\/(\w+)/)
  return match ? match[1] : null
}

export function dispatchActions(actions: AgentAction[], ctx: DispatchContext) {
  for (const action of actions) {
    switch (action.type) {
      case 'navigate': {
        const a = action as NavigateAction
        const tableName = a.route.replace(/^\/tables\//, '')
        window.location.hash = `#/tables/${tableName}`
        break
      }
      case 'filter': {
        const a = action as FilterAction
        const t = currentHashTable()
        if (t) ctx.tableRefs.get(t)?.setFilter(a.field, a.value)
        break
      }
      case 'highlight': {
        const a = action as HighlightAction
        const t = currentHashTable()
        if (t) ctx.tableRefs.get(t)?.highlightRows(a.row_ids)
        break
      }
      case 'open_detail': {
        const a = action as OpenDetailAction
        ctx.detailRef.openDetail(a.record_id)
        break
      }
      case 'open_create': {
        const a = action as OpenCreateAction
        ctx.detailRef.openCreate(a.table, a.prefill)
        break
      }
      case 'download': {
        const a = action as DownloadAction
        triggerDownload(a)
        break
      }
      case 'refresh': {
        const t = currentHashTable()
        if (t) ctx.tableRefs.get(t)?.refresh()
        break
      }
      // data, confirm, reply are rendered inline by ChatPanel — no dispatch needed
    }
  }
}

async function triggerDownload(action: DownloadAction) {
  try {
    // Build CSV from the query result
    // For now, we rely on Agent providing data directly
    // If sql is provided, the Agent should have prefetched and included rows in a data action
    // For CSV download from current table view, use client-side export
    const table = document.querySelector('table')
    if (!table) return

    const rows: string[][] = []
    table.querySelectorAll('tr').forEach(tr => {
      const cells: string[] = []
      tr.querySelectorAll('th, td').forEach(td => cells.push(td.textContent?.trim() ?? ''))
      rows.push(cells)
    })

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = action.filename || 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[dispatch] download failed:', err)
  }
}
