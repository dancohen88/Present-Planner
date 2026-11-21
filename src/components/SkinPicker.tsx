import { useState } from 'react'
import { SKINS, applySkin, isSkinId, savedSkin } from '../skins.ts'
import type { SkinId } from '../skins.ts'
import { saveSkinId } from '../storage.ts'

/** Switches the look of the app on this device only. */
export function SkinPicker() {
  const [skin, setSkin] = useState<SkinId>(savedSkin)

  return (
    <label className="skin-picker" title="Change the look on this device">
      <span className="visually-hidden">Skin</span>
      <select
        className="pill"
        value={skin}
        onChange={(event) => {
          const id = event.target.value
          if (!isSkinId(id)) return
          setSkin(id)
          applySkin(id)
          saveSkinId(id)
        }}
      >
        {SKINS.map(({ id, label, icon }) => (
          <option key={id} value={id}>
            {icon} {label}
          </option>
        ))}
      </select>
    </label>
  )
}
