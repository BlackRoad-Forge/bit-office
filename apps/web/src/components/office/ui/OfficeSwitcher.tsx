"use client"

import { useState, useEffect, useCallback } from 'react'
import JSZip from 'jszip'
import type { OfficeLayout } from '../types'
import { loadRoomZipFromUrl } from '../layout/roomZipLoader'

interface OfficeEntry {
  id: string
  name: string
  file: string
  thumbnail?: string
}

interface OfficeEntryWithThumb extends OfficeEntry {
  thumbUrl?: string
}

interface OfficeSwitcherProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (layout: OfficeLayout, backgroundImage: HTMLImageElement | null) => void
  currentOfficeId?: string | null
}

const OFFICES_BASE = '/offices'

/** Extract background image from a zip as a blob URL for thumbnail */
async function extractThumbnail(zipUrl: string): Promise<string | null> {
  try {
    const res = await fetch(zipUrl)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    const zip = await JSZip.loadAsync(ab)
    const roomFile = zip.file('room.json')
    if (!roomFile) return null
    const roomJson = JSON.parse(await roomFile.async('text'))
    const bgFilename = roomJson.backgroundFile
    if (!bgFilename) return null
    const bgFile = zip.file(bgFilename)
    if (!bgFile) return null
    const blob = new Blob([await bgFile.async('arraybuffer')], { type: 'image/png' })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

export default function OfficeSwitcher({ isOpen, onClose, onSelect, currentOfficeId }: OfficeSwitcherProps) {
  const [offices, setOffices] = useState<OfficeEntryWithThumb[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`${OFFICES_BASE}/index.json`)
        const data: OfficeEntry[] = await res.json()
        if (cancelled) return
        setOffices(data.map((e) => ({ ...e })))

        // Extract thumbnails from zips in parallel
        const thumbPromises = data.map(async (entry) => {
          if (entry.thumbnail) return { id: entry.id, url: `${OFFICES_BASE}/${entry.thumbnail}` }
          const url = await extractThumbnail(`${OFFICES_BASE}/${entry.file}`)
          return { id: entry.id, url }
        })
        const thumbs = await Promise.all(thumbPromises)
        if (cancelled) return
        setOffices((prev) =>
          prev.map((e) => {
            const t = thumbs.find((th) => th.id === e.id)
            return t?.url ? { ...e, thumbUrl: t.url } : e
          }),
        )
      } catch (err) {
        console.error('[OfficeSwitcher] Failed to load index:', err)
      }
    })()

    return () => { cancelled = true }
  }, [isOpen])

  const handleSelect = useCallback(async (entry: OfficeEntryWithThumb) => {
    if (loading) return
    setLoading(true)
    setLoadingId(entry.id)
    try {
      const result = await loadRoomZipFromUrl(`${OFFICES_BASE}/${entry.file}`)
      if (result) {
        try { localStorage.setItem('office-selected-id', entry.id) } catch {}
        onSelect(result.layout, result.backgroundImage)
        onClose()
      }
    } catch (err) {
      console.error('[OfficeSwitcher] Failed to load office:', err)
    } finally {
      setLoading(false)
      setLoadingId(null)
    }
  }, [loading, onSelect, onClose])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 99,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          background: '#1e1e2e',
          border: '2px solid #4a4a6a',
          borderRadius: 0,
          padding: 0,
          boxShadow: '2px 2px 0px #0a0a14',
          minWidth: 320,
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid #4a4a6a',
          }}
        >
          <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>
            Switch Office
          </span>
          <button
            onClick={onClose}
            onMouseEnter={() => setHovered('close')}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: hovered === 'close' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >X</button>
        </div>

        {/* Office grid */}
        <div
          style={{
            padding: '12px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
          }}
        >
          {offices.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'monospace', padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>
              Loading...
            </div>
          )}
          {offices.map((entry) => {
            const isCurrent = currentOfficeId === entry.id
            const isLoading = loadingId === entry.id
            const isHovered = hovered === entry.id
            const thumbSrc = entry.thumbUrl || (entry.thumbnail ? `${OFFICES_BASE}/${entry.thumbnail}` : undefined)
            return (
              <button
                key={entry.id}
                onClick={() => handleSelect(entry)}
                onMouseEnter={() => setHovered(entry.id)}
                onMouseLeave={() => setHovered(null)}
                disabled={loading}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: isCurrent
                    ? 'rgba(200, 155, 48, 0.15)'
                    : isHovered
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrent
                    ? '2px solid rgba(200, 155, 48, 0.5)'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 0,
                  padding: 0,
                  cursor: loading ? 'wait' : 'pointer',
                  overflow: 'hidden',
                  opacity: loading && !isLoading ? 0.5 : 1,
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: '100%',
                    paddingBottom: '75%',
                    position: 'relative',
                    background: '#0a0a14',
                  }}
                >
                  {thumbSrc && (
                    <img
                      src={thumbSrc}
                      alt={entry.name}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        imageRendering: 'pixelated',
                      }}
                    />
                  )}
                  {/* Loading overlay */}
                  {isLoading && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#e8b040',
                        fontSize: 12,
                        fontFamily: 'monospace',
                      }}
                    >
                      Loading...
                    </div>
                  )}
                </div>
                {/* Name */}
                <div
                  style={{
                    padding: '6px 8px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: isCurrent ? '#e8b040' : 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    width: '100%',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {entry.name}
                  {isCurrent && ' (current)'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** Load the default office on startup */
export async function loadDefaultOffice(): Promise<{ layout: import('../types').OfficeLayout; backgroundImage: HTMLImageElement | null; officeId: string } | null> {
  try {
    const res = await fetch(`${OFFICES_BASE}/index.json`)
    if (!res.ok) return null
    const offices: OfficeEntry[] = await res.json()
    // Use saved selection or fall back to first entry
    let selectedId: string | null = null
    try { selectedId = localStorage.getItem('office-selected-id') } catch {}
    const entry = offices.find((o) => o.id === selectedId) || offices[0]
    if (!entry) return null

    const result = await loadRoomZipFromUrl(`${OFFICES_BASE}/${entry.file}`)
    if (!result) return null
    return { layout: result.layout, backgroundImage: result.backgroundImage, officeId: entry.id }
  } catch (err) {
    console.error('[loadDefaultOffice] Failed:', err)
    return null
  }
}
