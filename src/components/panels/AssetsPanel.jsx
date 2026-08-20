/**
 * Images: a small library for the project. Files are stored inside the project
 * itself (as data URLs) so nothing breaks when the project is exported or
 * moved to another computer.
 */
import { useRef, useState } from 'react'
import Icon from '../ui/Icon.jsx'
import { Empty, TextInput } from '../ui/controls.jsx'
import { useStore, useSelectedNode } from '../../core/store.js'

const MAX_INLINE = 900 * 1024 // beyond this a data URL bloats the project

export default function AssetsPanel() {
  const assets = useStore((s) => s.project.assets) || []
  const addAsset = useStore((s) => s.addAsset)
  const removeAsset = useStore((s) => s.removeAsset)
  const setProp = useStore((s) => s.setProp)
  const toast = useStore((s) => s.toast)
  const selected = useSelectedNode()
  const fileRef = useRef(null)
  const [url, setUrl] = useState('')

  const canApply = selected?.type === 'image'

  const onFiles = async (files) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > MAX_INLINE) {
        toast(`"${file.name}" is too big to store here (over 900 KB). Try a smaller version, or paste a link.`, { kind: 'warn', duration: 5000 })
        continue
      }
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.readAsDataURL(file)
      })
      addAsset({ name: file.name, src: dataUrl, kind: 'upload' })
    }
  }

  const apply = (asset) => {
    if (canApply) {
      setProp(selected.id, 'src', asset.src)
      toast('Picture updated')
    } else {
      navigator.clipboard?.writeText(asset.src)
      toast('Link copied — select an Image first to apply it directly')
    }
  }

  return (
    <>
      <div className="wb-panel-head">
        <span className="wb-panel-title">Your pictures</span>
      </div>
      <div className="wb-panel-sub">
        {canApply
          ? 'Click a picture to put it into the image you have selected.'
          : 'Add pictures here, then select an Image on the canvas to use one.'}
      </div>

      <div style={{ padding: '0 12px 10px' }} className="wb-col">
        <button className="wb-btn wb-btn--block" onClick={() => fileRef.current?.click()}>
          <Icon name="Upload" size={14} /> Upload from this computer
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="wb-row">
          <TextInput
            value={url}
            onChange={setUrl}
            placeholder="…or paste a picture link"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) {
                addAsset({ name: 'Linked picture', src: url.trim(), kind: 'link' })
                setUrl('')
              }
            }}
          />
          <button
            className="wb-btn"
            disabled={!url.trim()}
            onClick={() => {
              addAsset({ name: 'Linked picture', src: url.trim(), kind: 'link' })
              setUrl('')
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div
        className="wb-panel-scroll"
        style={{ padding: '0 12px 14px' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onFiles(e.dataTransfer.files)
        }}
      >
        {assets.length === 0 ? (
          <Empty icon="Image" title="No pictures yet">
            Upload a file or drop one here. You can also paste a link to any picture on the web.
          </Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
            {assets.map((asset) => (
              <div
                key={asset.id}
                style={{ position: 'relative', border: '1px solid var(--ui-line)', borderRadius: 9, overflow: 'hidden', background: 'var(--ui-panel-2)' }}
              >
                <button
                  onClick={() => apply(asset)}
                  className="wb-tip"
                  data-tip={canApply ? 'Use this picture' : 'Copy the link'}
                  style={{ display: 'block', width: '100%', height: 78, padding: 0, border: 0, background: 'none' }}
                >
                  <img
                    src={asset.src}
                    alt={asset.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
                <button
                  onClick={() => removeAsset(asset.id)}
                  aria-label="Remove"
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 22, height: 22,
                    display: 'grid', placeItems: 'center', border: 0, borderRadius: 6,
                    background: 'rgba(16,24,40,.62)', color: '#fff',
                  }}
                >
                  <Icon name="X" size={12} />
                </button>
                <div
                  className="wb-small"
                  style={{ padding: '5px 7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={asset.name}
                >
                  {asset.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
