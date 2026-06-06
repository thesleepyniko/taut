// Taut React Utilities
// Provides utilities for finding and patching React components
// Implements component patching via React.createElement proxy

import { findExportPromise, waitForExport } from './webpack'

const global = globalThis as any

// React Promise - waits for React, patches createElement, then resolves

function isReact(exp: any): exp is typeof import('react') {
  return (
    exp &&
    typeof exp === 'object' &&
    'createElement' in exp &&
    'Component' in exp &&
    'useState' in exp
  )
}
export const reactPromise: Promise<typeof import('react')> = (async () => {
  const React = await waitForExport(isReact)

  // Proxy React.createElement to intercept component creation
  React.createElement = new Proxy(React.createElement, {
    apply(
      target: typeof React.createElement,
      thisArg: any,
      [component, props, ...children]: [
        component: ComponentType | originalComponentObject,
        props: any,
        ...children: any[],
      ]
    ) {
      const __original = props && props['__original']
      if (__original) {
        delete props['__original']
      }

      if (isOriginalComponentObject(component)) {
        const originalComponent = component['originalComponent']
        return Reflect.apply(target, thisArg, [
          originalComponent,
          props,
          ...children,
        ])
      }

      if (!__original) {
        // Memoize the resolved component per component identity
        // so we only run matchers once per type
        const cacheable =
          typeof component === 'object' || typeof component === 'function'

        if (cacheable && notPatchedCache.has(component)) {
          // Known to match no replacers; fall through to the default return.
        } else if (cacheable && resolvedComponentCache.has(component)) {
          return Reflect.apply(target, thisArg, [
            resolvedComponentCache.get(component),
            props,
            ...children,
          ])
        } else {
          const componentReplacers = [
            ...componentReplacements
              .entries()
              .filter(([matcher, _]) => matcher(component))
              .map(([_, replacer]) => replacer),
          ]
          if (componentReplacers.length > 0) {
            const originalComponent = getOriginalComponentObject(
              component
            ) as unknown as ComponentType

            const replacedComponent = componentReplacers.reduce(
              (currentComponent, replacer) =>
                applyReplacerWithCache(replacer, currentComponent),
              originalComponent
            )
            if (cacheable) {
              resolvedComponentCache.set(component, replacedComponent)
            }
            return Reflect.apply(target, thisArg, [
              replacedComponent,
              props,
              ...children,
            ])
          } else if (cacheable) {
            notPatchedCache.add(component)
          }
        }
      }

      return Reflect.apply(target, thisArg, [component, props, ...children])
    },
  })

  global.React = React
  return React
})()

declare global {
  namespace React {
    interface Attributes {
      __original?: true
    }
  }
}

// ReactDOM Promises

function isReactDOM(exp: any): exp is typeof import('react-dom') {
  return (
    exp && typeof exp === 'object' && 'render' in exp && 'createPortal' in exp
  )
}

function isReactDOMClient(exp: any): exp is typeof import('react-dom/client') {
  return (
    exp &&
    typeof exp === 'object' &&
    'createRoot' in exp &&
    'hydrateRoot' in exp
  )
}

export const reactDOMPromise: Promise<typeof import('react-dom')> =
  (async () => {
    const ReactDOM = await waitForExport(isReactDOM)
    global.ReactDOM = ReactDOM
    return ReactDOM
  })()

export const reactDOMClientPromise: Promise<typeof import('react-dom/client')> =
  (async () => {
    const ReactDOMClient = await waitForExport(isReactDOMClient)
    global.ReactDOMClient = ReactDOMClient
    return ReactDOMClient
  })()

// Component Finding
// If using this outside of a plugin, ensure your desired component has loaded first

type filter = (exp: any) => boolean

function componentFilter(name: string, filter?: filter) {
  const func = (exp: any) => {
    if (!exp) return false
    if (filter && !filter(exp)) return false

    if (typeof exp === 'object') {
      if (exp.$$typeof === Symbol.for('react.memo')) {
        if (exp.displayName === name) return true
        if (getComponentName(exp.type) === name) return true
      }
      if (exp.$$typeof === Symbol.for('react.forward_ref')) {
        if (exp.displayName === name) return true
        if (exp.render?.displayName === name) return true
        if (exp.render?.name === name) return true
      }
    }

    if (typeof exp === 'function') {
      if (exp.displayName === name) return true
      if (exp.name === name) return true
    }

    return false
  }

  return func
}

export const findComponentPromise = (async () => {
  const findExport = await findExportPromise
  function findComponent<P extends {}>(
    name: string,
    all?: false,
    filter?: filter
  ): React.ComponentType<P>
  function findComponent<P extends {}>(
    name: string,
    all: true,
    filter?: filter
  ): React.ComponentType<P>[]
  function findComponent(name: string, all = false, filter?: filter) {
    const func = componentFilter(name, filter)

    if (all) {
      return findExport(func, true)
    } else {
      const result = findExport(func)
      if (!result) throw new Error(`[Taut] Could not find component: ${name}`)
      return result
    }
  }
  global.findComponent = findComponent
  return findComponent
})()

// Fiber Utilities (promise-wrapped)

function getRootFiber() {
  const container = document.querySelector('.p-client_container')
  if (!container) throw new Error('Could not find root container')
  const key = Object.keys(container).find((k) =>
    k.startsWith('__reactContainer$')
  )
  if (!key) throw new Error('Could not find root fiber key on container')
  const rootFiber = (container as any)[key]
  return rootFiber
}

// function getFiberRoot() {
//   const __REACT_DEVTOOLS_GLOBAL_HOOK__ = global.__REACT_DEVTOOLS_GLOBAL_HOOK__
//   if (!__REACT_DEVTOOLS_GLOBAL_HOOK__) {
//     throw new Error('React DevTools hook not found')
//   }
//   return [...__REACT_DEVTOOLS_GLOBAL_HOOK__?.getFiberRoots?.(1)]?.[0]
// }

// export const getRootPromise = (async () => {
//   const ReactDOMClient = await reactDOMClientPromise

//   return function getRoot() {
//     const tempRoot = ReactDOMClient.createRoot(document.createElement('div'))
//     tempRoot.unmount()
//     const ReactDOMRoot = tempRoot.constructor as new (fiberRoot: any) => Root
//     const fiberRoot = getFiberRoot()
//     return new ReactDOMRoot(fiberRoot)
//   }
// })()

function dirtyMemoizationCache() {
  const rootFiber = getRootFiber()

  const poison = (node: any) => {
    if (!node) return
    if (node.memoizedProps && typeof node.memoizedProps === 'object') {
      node.memoizedProps = { ...node.memoizedProps, _poison: 1 }
    }
    poison(node.child)
    poison(node.sibling)
  }
  poison(rootFiber)
}

// Component Patching

export type ComponentType<P = any> = React.ComponentType<P> | string

function getComponentName(component: any): string | null {
  if (!component) return null

  if (typeof component === 'object') {
    if (component.$$typeof === Symbol.for('react.memo')) {
      return getComponentName(component.type)
    }
    if (component.$$typeof === Symbol.for('react.forward_ref')) {
      return (
        component.displayName ||
        component.render?.displayName ||
        component.render?.name ||
        null
      )
    }
    if (component.$$typeof === Symbol.for('taut.originalComponent')) {
      return component.displayName || null
    }
  }

  if (typeof component === 'function') {
    return component.displayName || null
  }

  return null
}

function getDisplayName(component: ComponentType): string {
  if (typeof component === 'string') return component
  const name = getComponentName(component)
  if (name) return name
  return 'Component'
}

type componentMatcher = (component: ComponentType) => boolean
export type componentReplacer<P = any> = (
  OriginalComponent: ComponentType<P>
) => ComponentType<P>

const componentReplacements = new Map<componentMatcher, componentReplacer>()

// components that match no replacers
let notPatchedCache = new WeakSet<object>()
// component -> its replaced component
let resolvedComponentCache = new WeakMap<object, ComponentType>()

function invalidateComponentCaches() {
  notPatchedCache = new WeakSet<object>()
  resolvedComponentCache = new WeakMap<object, ComponentType>()
}

const originalComponentSymbol = Symbol.for('taut.originalComponent')

const originalComponentObjectCache = new WeakMap<any, originalComponentObject>()
type originalComponentObject = {
  $$typeof: typeof originalComponentSymbol
  originalComponent: ComponentType
  displayName: string
}

function getOriginalComponentObject(
  component: ComponentType
): originalComponentObject {
  if (originalComponentObjectCache.has(component)) {
    return originalComponentObjectCache.get(
      component
    ) as originalComponentObject
  }
  const obj: originalComponentObject = {
    $$typeof: originalComponentSymbol,
    originalComponent: component,
    displayName: getDisplayName(component),
  }
  originalComponentObjectCache.set(component, obj)
  return obj
}

function isOriginalComponentObject(
  component: any
): component is originalComponentObject {
  return (
    typeof component === 'object' &&
    component !== null &&
    component.$$typeof === originalComponentSymbol &&
    'originalComponent' in component
  )
}

const replacerResultCache = new WeakMap<
  componentReplacer,
  Map<ComponentType, ComponentType>
>()

function applyReplacerWithCache<P = any>(
  replacer: componentReplacer<P>,
  originalComponent: ComponentType<P>
): ComponentType<P> {
  let resultCache = replacerResultCache.get(replacer)
  if (!resultCache) {
    resultCache = new Map<ComponentType, ComponentType>()
    replacerResultCache.set(replacer, resultCache)
  }
  if (resultCache.has(originalComponent)) {
    return resultCache.get(originalComponent) as ComponentType<P>
  }

  const replaced = replacer(originalComponent)
  if (typeof replaced === 'function' && !('displayName' in replaced)) {
    replaced.displayName = `Patched(${getDisplayName(originalComponent)})`
  }

  resultCache.set(originalComponent, replaced)
  return replaced
}

function patchComponent<P = {}>(
  matcher:
    | string
    | { displayName?: string; filter?: filter; component?: ComponentType<P> },
  replacement: componentReplacer<P>
): () => void {
  const displayName =
    typeof matcher === 'string' ? matcher : matcher.displayName
  const filter = typeof matcher === 'string' ? undefined : matcher.filter
  const component = typeof matcher === 'string' ? undefined : matcher.component

  const matcherFunc: componentMatcher = (comp: any) => {
    if (component && comp === component) {
      return true
    }
    const name = getComponentName(comp)
    if (name !== displayName) {
      return false
    }
    if (filter && !filter(comp)) {
      return false
    }
    return true
  }

  componentReplacements.set(matcherFunc, replacement)

  invalidateComponentCaches()
  dirtyMemoizationCache()
  console.log(`[Taut] patchComponent: Patched component`, componentReplacements)
  return () => {
    componentReplacements.delete(matcherFunc)
    invalidateComponentCaches()
    dirtyMemoizationCache()
    console.log(`[Taut] patchComponent: Unpatched component`)
  }
}

export const patchComponentPromise = (async () => {
  await reactPromise
  global.patchComponent = patchComponent
  return patchComponent
})()
