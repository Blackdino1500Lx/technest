import { useRef, useState, useEffect, useCallback } from 'react'
import { Pencil, Eraser, Minus, Square, Circle, Undo2, Trash2, Lock, Play } from 'lucide-react'
import type { Subject } from '../lib/types'

type DrawTool  = 'pen' | 'eraser' | 'line' | 'rect' | 'circle'
type SandboxMode = 'text' | 'draw' | 'code'
type CodeTab   = 'html' | 'css' | 'js' | 'preview'

interface CodeValue { html: string; css: string; js: string }

function parseCode(v: string): CodeValue {
  try {
    const p = JSON.parse(v)
    if (p && typeof p === 'object' && ('html' in p || 'css' in p || 'js' in p))
      return { html: p.html ?? '', css: p.css ?? '', js: p.js ?? '' }
  } catch { /* not JSON */ }
  return { html: '', css: '', js: '' }
}

function serializeCode(c: CodeValue): string { return JSON.stringify(c) }

function extractBodyContent(html: string): string {
  // Si tiene <body>, extraer solo su contenido
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) return bodyMatch[1]
  // Si tiene etiquetas wrapper <html>/<head>, quitarlas
  return html
    .replace(/<html[^>]*>/gi, '').replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim()
}

function buildSrcdoc(c: CodeValue): string {
  const safeJs  = c.js.replace(/<\/script>/gi, '<\\/script>')
  const bodyHtml = extractBodyContent(c.html)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${c.css}</style></head><body>${bodyHtml}<script>${safeJs}<\/script></body></html>`
}

interface Props {
  textValue:      string
  canvasValue:    string
  onTextChange:   (t: string) => void
  onCanvasChange: (img: string) => void
  flagsRef:       React.MutableRefObject<string[]>
  placeholder?:   string
  subject?:       Subject
}

const COLORS = [
  { val: '#111827', label: 'Negro' },
  { val: '#dc2626', label: 'Rojo' },
  { val: '#2563eb', label: 'Azul' },
  { val: '#16a34a', label: 'Verde' },
  { val: '#7c3aed', label: 'Violeta' },
  { val: '#ea580c', label: 'Naranja' },
]
const LINE_WIDTHS = [
  { val: 2, label: 'Fino' },
  { val: 4, label: 'Medio' },
  { val: 8, label: 'Grueso' },
]

const CODE_TABS: Array<{ id: CodeTab; label: string; placeholder: string }> = [
  {
    id: 'html', label: 'HTML',
    placeholder: '<h1>Hola mundo</h1>\n<p>Tu contenido aquí...</p>\n<button id="btn">Clic</button>',
  },
  {
    id: 'css', label: 'CSS',
    placeholder: 'body {\n  font-family: sans-serif;\n  padding: 16px;\n}\nh1 { color: coral; }',
  },
  {
    id: 'js', label: 'JS',
    placeholder: 'const btn = document.getElementById("btn");\nbtn.addEventListener("click", () => {\n  alert("¡Funciona!");\n});',
  },
]

export default function MathSandbox({ textValue, canvasValue, onTextChange, onCanvasChange, flagsRef, placeholder, subject }: Props) {
  const isCode = subject === 'Informática'

  const [mode,    setMode]    = useState<SandboxMode>(isCode ? 'code' : 'text')
  const [codeTab, setCodeTab] = useState<CodeTab>('html')
  const [codeVal, setCodeVal] = useState<CodeValue>(() => isCode ? parseCode(textValue) : { html: '', css: '', js: '' })
  const [srcdoc,  setSrcdoc]  = useState('')

  const [tool,      setTool]      = useState<DrawTool>('pen')
  const [color,     setColor]     = useState('#111827')
  const [lineWidth, setLineWidth] = useState(2)

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const isDrawing   = useRef(false)
  const startPos    = useRef({ x: 0, y: 0 })
  const snapshot    = useRef<ImageData | null>(null)
  const history     = useRef<ImageData[]>([])
  const lastTextLen = useRef(0)

  useEffect(() => {
    if (!canvasValue || !canvasRef.current) return
    const img = new Image()
    img.onload = () => {
      const c = canvasRef.current; if (!c) return
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
    }
    img.src = canvasValue
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveHistory = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    const state = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
    history.current = [...history.current.slice(-24), state]
  }, [])

  const emitCanvas = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    onCanvasChange(c.toDataURL('image/png'))
  }, [onCanvasChange])

  const getPos = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width)  * c.width,
      y: ((e.clientY - rect.top)  / rect.height) * c.height,
    }
  }

  const applyCtx = (ctx: CanvasRenderingContext2D, t: DrawTool) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (t === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = lineWidth * 6
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
      ctx.lineWidth   = lineWidth
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    isDrawing.current = true
    const pos = getPos(e); startPos.current = pos; saveHistory()
    const ctx = canvasRef.current!.getContext('2d')!; applyCtx(ctx, tool)
    if (tool === 'pen' || tool === 'eraser') { ctx.beginPath(); ctx.moveTo(pos.x, pos.y) }
    else { snapshot.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height) }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current) return
    const c = canvasRef.current!; const ctx = c.getContext('2d')!; const pos = getPos(e)
    applyCtx(ctx, tool)
    if (tool === 'pen' || tool === 'eraser') { ctx.lineTo(pos.x, pos.y); ctx.stroke() }
    else if (snapshot.current) {
      ctx.putImageData(snapshot.current, 0, 0)
      ctx.beginPath(); applyCtx(ctx, tool)
      if (tool === 'line') {
        ctx.moveTo(startPos.current.x, startPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke()
      } else if (tool === 'rect') {
        ctx.strokeRect(startPos.current.x, startPos.current.y, pos.x - startPos.current.x, pos.y - startPos.current.y)
      } else if (tool === 'circle') {
        const cx = (startPos.current.x + pos.x) / 2
        const cy = (startPos.current.y + pos.y) / 2
        const rx = Math.abs(pos.x - startPos.current.x) / 2
        const ry = Math.abs(pos.y - startPos.current.y) / 2
        if (rx > 0 && ry > 0) { ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke() }
      }
    }
  }

  const onPointerUp = () => {
    if (!isDrawing.current) return
    isDrawing.current = false; snapshot.current = null; emitCanvas()
  }

  const undo = () => {
    const c = canvasRef.current; if (!c || history.current.length === 0) return
    const prev = history.current[history.current.length - 1]
    history.current = history.current.slice(0, -1)
    c.getContext('2d')!.putImageData(prev, 0, 0); emitCanvas()
  }

  const clear = () => {
    const c = canvasRef.current; if (!c) return
    saveHistory(); c.getContext('2d')!.clearRect(0, 0, c.width, c.height); emitCanvas()
  }

  // ── Code sandbox helpers ─────────────────────────────────────────
  const updateCode = (field: 'html' | 'css' | 'js', value: string) => {
    const diff = value.length - (codeVal[field]?.length ?? 0)
    if (diff > 30 && !flagsRef.current.includes('paste_detected')) flagsRef.current.push('paste_detected')
    const newVal = { ...codeVal, [field]: value }
    setCodeVal(newVal)
    onTextChange(serializeCode(newVal))
  }

  const blockCodePaste = (e: React.ClipboardEvent, _field: 'html' | 'css' | 'js') => {
    const t = e.clipboardData.getData('text')
    if (t.length > 50) {
      e.preventDefault()
      if (!flagsRef.current.includes('paste_blocked')) flagsRef.current.push('paste_blocked')
      alert('⚠️ El pegado no está permitido en esta práctica.')
    }
  }

  const runPreview = () => {
    setSrcdoc(buildSrcdoc(codeVal))
    setCodeTab('preview')
  }

  // ── Mode tabs ─────────────────────────────────────────────────────
  const modeTabs: Array<{ id: SandboxMode; label: string; emoji: string }> = isCode
    ? [
        { id: 'code', label: 'Código', emoji: '💻' },
        { id: 'draw', label: 'Dibujo', emoji: '🎨' },
      ]
    : [
        { id: 'text', label: 'Texto',  emoji: '✏️' },
        { id: 'draw', label: 'Dibujo', emoji: '🎨' },
      ]

  return (
    <div className="math-sandbox">

      {/* Mode bar */}
      <div className="sandbox-mode-bar">
        {modeTabs.map(({ id, label, emoji }) => (
          <button key={id} className={`sandbox-mode-btn ${mode === id ? 'active' : ''}`} onClick={() => setMode(id)}>
            {emoji} {label}
          </button>
        ))}
        <span className="sandbox-secure-badge"><Lock size={11}/> Modo seguro</span>
      </div>

      {/* ── TEXT MODE ──────────────────────────────────────────────── */}
      {mode === 'text' && (
        <textarea
          className="secure-textarea sandbox-textarea"
          value={textValue}
          placeholder={placeholder ?? 'Escribí tu desarrollo aquí...'}
          rows={6}
          onContextMenu={e => e.preventDefault()}
          onPaste={e => {
            const t = e.clipboardData.getData('text')
            if (t.length > 20) {
              e.preventDefault()
              if (!flagsRef.current.includes('paste_blocked')) flagsRef.current.push('paste_blocked')
              alert('⚠️ El pegado no está permitido en esta práctica.')
            }
          }}
          onChange={e => {
            const diff = e.target.value.length - lastTextLen.current
            if (diff > 30 && !flagsRef.current.includes('paste_detected')) flagsRef.current.push('paste_detected')
            lastTextLen.current = e.target.value.length
            onTextChange(e.target.value)
          }}
        />
      )}

      {/* ── CODE MODE ──────────────────────────────────────────────── */}
      {mode === 'code' && (
        <div className="code-sandbox-area">
          {/* Language tabs */}
          <div className="code-editor-tabs">
            {CODE_TABS.map(tab => (
              <button
                key={tab.id}
                className={`code-tab-btn ${codeTab === tab.id ? 'active' : ''}`}
                onClick={() => setCodeTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <button
              className={`code-tab-btn code-tab-preview ${codeTab === 'preview' ? 'active' : ''}`}
              onClick={runPreview}
            >
              <Play size={11}/> Vista previa
            </button>
          </div>

          {/* Editor area */}
          <div className="code-editor-area">
            {codeTab !== 'preview' && (() => {
              const tab = CODE_TABS.find(t => t.id === codeTab)!
              const field = codeTab as 'html' | 'css' | 'js'
              return (
                <>
                  <div className="code-toolbar">
                    <span className="code-lang-hint">
                      {field === 'html' ? '<!-- HTML -->' : field === 'css' ? '/* CSS */' : '// JavaScript'}
                    </span>
                    <button className="code-run-btn" onClick={runPreview}>
                      <Play size={11}/> Ejecutar
                    </button>
                  </div>
                  <textarea
                    className="code-textarea"
                    value={codeVal[field]}
                    placeholder={tab.placeholder}
                    onContextMenu={e => e.preventDefault()}
                    onPaste={e => blockCodePaste(e, field)}
                    onChange={e => updateCode(field, e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </>
              )
            })()}

            {codeTab === 'preview' && (
              <div className="code-preview-container">
                <div className="code-toolbar">
                  <span className="code-lang-hint">Vista previa — resultado en tiempo real</span>
                  <button className="code-run-btn" onClick={() => setSrcdoc(buildSrcdoc(codeVal))}>
                    <Play size={11}/> Actualizar
                  </button>
                </div>
                {srcdoc
                  ? <iframe className="code-preview-frame" srcDoc={srcdoc} sandbox="allow-scripts" title="Vista previa"/>
                  : (
                    <div className="code-preview-empty">
                      <span>▶</span>
                      <p>Presioná <strong>Ejecutar</strong> para ver el resultado de tu código.</p>
                    </div>
                  )
                }
              </div>
            )}
          </div>
          <p className="sandbox-hint">
            💡 Escribí <strong>HTML</strong>, <strong>CSS</strong> y <strong>JS</strong> en cada pestaña.
            Presioná <strong>Ejecutar</strong> o <strong>Vista previa</strong> para ver el resultado.
          </p>
        </div>
      )}

      {/* ── DRAW MODE ──────────────────────────────────────────────── */}
      {mode === 'draw' && (
        <div className="sandbox-draw-area">
          <div className="sandbox-toolbar">
            <div className="sb-tool-group">
              {([
                { t: 'pen'    as DrawTool, Icon: Pencil, label: 'Lápiz' },
                { t: 'eraser' as DrawTool, Icon: Eraser, label: 'Borrador' },
                { t: 'line'   as DrawTool, Icon: Minus,  label: 'Línea' },
                { t: 'rect'   as DrawTool, Icon: Square, label: 'Rectángulo' },
                { t: 'circle' as DrawTool, Icon: Circle, label: 'Círculo' },
              ]).map(({ t, Icon, label }) => (
                <button key={t} className={`sb-tool-btn ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)} title={label}>
                  <Icon size={16}/>
                </button>
              ))}
            </div>
            <div className="sb-tool-group">
              {COLORS.map(c => (
                <button
                  key={c.val}
                  className={`sb-color-btn ${color === c.val ? 'active' : ''}`}
                  style={{ background: c.val }}
                  onClick={() => { setColor(c.val); setTool(prev => prev === 'eraser' ? 'pen' : prev) }}
                  title={c.label}
                />
              ))}
            </div>
            <div className="sb-tool-group">
              {LINE_WIDTHS.map(({ val, label }) => (
                <button key={val} className={`sb-tool-btn ${lineWidth === val ? 'active' : ''}`} onClick={() => setLineWidth(val)} title={label}>
                  <div className="sb-width-dot" style={{ width: val * 3 + 4, height: val * 3 + 4 }}/>
                </button>
              ))}
            </div>
            <div className="sb-tool-group">
              <button className="sb-tool-btn" onClick={undo} title="Deshacer"><Undo2 size={16}/></button>
              <button className="sb-tool-btn sb-danger" onClick={() => { if (confirm('¿Limpiar todo el dibujo?')) clear() }} title="Limpiar">
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
          <canvas
            ref={canvasRef} width={800} height={480} className="sandbox-canvas"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}    onPointerLeave={onPointerUp}
            style={{ touchAction: 'none' }}
          />
          <p className="sandbox-hint">
            💡 Usá los dedos o el mouse para dibujar.
            Cambiá a <strong>{isCode ? 'Código' : 'Texto'}</strong> si necesitás escribir.
          </p>
        </div>
      )}
    </div>
  )
}
