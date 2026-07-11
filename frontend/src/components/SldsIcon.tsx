import type { CSSProperties } from 'react'
import utilitySprite from '@salesforce-ux/design-system/assets/icons/utility-sprite/svg/symbols.svg?url'
import standardSprite from '@salesforce-ux/design-system/assets/icons/standard-sprite/svg/symbols.svg?url'

export type SldsIconCategory = 'utility' | 'standard'

/**
 * Color treatment for utility icons.
 * - `default`  : neutral gray (good on white/light surfaces)
 * - `current`  : inherits `currentColor` (use inside SLDS buttons so it matches the label)
 * - `error`    : red
 * - `warning`  : orange
 * - `success`  : green
 * - `white`    : white (use on dark/colored surfaces like the alert banner)
 */
export type SldsIconColor =
  | 'default'
  | 'current'
  | 'error'
  | 'warning'
  | 'success'
  | 'white'

interface SldsIconProps {
  category: SldsIconCategory
  /** Icon name, e.g. "error", "user", "event". */
  name: string
  /** Pixel size of the rendered icon. */
  size?: number
  /** Extra class on the outer `slds-icon_container`. */
  className?: string
  /** Accessible title; when omitted the icon is hidden from assistive tech. */
  title?: string
  /** Color treatment for utility icons. Ignored for standard icons. */
  color?: SldsIconColor
  /**
   * Render as a button icon: applies `slds-button__icon` (fill: currentColor)
   * plus `slds-button__icon_left` spacing so it sits correctly next to a label
   * and inherits the button's text color.
   */
  buttonIcon?: boolean
}

const COLOR_CLASS: Record<SldsIconColor, string> = {
  default: 'slds-icon-text-default',
  current: 'slds-current-color',
  error: 'slds-icon-text-error',
  warning: 'slds-icon-text-warning',
  success: 'slds-icon-text-success',
  white: 'slds-icon-text-light',
}

/**
 * Renders an icon from the Salesforce Lightning Design System icon sprite.
 * Standard icons get their colored background via `slds-icon-standard-<name>`;
 * utility icons use one of the `slds-icon-text-*` fill modifiers.
 */
export function SldsIcon({
  category,
  name,
  size = 16,
  className,
  title,
  color = 'default',
  buttonIcon = false,
}: SldsIconProps) {
  const sprite = category === 'standard' ? standardSprite : utilitySprite
  const containerClass =
    category === 'standard'
      ? `slds-icon_container slds-icon-standard-${name}`
      : 'slds-icon_container'
  const svgClass = [
    'slds-icon',
    ...(category === 'standard' ? [] : [buttonIcon ? 'slds-button__icon' : COLOR_CLASS[color]]),
    ...(buttonIcon ? ['slds-button__icon_left'] : []),
  ]
    .filter(Boolean)
    .join(' ')
  const svgStyle: CSSProperties = { width: `${size}px`, height: `${size}px` }

  return (
    <span className={className ? `${containerClass} ${className}` : containerClass}>
      <svg className={svgClass} aria-hidden={title ? undefined : true} style={svgStyle}>
        {title ? <title>{title}</title> : null}
        <use xlinkHref={`${sprite}#${name}`} />
      </svg>
    </span>
  )
}
