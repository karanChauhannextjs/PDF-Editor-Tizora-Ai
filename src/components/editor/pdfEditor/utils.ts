import type { AnnotationTool } from '@/types/annotation'

export function toolLabel(tool: AnnotationTool): string {
  switch (tool) {
    case 'select':
      return 'Select'
    case 'rectangle':
      return 'Rectangle'
    case 'circle':
      return 'Circle'
    case 'line':
      return 'Line'
    case 'text':
      return 'Text'
    default: {
      const unreachable: never = tool
      return unreachable
    }
  }
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
