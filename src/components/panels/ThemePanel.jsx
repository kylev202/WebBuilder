/**
 * Theme: change a colour here and it changes everywhere it is used, because
 * elements point at tokens (var(--color-primary)) rather than raw values.
 */
import Icon from '../ui/Icon.jsx'
import { Field, ColorControl, Select, UnitInput } from '../ui/controls.jsx'
import { THEME_PRESETS, TOKEN_GROUPS, FONT_CHOICES, tokenSwatches } from '../../core/theme.js'
import { useStore } from '../../core/store.js'

export default function ThemePanel() {
  const theme = useStore((s) => s.project.theme)
  const applyThemePreset = useStore((s) => s.applyThemePreset)
  const setThemeToken = useStore((s) => s.setThemeToken)
  const setThemeValue = useStore((s) => s.setThemeValue)
  const swatches = tokenSwatches(theme)

  return (
    <>
      <div className="wb-panel-head">
        <span className="wb-panel-title">The look</span>
      </div>
      <div className="wb-panel-sub">
        These settings apply to your whole project. Change one colour and every button, link and heading follows.
      </div>

      <div className="wb-panel-scroll" style={{ padding: '0 12px 16px' }}>
        <div className="wb-group-label" style={{ padding: '4px 0 8px' }}>Ready-made looks</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
          {Object.entries(THEME_PRESETS).map(([id, preset]) => {
            const active = theme.preset === id
            return (
              <button
                key={id}
                onClick={() => applyThemePreset(id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 7, padding: 9,
                  border: `1px solid ${active ? 'var(--ui-accent)' : 'var(--ui-line)'}`,
                  borderRadius: 10, background: 'var(--ui-panel)', textAlign: 'left',
                  boxShadow: active ? '0 0 0 3px var(--ui-accent-soft)' : 'none',
                }}
              >
                <div style={{ display: 'flex', gap: 4 }}>
                  {['primary', 'accent', 'bg', 'text'].map((key) => (
                    <span
                      key={key}
                      style={{
                        width: 16, height: 16, borderRadius: 5,
                        background: preset.colors[key],
                        border: '1px solid rgba(0,0,0,.1)',
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{preset.label}</span>
              </button>
            )
          })}
        </div>

        {TOKEN_GROUPS.map((group) => (
          <div key={group.id}>
            <div className="wb-group-label" style={{ padding: '16px 0 8px' }}>{group.label}</div>
            <div className="wb-col" style={{ gap: 9 }}>
              {group.tokens.map((token) => (
                <Field key={token.key} label={token.label} hint={token.hint}>
                  <ColorControl
                    value={theme.colors[token.key] || ''}
                    onChange={(v) => setThemeToken('colors', token.key, v)}
                    resolve={(v) => v}
                    tokens={swatches.filter((s) => s.key !== token.key)}
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}

        <div className="wb-group-label" style={{ padding: '16px 0 8px' }}>Fonts</div>
        <div className="wb-col" style={{ gap: 9 }}>
          <Field label="Headings">
            <Select
              value={theme.fonts.heading}
              onChange={(v) => setThemeValue('fonts', { ...theme.fonts, heading: v })}
              options={FONT_CHOICES}
            />
          </Field>
          <Field label="Body text">
            <Select
              value={theme.fonts.body}
              onChange={(v) => setThemeValue('fonts', { ...theme.fonts, body: v })}
              options={FONT_CHOICES}
            />
          </Field>
          <div
            style={{
              padding: 12, borderRadius: 10, border: '1px solid var(--ui-line)',
              background: theme.colors.bg, color: theme.colors.text,
            }}
          >
            <div style={{ fontFamily: theme.fonts.heading, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>
              A headline looks like this
            </div>
            <div style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.muted, marginTop: 4, lineHeight: 1.55 }}>
              And ordinary writing sits underneath it, like this sentence does.
            </div>
            <div
              style={{
                display: 'inline-block', marginTop: 10, padding: '7px 14px', borderRadius: theme.radius,
                background: theme.colors.primary, color: '#fff', fontSize: 12, fontWeight: 600,
                fontFamily: theme.fonts.body,
              }}
            >
              A button
            </div>
          </div>
        </div>

        <div className="wb-group-label" style={{ padding: '16px 0 8px' }}>Corners</div>
        <Field label="Roundness" hint="Used by cards and buttons that follow the theme.">
          <UnitInput value={theme.radius} onChange={(v) => setThemeValue('radius', v)} prop="borderRadius" />
        </Field>

        <div
          className="wb-row"
          style={{ marginTop: 18, padding: 10, borderRadius: 9, background: 'var(--ui-panel-2)', border: '1px solid var(--ui-line)', alignItems: 'flex-start' }}
        >
          <Icon name="Info" size={13} style={{ color: 'var(--ui-text-3)', flexShrink: 0, marginTop: 1 }} />
          <div className="wb-small wb-muted" style={{ lineHeight: 1.5 }}>
            Anything you set to a theme colour updates automatically. Elements given a one-off colour keep it.
          </div>
        </div>
      </div>
    </>
  )
}
