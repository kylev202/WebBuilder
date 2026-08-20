/**
 * The styling controls.
 *
 * Two rules keep this friendly for people who have never written CSS:
 *  - labels describe the effect ("Space inside"), not the property name;
 *  - alignment is expressed as across/down, worked out from the direction the
 *    box is stacking things, so the arrows always point the way you expect.
 */
import Icon from '../ui/Icon.jsx'
import { Field, Select, UnitInput, IconRow, ColorControl, Section, TextInput } from '../ui/controls.jsx'
import { readBox, SIDES, sideKey } from '../../core/css.js'
import { SIZE_MODES, PINS, readSizeMode, writeSizeMode, readPin, pinPatch } from '../../core/sizing.js'
import { resolveColor, tokenSwatches } from '../../core/theme.js'

/* ------------------------------------------------------ shared helpers */

/** A labelled control that shows when the value is set only at this breakpoint. */
export function StyleField({ sx, prop, label, hint, children, inline = true }) {
  const own = sx.isOwn(prop)
  const showReset = own && sx.bucket !== 'base'
  return (
    <Field
      label={label}
      hint={hint}
      inline={inline}
      action={showReset ? (
        <button
          className="wb-tip"
          data-tip={`Remove this ${sx.bucketLabel} change`}
          onClick={() => sx.reset(prop)}
          style={{ border: 0, background: 'none', padding: 0, marginLeft: 'auto', color: '#b45309', display: 'inline-flex' }}
        >
          <Icon name="RotateCcw" size={11} />
        </button>
      ) : null}
    >
      {children}
    </Field>
  )
}

const Color = ({ sx, prop, label, hint }) => (
  <StyleField sx={sx} prop={prop} label={label} hint={hint}>
    <ColorControl
      value={sx.get(prop)}
      onChange={(v) => sx.set(prop, v)}
      tokens={tokenSwatches(sx.theme)}
      resolve={(v) => resolveColor(v, sx.theme)}
    />
  </StyleField>
)

const Num = ({ sx, prop, label, hint, ...rest }) => (
  <StyleField sx={sx} prop={prop} label={label} hint={hint}>
    <UnitInput value={sx.get(prop)} onChange={(v) => sx.set(prop, v)} prop={prop} {...rest} />
  </StyleField>
)

/* --------------------------------------------------------------- layout */

const JUSTIFY = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Middle' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Spread apart' },
]
const ALIGN = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Middle' },
  { value: 'flex-end', label: 'End' },
  { value: 'stretch', label: 'Fill' },
]

export function LayoutSection({ sx }) {
  const display = sx.get('display') || 'block'
  const isFlex = display === 'flex' || display === 'inline-flex'
  const isGrid = display === 'grid'
  const direction = sx.get('flexDirection') || 'row'
  const isRow = isFlex && direction.startsWith('row')

  // Across/down beats "justify/align" for anyone who has not met CSS before.
  const acrossProp = isRow ? 'justifyContent' : 'alignItems'
  const downProp = isRow ? 'alignItems' : 'justifyContent'
  const acrossOptions = (isRow ? JUSTIFY : ALIGN).map((o, i) => ({
    ...o, icon: ['AlignLeft', 'AlignCenter', 'AlignRight', isRow ? 'AlignJustify' : 'StretchHorizontal'][i],
  }))
  const downOptions = (isRow ? ALIGN : JUSTIFY).map((o, i) => ({
    ...o, icon: ['ArrowUpFromLine', 'AlignCenter', 'ArrowDownToLine', isRow ? 'StretchHorizontal' : 'AlignJustify'][i],
  }))

  return (
    <Section title="Arrangement" icon="LayoutGrid">
      <StyleField
        sx={sx}
        prop="display"
        label="Arrange as"
        hint={isFlex || isGrid
          ? 'Things inside are arranged for you, and dragging one reorders it. Hold Cmd while dragging to break one out.'
          : 'Nothing is arranged for you here, so dragging puts things exactly where you drop them.'}
      >
        <Select
          value={display}
          onChange={(v) => {
            if (v === 'flex') sx.setMany({ display: 'flex', flexDirection: sx.get('flexDirection') || 'column' })
            else if (v === 'grid') sx.setMany({ display: 'grid', gridTemplateColumns: sx.get('gridTemplateColumns') || 'repeat(3, minmax(0, 1fr))' })
            else if (v === 'free') sx.setMany({ display: 'block', position: sx.get('position') || 'relative' })
            else sx.set('display', v)
          }}
          options={[
            { value: 'flex', label: 'A stack or a row' },
            { value: 'grid', label: 'An even grid' },
            { value: 'free', label: 'Free -- drop things anywhere' },
            { value: 'block', label: 'One after another' },
            { value: 'inline-flex', label: 'Row that hugs its content' },
            { value: 'inline-block', label: 'Sits in a line of text' },
            { value: 'none', label: 'Hidden' },
          ]}
        />
      </StyleField>

      {isFlex && (
        <>
          <StyleField sx={sx} prop="flexDirection" label="Direction">
            <IconRow
              allowUnset={false}
              value={direction}
              onChange={(v) => sx.set('flexDirection', v)}
              options={[
                { value: 'column', label: 'Stacked, top to bottom', icon: 'AlignVerticalJustifyStart' },
                { value: 'row', label: 'Side by side', icon: 'AlignHorizontalJustifyStart' },
                { value: 'column-reverse', label: 'Stacked, bottom to top', icon: 'ArrowUp' },
                { value: 'row-reverse', label: 'Side by side, reversed', icon: 'ArrowLeft' },
              ]}
            />
          </StyleField>

          <StyleField sx={sx} prop={acrossProp} label="Across">
            <IconRow value={sx.get(acrossProp)} onChange={(v) => sx.set(acrossProp, v)} options={acrossOptions} />
          </StyleField>

          <StyleField sx={sx} prop={downProp} label="Down">
            <IconRow value={sx.get(downProp)} onChange={(v) => sx.set(downProp, v)} options={downOptions} />
          </StyleField>

          <StyleField sx={sx} prop="flexWrap" label="Wrap around" hint="Let things drop onto a new line when they run out of room.">
            <Select
              value={sx.get('flexWrap') || 'nowrap'}
              onChange={(v) => sx.set('flexWrap', v)}
              options={[{ value: 'nowrap', label: 'Keep on one line' }, { value: 'wrap', label: 'Wrap onto new lines' }]}
            />
          </StyleField>
        </>
      )}

      {isGrid && (
        <StyleField sx={sx} prop="gridTemplateColumns" label="Columns">
          <Select
            value={sx.get('gridTemplateColumns')}
            onChange={(v) => sx.set('gridTemplateColumns', v)}
            options={[
              { value: 'repeat(1, minmax(0, 1fr))', label: '1 column' },
              { value: 'repeat(2, minmax(0, 1fr))', label: '2 columns' },
              { value: 'repeat(3, minmax(0, 1fr))', label: '3 columns' },
              { value: 'repeat(4, minmax(0, 1fr))', label: '4 columns' },
              { value: 'repeat(5, minmax(0, 1fr))', label: '5 columns' },
              { value: 'repeat(6, minmax(0, 1fr))', label: '6 columns' },
              { value: '2fr 1fr', label: 'Wide + narrow' },
              { value: '1fr 2fr', label: 'Narrow + wide' },
            ]}
          />
        </StyleField>
      )}

      {(isFlex || isGrid) && <Num sx={sx} prop="gap" label="Space between" hint="The gap between the things inside this box." min={0} />}
    </Section>
  )
}

/* ----------------------------------------------------------------- size */

/**
 * One question per axis: an exact size, fill the space, or hug the contents?
 * The answer is turned into whichever CSS actually does that in the box this
 * element happens to sit in -- `flex: 1` in a row, `width: 100%` in a column.
 */
function AxisSize({ sx, axis, label }) {
  const prop = axis === 'x' ? 'width' : 'height'
  const mode = readSizeMode(sx.style, axis, sx.ctx)
  const typed = mode === 'fixed' || mode === 'relative' || mode === 'viewport'
  const current = SIZE_MODES.find((m) => m.id === mode)

  return (
    <StyleField sx={sx} prop={prop} label={label} hint={current?.hint}>
      <div className="wb-row" style={{ gap: 6 }}>
        <Select
          value={mode}
          onChange={(next) => {
            const measured = sx.measure()
            sx.setMany(writeSizeMode(next, axis, sx.ctx, axis === 'x' ? measured?.width : measured?.height))
          }}
          options={SIZE_MODES.map((m) => ({ value: m.id, label: m.label }))}
        />
        {typed && (
          <div style={{ width: 96, flexShrink: 0 }}>
            <UnitInput value={sx.get(prop)} onChange={(v) => sx.set(prop, v)} prop={prop} />
          </div>
        )}
      </div>
    </StyleField>
  )
}

export function SizeSection({ sx }) {
  return (
    <Section title="Size" icon="Ruler" defaultOpen={false}>
      <AxisSize sx={sx} axis="x" label="Width" />
      <AxisSize sx={sx} axis="y" label="Height" />
      <Num sx={sx} prop="maxWidth" label="Widest" hint="Stops the box growing beyond this, however big the screen is." placeholder="none" />
      <Num sx={sx} prop="minHeight" label="At least tall" placeholder="none" />
      <StyleField sx={sx} prop="overflow" label="If it does not fit">
        <Select
          value={sx.get('overflow') || 'visible'}
          onChange={(v) => sx.set('overflow', v)}
          options={[
            { value: 'visible', label: 'Let it spill out' },
            { value: 'hidden', label: 'Cut it off' },
            { value: 'auto', label: 'Add a scrollbar' },
          ]}
        />
      </StyleField>
      <StyleField sx={sx} prop="aspectRatio" label="Shape" hint="Keeps the width and height in proportion.">
        <Select
          value={sx.get('aspectRatio') || ''}
          onChange={(v) => sx.set('aspectRatio', v)}
          options={[
            { value: '', label: 'Whatever it needs' },
            { value: '1 / 1', label: 'Square' },
            { value: '4 / 3', label: 'Classic (4:3)' },
            { value: '16 / 9', label: 'Widescreen (16:9)' },
            { value: '3 / 4', label: 'Portrait (3:4)' },
          ]}
        />
      </StyleField>
    </Section>
  )
}

/* -------------------------------------------------------------- spacing */

/**
 * The four sides of padding or margin, laid out where they actually sit on
 * the box. A bare number means pixels; anything else is passed through as
 * typed, so "auto" and "2rem" still work.
 */
function BoxModel({ sx, base, label }) {
  const values = readBox(sx.style, base)
  const shown = (side) => String(values[side.toLowerCase()] ?? '').replace(/px$/, '')

  const write = (side, raw) => {
    const trimmed = String(raw).trim()
    const value = trimmed === '' ? '' : /^-?[\d.]+$/.test(trimmed) ? `${trimmed}px` : trimmed
    const key = sideKey(base, side)
    // The shorthand would win over a single side, so retire it on first edit.
    if (sx.style[base]) sx.setMany({ [base]: '', [key]: value })
    else sx.set(key, value)
  }

  return (
    <div className="wb-boxmodel">
      <span className="wb-boxlabel">{label}</span>
      {SIDES.map((side) => (
        <input
          key={side}
          className={`wb-boxfield wb-boxfield--${side.toLowerCase()}`}
          value={shown(side)}
          placeholder="0"
          aria-label={`${label}, ${side.toLowerCase()}`}
          onChange={(e) => write(side, e.target.value)}
        />
      ))}
      <div className="wb-boxmodel-inner">{sx.node.name}</div>
    </div>
  )
}

export function SpacingSection({ sx }) {
  return (
    <Section title="Spacing" icon="Move">
      <div className="wb-hint">Type a number in any side. Values are in pixels.</div>
      <BoxModel sx={sx} base="padding" label="Space inside" />
      <BoxModel sx={sx} base="margin" label="Space outside" />
      <div className="wb-row" style={{ gap: 4 }}>
        {[0, 8, 16, 24, 40, 64].map((n) => (
          <button
            key={n}
            className="wb-preset"
            style={{ flex: 1, padding: '4px 0' }}
            onClick={() => sx.setMany({
              padding: '', paddingTop: `${n}px`, paddingRight: `${n}px`, paddingBottom: `${n}px`, paddingLeft: `${n}px`,
            })}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="wb-hint">Quick padding for all four sides.</div>
    </Section>
  )
}

/* ----------------------------------------------------------- typography */

export function TypographySection({ sx }) {
  return (
    <Section title="Text" icon="Type">
      <StyleField sx={sx} prop="fontFamily" label="Font">
        <Select
          value={sx.get('fontFamily') || ''}
          onChange={(v) => sx.set('fontFamily', v)}
          options={[
            { value: '', label: 'Inherit from the page' },
            { value: 'var(--font-heading)', label: 'Theme heading font' },
            { value: 'var(--font-body)', label: 'Theme body font' },
            { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
            { value: "'Fraunces', Georgia, serif", label: 'Fraunces' },
            { value: 'Georgia, serif', label: 'Georgia' },
            { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
          ]}
        />
      </StyleField>
      <Num sx={sx} prop="fontSize" label="Size" min={1} />
      <StyleField sx={sx} prop="fontWeight" label="Weight">
        <Select
          value={sx.get('fontWeight') || ''}
          onChange={(v) => sx.set('fontWeight', v)}
          options={[
            { value: '', label: 'Normal' }, { value: '300', label: 'Light' }, { value: '400', label: 'Regular' },
            { value: '500', label: 'Medium' }, { value: '600', label: 'Semi bold' },
            { value: '700', label: 'Bold' }, { value: '800', label: 'Extra bold' },
          ]}
        />
      </StyleField>
      <Color sx={sx} prop="color" label="Colour" />
      <StyleField sx={sx} prop="textAlign" label="Alignment">
        <IconRow
          value={sx.get('textAlign')}
          onChange={(v) => sx.set('textAlign', v)}
          options={[
            { value: 'left', label: 'Left', icon: 'AlignLeft' },
            { value: 'center', label: 'Centre', icon: 'AlignCenter' },
            { value: 'right', label: 'Right', icon: 'AlignRight' },
            { value: 'justify', label: 'Even edges', icon: 'AlignJustify' },
          ]}
        />
      </StyleField>
      <StyleField sx={sx} prop="fontStyle" label="Style">
        <div className="wb-row" style={{ gap: 3 }}>
          <IconRow
            value={sx.get('fontStyle')}
            onChange={(v) => sx.set('fontStyle', v)}
            options={[{ value: 'italic', label: 'Italic', icon: 'Italic' }]}
          />
          <IconRow
            value={sx.get('textDecoration')}
            onChange={(v) => sx.set('textDecoration', v)}
            options={[
              { value: 'underline', label: 'Underline', icon: 'Underline' },
              { value: 'line-through', label: 'Crossed out', icon: 'Strikethrough' },
              { value: 'none', label: 'No line', icon: 'Minus' },
            ]}
          />
        </div>
      </StyleField>
      <Num sx={sx} prop="lineHeight" label="Line spacing" step={0.05} units={[]} placeholder="1.5" />
      <Num sx={sx} prop="letterSpacing" label="Letter spacing" step={0.01} units={['px', 'em']} placeholder="0" />
      <StyleField sx={sx} prop="textTransform" label="Capitals">
        <Select
          value={sx.get('textTransform') || 'none'}
          onChange={(v) => sx.set('textTransform', v === 'none' ? '' : v)}
          options={[
            { value: 'none', label: 'As typed' },
            { value: 'uppercase', label: 'ALL CAPITALS' },
            { value: 'capitalize', label: 'First Letters' },
            { value: 'lowercase', label: 'all small' },
          ]}
        />
      </StyleField>
    </Section>
  )
}

/* ---------------------------------------------------------- background */

const GRADIENTS = [
  { label: 'Sunrise', value: 'linear-gradient(135deg, #f97316, #ec4899)' },
  { label: 'Ocean', value: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
  { label: 'Mint', value: 'linear-gradient(135deg, #34d399, #0891b2)' },
  { label: 'Dusk', value: 'linear-gradient(135deg, #6366f1, #a855f7)' },
  { label: 'Slate', value: 'linear-gradient(135deg, #0f172a, #334155)' },
  { label: 'Soft', value: 'linear-gradient(180deg, #ffffff, #f1f5f9)' },
]

export function BackgroundSection({ sx }) {
  const image = sx.get('backgroundImage')
  return (
    <Section title="Background" icon="PaintBucket" defaultOpen={false}>
      <Color sx={sx} prop="backgroundColor" label="Colour" />
      <StyleField sx={sx} prop="backgroundImage" label="Picture" hint="Paste a link to use a photo as the background." inline={false}>
        <TextInput
          value={/^url\(/.test(image || '') ? image.replace(/^url\(['"]?|['"]?\)$/g, '') : ''}
          placeholder="https://…"
          onChange={(v) => sx.set('backgroundImage', v ? `url("${v}")` : '')}
        />
      </StyleField>
      {image && (
        <>
          <StyleField sx={sx} prop="backgroundSize" label="Fit">
            <Select
              value={sx.get('backgroundSize') || 'cover'}
              onChange={(v) => sx.set('backgroundSize', v)}
              options={[
                { value: 'cover', label: 'Fill the box' },
                { value: 'contain', label: 'Fit inside' },
                { value: 'auto', label: 'Original size' },
              ]}
            />
          </StyleField>
          <StyleField sx={sx} prop="backgroundPosition" label="Position">
            <Select
              value={sx.get('backgroundPosition') || 'center'}
              onChange={(v) => sx.set('backgroundPosition', v)}
              options={['center', 'top', 'bottom', 'left', 'right']}
            />
          </StyleField>
        </>
      )}
      <div className="wb-label">Gradients</div>
      <div className="wb-presets">
        {GRADIENTS.map((g) => (
          <button
            key={g.label}
            className="wb-preset"
            style={{ paddingLeft: 22, position: 'relative' }}
            onClick={() => sx.setMany({ backgroundImage: g.value })}
          >
            <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, borderRadius: 4, background: g.value }} />
            {g.label}
          </button>
        ))}
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------- border */

export function BorderSection({ sx }) {
  const width = sx.get('borderWidth')
  return (
    <Section title="Border and corners" icon="Frame" defaultOpen={false}>
      <Num sx={sx} prop="borderWidth" label="Thickness" min={0} />
      {width && width !== '0px' && (
        <>
          <StyleField sx={sx} prop="borderStyle" label="Line style">
            <Select
              value={sx.get('borderStyle') || 'solid'}
              onChange={(v) => sx.set('borderStyle', v)}
              options={[
                { value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' }, { value: 'double', label: 'Double' },
              ]}
            />
          </StyleField>
          <Color sx={sx} prop="borderColor" label="Colour" />
        </>
      )}
      <Num sx={sx} prop="borderRadius" label="Roundness" min={0} />
      <div className="wb-presets">
        {[['Square', '0px'], ['Soft', '8px'], ['Round', '16px'], ['Pill', '999px']].map(([label, value]) => (
          <button key={label} className="wb-preset" onClick={() => sx.set('borderRadius', value)}>{label}</button>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------- effects */

const SHADOWS = [
  { label: 'None', value: '' },
  { label: 'Subtle', value: '0 1px 2px rgba(16, 24, 40, 0.06)' },
  { label: 'Soft', value: '0 4px 12px rgba(16, 24, 40, 0.08)' },
  { label: 'Lifted', value: '0 10px 24px rgba(16, 24, 40, 0.12)' },
  { label: 'Floating', value: '0 20px 48px rgba(16, 24, 40, 0.18)' },
  { label: 'Inset', value: 'inset 0 2px 6px rgba(16, 24, 40, 0.10)' },
]

export function EffectsSection({ sx }) {
  return (
    <Section title="Effects" icon="Sparkles" defaultOpen={false}>
      <StyleField sx={sx} prop="boxShadow" label="Shadow" inline={false}>
        <div className="wb-presets">
          {SHADOWS.map((s) => (
            <button
              key={s.label}
              className="wb-preset"
              data-active={sx.get('boxShadow') === s.value}
              style={sx.get('boxShadow') === s.value ? { borderColor: 'var(--ui-accent)', color: 'var(--ui-accent)' } : undefined}
              onClick={() => sx.set('boxShadow', s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </StyleField>
      <Num sx={sx} prop="opacity" label="See-through" hint="1 is solid, 0 is invisible." step={0.05} units={[]} min={0} max={1} placeholder="1" />
      <StyleField sx={sx} prop="transition" label="Smooth changes" hint="Softens hover effects.">
        <Select
          value={sx.get('transition') || ''}
          onChange={(v) => sx.set('transition', v)}
          options={[
            { value: '', label: 'Instant' },
            { value: 'all .18s ease', label: 'Quick' },
            { value: 'all .3s ease', label: 'Gentle' },
            { value: 'all .6s cubic-bezier(.4,0,.2,1)', label: 'Slow' },
          ]}
        />
      </StyleField>
      <Num sx={sx} prop="rotate" label="Rotate" units={['deg']} step={1} placeholder="0" />
    </Section>
  )
}

/* ------------------------------------------------------------ position */

export function PositionSection({ sx }) {
  const position = sx.get('position') || 'static'
  const placed = position !== 'static' && position !== 'relative'

  const repin = (axis, value) => {
    const m = sx.measure()
    if (!m) return
    const pins = { x: readPin(sx.style, 'x'), y: readPin(sx.style, 'y') }
    pins[axis] = value
    sx.setMany(pinPatch(
      pins,
      { left: m.left, top: m.top, width: m.width, height: m.height },
      { width: m.parentWidth, height: m.parentHeight },
    ))
  }

  return (
    <Section title="Position" icon="MousePointer2" defaultOpen={false}>
      <StyleField sx={sx} prop="position" label="Behaviour" hint="Placed exactly means you can drag it anywhere on the canvas.">
        <Select
          value={position}
          onChange={(v) => {
            if (v === 'static') sx.setMany({ position: '', left: '', top: '', right: '', bottom: '', translate: '' })
            else if (v === 'absolute' || v === 'fixed') {
              const m = sx.measure()
              sx.setMany({
                position: v,
                left: `${Math.round(m?.left ?? 0)}px`,
                top: `${Math.round(m?.top ?? 0)}px`,
                width: sx.get('width') || `${Math.round(m?.width ?? 100)}px`,
              })
            } else sx.set('position', v)
          }}
          options={[
            { value: 'static', label: 'Normal' },
            { value: 'sticky', label: 'Sticks when scrolling' },
            { value: 'fixed', label: 'Stays on screen' },
            { value: 'absolute', label: 'Placed exactly' },
            { value: 'relative', label: 'Nudged from normal' },
          ]}
        />
      </StyleField>

      {placed && (
        <>
          <StyleField
            sx={sx}
            prop="left"
            label="Held across"
            hint="What this is measured from, so it stays put as the page changes width."
          >
            <IconRow
              allowUnset={false}
              value={readPin(sx.style, 'x')}
              onChange={(v) => repin('x', v)}
              options={PINS.x.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))}
            />
          </StyleField>
          <StyleField sx={sx} prop="top" label="Held down">
            <IconRow
              allowUnset={false}
              value={readPin(sx.style, 'y')}
              onChange={(v) => repin('y', v)}
              options={PINS.y.map((p) => ({ value: p.id, label: p.label, icon: p.icon }))}
            />
          </StyleField>
        </>
      )}

      {position !== 'static' && (
        <>
          <Num sx={sx} prop="top" label="From top" placeholder="auto" />
          <Num sx={sx} prop="left" label="From left" placeholder="auto" />
          <Num sx={sx} prop="right" label="From right" placeholder="auto" />
          <Num sx={sx} prop="bottom" label="From bottom" placeholder="auto" />
          <Num sx={sx} prop="zIndex" label="Stacking order" hint="Higher numbers sit on top." units={[]} />
        </>
      )}
    </Section>
  )
}
