// Taut Modal API
// Gives access to use Slack's modal system

import { reactPromise } from '../slack/react'
import { findExportPromise } from '../slack/webpack'
import { getReduxStore } from '../slack/redux'
import { elementsAPIPromise } from './elements'

type RawModalHandle = { close: () => void; render: (props: unknown) => void }
type OpenModalThunk = (opts: {
  element: React.ReactElement
  name?: string
}) => unknown

export interface OpenModalOptions {
  title: string
  body: React.ReactNode
  submitText?: string
  cancelText?: string
  onSubmit?: () => void
  onCancel?: () => void
  onClose?: () => void
}

export interface ModalHandle {
  close: () => void
}

export const modalAPIPromise = (async () => {
  await reactPromise
  const elements = await elementsAPIPromise
  const findExport = await findExportPromise

  let openModalThunk: OpenModalThunk | null = null
  try {
    openModalThunk = findExport(
      (e: unknown) =>
        typeof e === 'function' &&
        (e as { meta?: { name?: string } }).meta?.name === 'openModal'
    ) as OpenModalThunk
  } catch (err) {
    console.error('[Taut] Modal API: could not resolve openModal', err)
  }

  const Confirmation = elements.ConfirmationModal
  const Label = elements.Label
  const TextInput = elements.FormTextInput

  function openModal(options: OpenModalOptions): ModalHandle | null {
    const store = getReduxStore()
    if (!store || !openModalThunk) {
      console.error('[Taut] Modal API: Slack modal system unavailable')
      return null
    }

    const closeRef = { current: () => {} }
    const element = (
      <Confirmation
        title={options.title}
        submitButtonText={options.submitText ?? 'Save'}
        cancelButtonText={options.cancelText ?? 'Cancel'}
        onSubmit={() => {
          options.onSubmit?.()
          closeRef.current()
        }}
        onCancel={() => {
          options.onCancel?.()
          closeRef.current()
        }}
        onClose={() => {
          options.onClose?.()
          closeRef.current()
        }}
      >
        {options.body}
      </Confirmation>
    )

    const handle = store.dispatch(
      (openModalThunk as OpenModalThunk)({ element, name: options.title })
    ) as RawModalHandle | undefined
    closeRef.current = () => handle?.close()

    return { close: () => handle?.close() }
  }

  return { openModal, Label, TextInput }
})()

export type ModalAPI = Awaited<typeof modalAPIPromise>
