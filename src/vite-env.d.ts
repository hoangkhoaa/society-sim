/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_MARXIST_PRESET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
