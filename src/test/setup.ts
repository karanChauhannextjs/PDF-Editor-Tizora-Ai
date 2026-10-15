import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { resetEditorSessionStoreForTests } from '@/stores/editorSessionStore'
import { clearMemoryStorageForTests } from '@/utils/idbStorage'

beforeEach(() => {
  clearMemoryStorageForTests()
  resetEditorSessionStoreForTests()
})

afterEach(() => {
  cleanup()
})
