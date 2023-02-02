const isDev = () => typeof __DEV__ !== "undefined" && __DEV__ === true
const isDebug = () => typeof __DEBUG__ !== "undefined" && __DEBUG__ === true
const isProfiling = () => typeof __PROFILING__ !== "undefined" && __PROFILING__ === true

/**
 * Utility for setting function arguments required
 */
function isRequired(suffix = "") {
  throw new Error(`Required function argument not specified. ${suffix}`)
}
function objHasFunctions(obj) {
  if (typeof obj !== "object" || !Object.keys(obj).length) return false
  for (let prop of Object.values(obj)) {
    if (typeof prop === "function") return true
    else if (typeof prop === "object" && objHasFunctions(prop)) return true
  }
  return false
}
/**
 * Resets specified variables and frees memory
 * @param  {...any} values
 */
function free(...values) {
  for (let idx in values) values[idx] = null
}
const defaultLogStyles = ["color: #fff; background-color: #444; padding: 2px 4px; border-radius: 2px; margin-left: -4px"]
const LogStyles = {
  base: defaultLogStyles.join(";"),
  light: [...defaultLogStyles, "color: #263238", "background-color: #eceff1"].join(";"),
  warning: [...defaultLogStyles, "color: #eee", "background-color: red"].join(";"),
  success: [...defaultLogStyles, "background-color: #43a047"].join(";"),
}

/**
 * Hier renderer
 */
const Hier = {
  /**
   * Renders AST object to a specified HTML node
   * @param {string} tagName
   * @param {object} attributes tag attributes (properties) object
   * @param {string|object[]} children Text string or array of AST objects
   * @returns {HTMLElement|Text}
   */
  createElement(tagName = isRequired(1), attributes, children) {
    attributes = Hier._clearAttributes(attributes)
    if (tagName === "textString") {
      return document.createTextNode(Util.decodeEntity(attributes.value.toString()))
    }

    let element
    if (tagName === "svg" || tagName.indexOf("svg:") === 0) element = document.createElementNS("http://www.w3.org/2000/svg", tagName)
    else element = document.createElement(tagName)

    if (typeof attributes === "object") Hier._setNodeAttributes(element, attributes)

    if (children) {
      for (child of children) {
        if (!child) continue
        element.appendChild(child instanceof Node ? child : document.createTextNode(child))
      }
    }
    return element
  },

  /**
   * Cleans element attributes from internal :properties
   * @param {object} attributes
   * @returns {object}
   */
  _clearAttributes(attributes) {
    const response = {}
    for (let attr in attributes) {
      if (/^:/.test(attr)) continue
      response[attr] = attributes[attr]
    }
    return response
  },

  /**
   * Cleans component property names
   * @param {object} props
   * @returns {object}
   */
  _clearProps(props) {
    const response = {}
    for (let prop in props) {
      const propName = prop.replace(/^:/, "")
      response[propName] = props[prop]
    }
    return response
  },

  /**
   * Creates reference to HTML element
   * @returns {HierRef}
   */
  createRef() {
    return new HierRef()
  },

  /**
   * Deletes specified HTML node and all its children
   * @param {Node} node
   */
  _deleteUnnecessaryNode(node = isRequired(2)) {
    if (node.hasChildNodes()) {
      node.childNodes.forEach((child) => Hier._deleteUnnecessaryNode(child))
    }
    node.remove()
  },

  /**
   * Set HTML node attributes, specified by key-value object
   * @param {HTMLElement} node
   * @param {object} attributes
   */
  _setNodeAttributes(node = isRequired(3), attributes = isRequired(4)) {
    /**
     * Remove unnecessary attributes
     */
    const attributesNames = Object.keys(attributes)
    for (let attribute of node.attributes) {
      if (!attributesNames.includes(attribute.name)) node.removeAttribute(attribute.name)
    }

    if (!Object.keys(attributes).length) return
    const objectEntries = Object.entries(attributes || {})
    for (let [attribute, value] of objectEntries) {
      if (attribute === "ref" && value instanceof HierRef) {
        value.setElem(node)
        continue
      }

      if (!["string", "boolean", "function"].includes(typeof value)) continue
      if (attribute.startsWith("on")) node[attribute.toLowerCase()] = value
      else {
        if (attribute === "className") attribute = "class"
        if (typeof value === "boolean") {
          if (value) node.setAttribute(attribute, "")
          else node.removeAttribute(attribute)
        } else {
          node.setAttribute(attribute, value)
          if (attribute === "value") node[attribute] = value
        }
      }
    }
  },

  /**
   * Dispatch `internal:afterMount` event for specified component and all his children components
   * @param {BaseComponent} component
   */
  _mountComponents(component = isRequired(5)) {
    if (component instanceof BaseComponent && !component.isMounted) {
      component.dispatchEvent(new Event("internal:afterMount", { cancelable: true }))
      component.isMounted = true
    }

    if (component.children && Array.isArray(component.children)) {
      for (let child of component.children) Hier._mountComponents(child)
    }
  },
  /**
   * Renders AST object to specified HTML node or component
   * @param {object} object
   * @param {Node} node
   * @returns {Node|BaseComponent}
   */
  async _renderAstObject(object = isRequired(6), node = isRequired(7), rootNode) {
    if (Array.isArray(object) && object.length === 1) object = object.pop()

    if (typeof object !== "object") {
      const value = typeof object.toString === "function" ? object.toString() : object
      const _object = { tagName: "textString", props: { value } }
      const elementNode = Hier.createElement(_object.tagName, _object.props)
      _object.node = elementNode
      node.appendChild(elementNode)
      return _object
    } else if (typeof object.tagName === "string") {
      /** Current object is a common HTML element */
      object.node = Hier.createElement(object.tagName, object.props)
      node.appendChild(object.node)

      if (object.children) {
        const clonedChildren = Util.cloneObject(object.children)
        const renderedChildren = new Array(clonedChildren.length)
        for (let childIndex in clonedChildren) {
          renderedChildren[childIndex] = await Hier._renderAstObject(clonedChildren[childIndex], object.node)
          Hier._mountComponents(renderedChildren[childIndex])
        }
        object.children = renderedChildren
        /** Free memory */
        free(clonedChildren, renderedChildren)
      }

      return object
    } else {
      /** Current object is a component */
      const props = Object.assign({}, object.props, { children: object.children })
      if (JSON.stringify(object) === JSON.stringify({})) {
        console.error({ object, node, rootNode })
        throw new Error("Unexpected empty object.")
      }
      const nestedComponent = await Hier.render(object instanceof BaseComponent ? object : object.tagName, node, props)
      if (rootNode) nestedComponent.dispatchEvent(new Event("afterCreate"))

      /** Free memory */
      free(props, nestedComponent)
      return nestedComponent
    }
  },

  /**
   * Renders component object
   * @param {Function|BaseComponent} className
   * @param {Node} rootNode HTML node for appending component
   * @param {object} props properties to pass to created component
   * @returns {BaseComponent} rendered component object
   */
  async render(className = isRequired(8), rootNode, props) {
    const componentName = className instanceof BaseComponent ? className.constructor.name : className.name
    isDev() && console.group(`%c[Render][${componentName}]`, LogStyles.light)
    isProfiling() && console.time(`⏰ ${componentName} rendered in`)

    let component
    if (className instanceof BaseComponent) component = className
    else {
      component = new className(props)
      if (rootNode) component.dispatchEvent(new Event("afterCreate"))
    }

    let ast = (await component.render()) ?? []
    if (!Array.isArray(ast)) ast = [ast]

    isDev() && console.debug(`%c[Rendered][${componentName}]`, LogStyles.success, component, ast)

    const renderedChildren = new Array(ast.length)
    for (let childIndex in ast) {
      renderedChildren[childIndex] = await Hier._renderAstObject(ast[childIndex], component.node, rootNode)
    }
    component.children = renderedChildren

    if (rootNode) {
      rootNode.appendChild(component.node)
      Hier._mountComponents(component)
    }

    isProfiling() && console.timeEnd(`⏰ ${componentName} rendered in`)
    isDev() && console.groupEnd()

    /** Free memory */
    free(componentName, ast, renderedChildren)
    return component
  },

  /**
   * Re-renders specified component. Updates only changed parts of component content
   * @param {BaseComponent} component
   */
  async rerenderComponent(component = isRequired(9)) {
    /**
     * Component content reconcillation process. Finds out changed parts and renders it to DOM
     * @param {BaseComponent|object} innerComponent Hier component or common tag AST object
     * @param {BaseComponent[]|object[]} currentChildren
     * @param {BaseComponent[]|object[]} newChildren
     */
    const compareChildrenElements = (innerComponent = isRequired(10), currentChildren, newChildren) => {
      isDev() && console.debug("%c[Re-render triggered]", LogStyles.success, innerComponent, Util.cloneObject(currentChildren), Util.cloneObject(newChildren))
      if (typeof innerComponent.children === "undefined") innerComponent.children = []
      if (typeof currentChildren === "undefined") currentChildren = []
      if (typeof newChildren === "undefined") newChildren = []

      let doPopsCount = 0
      const maxChildrenCount = Math.max(currentChildren.length, newChildren.length)
      for (let index = 0; index < maxChildrenCount; index++) {
        const currentElement = currentChildren[index]
        const newElement = newChildren[index]

        if (!currentElement && !newElement) continue
        else if (!currentElement && newElement) {
          /**
           * [done] New element will be added
           */
          innerComponent.children.push(newElement)
          innerComponent.node.appendChild(newElement.node)

          if (newElement instanceof BaseComponent) {
            isDev() && console.debug("%c + [New component added]", LogStyles.light, newElement)
            Hier._mountComponents(newElement)
          } else {
            isDev() && console.debug("%c + [New element added]", LogStyles.light, newElement)
          }
        } else if (currentElement && !newElement) {
          /**
           * [done] Some element has been removed
           */
          if (currentElement instanceof BaseComponent) {
            currentElement.dispatchEvent(new Event("beforeUnmount"))
          }
          doPopsCount++
          /** Free memory */
          Hier._deleteUnnecessaryNode(currentElement.node)
          free(currentElement.node, currentElement)
          if (currentElement instanceof BaseComponent) {
            isDev() && console.debug("%c - [Component removed]", LogStyles.base, currentElement)
          } else {
            isDev() && console.debug("%c - [Element removed]", LogStyles.base, currentElement)
          }
        } else {
          /**
           * [done] Element has been moved, replaced or unchanged
           */
          if (currentElement instanceof BaseComponent && newElement instanceof BaseComponent) {
            /** [done] Both elements are components */
            if (currentElement.constructor.name === newElement.constructor.name) {
              /** [done] Equal components */
              if (Util.jsonSerialize(currentElement._props) === Util.jsonSerialize(newElement._props)) {
                isDev() &&
                  console.debug(
                    `%c = [Component is unchanged] [${currentElement.constructor.name}]`,
                    LogStyles.light,
                    currentElement,
                    Util.cloneObject(currentElement.props),
                    Util.cloneObject(newElement.props)
                  )
              } else {
                isDev() &&
                  console.debug(
                    `%c -> [Component props changed] [${currentElement.constructor.name}]`,
                    LogStyles.base,
                    Util.cloneObject(currentElement._props),
                    " -> ",
                    Util.cloneObject(newElement.props)
                  )

                currentElement.props = Util.cloneObject(newElement.props)
                /** Here the component must trigger its re-render */
                /** Free memory */
                Hier._deleteUnnecessaryNode(newElement.node)
                free(newElement.node, newElement)
              }
            } else {
              /** [done] Current component has been replaced by another one */
              isDev() && console.debug("%c <=> [Component replaced]", LogStyles.base, currentElement, " -> ", newElement)
              currentElement.dispatchEvent(new Event("beforeUnmount"))

              innerComponent.children[index] = newElement

              currentElement.node.replaceWith(newElement.node)
              Hier._mountComponents(newElement)
              /** Free memory */
              Hier._deleteUnnecessaryNode(currentElement.node)
              free(currentElement.node)
            }
          } else if (currentElement.tagName === newElement.tagName) {
            /** [done] Both elements are equal common HTML elements (tags) */

            /** Checking for props changed or element props contain some functions */
            let isPropsHasFunctions = objHasFunctions(currentElement.props)
            if (!isPropsHasFunctions) isPropsHasFunctions = objHasFunctions(newElement.props)

            const isElementPropsChanged = Util.jsonSerialize(currentElement.props) !== Util.jsonSerialize(newElement.props)
            if (isElementPropsChanged || isPropsHasFunctions) {
              if (currentElement.tagName === "textString") {
                /** [done] If both elements are text strings */
                currentElement.node.nodeValue = Util.decodeEntity(newElement.props.value).trim()
                isDev() && console.debug("%c <T> [Text changed]", LogStyles.warning, Util.cloneObject(currentElement), " -> ", Util.cloneObject(newElement))
              } else {
                Hier._setNodeAttributes(currentElement.node, this._clearAttributes(newElement.props))
                isDev() &&
                  console.debug(
                    "%c <-> [Tag attributes replaced]",
                    LogStyles.warning,
                    Util.cloneObject(currentElement.props),
                    " -> ",
                    Util.cloneObject(newElement.props)
                  )
              }
              currentElement.props = Util.cloneObject(newElement.props)

              /** Free memory */
              /** Here may me bug! */
              Hier._deleteUnnecessaryNode(newElement.node)
              free(newElement.node, newElement)
            }

            if (currentElement.children || newElement.children) {
              isDev() && console.debug("%c[Now we must iterate element children]", LogStyles.light, innerComponent, currentElement, newElement)
              compareChildrenElements(currentElement, currentElement.children, newElement.children)
            }
          } else if (!(currentElement instanceof BaseComponent) && newElement instanceof BaseComponent) {
            /** [done] Common HTML element has been replaced by component */
            isDev() && console.debug("%c <-> [Element replaced by component]", LogStyles.warning, currentElement, newElement)
            innerComponent.children[index] = newElement
            currentElement.node.replaceWith(newElement.node)
            Hier._mountComponents(newElement)
            /** Free memory */
            Hier._deleteUnnecessaryNode(currentElement.node)
            free(currentElement.node)
          } else if (currentElement instanceof BaseComponent && !(newElement instanceof BaseComponent)) {
            /** [done] Component has been replaced by common HTML tag */
            isDev() && console.debug("%c <-> [Component replaced by element]", LogStyles.warning, currentElement, newElement)
            currentElement.dispatchEvent(new Event("beforeUnmount"))
            innerComponent.children[index] = newElement
            currentElement.node.replaceWith(newElement.node)
            /** Free memory */
            Hier._deleteUnnecessaryNode(currentElement.node)
            free(currentElement.node)
          } else if (!(currentElement instanceof BaseComponent) && !(newElement instanceof BaseComponent) && currentElement.tagName !== newElement.tagName) {
            /** [done] Different elements specified */
            isDev() && console.debug("%c <-> [Element replaced by another one]", LogStyles.warning, currentElement, newElement)
            innerComponent.children[index] = newElement
            currentElement.node.replaceWith(newElement.node)
            /** Free memory */
            Hier._deleteUnnecessaryNode(currentElement.node)
            free(currentElement.node)
          } else {
            console.debug("%c ??? [Unknown option]", LogStyles.warning, currentElement, newElement)
          }
        }

        /** Free memory */
        free(currentElement, newElement, index)
      }

      /** Delete unnecessary element children */
      if (doPopsCount) {
        for (let i = 0; i < doPopsCount; i++) innerComponent.children.pop()
      }
    }

    let ast = (await component.render()) ?? []
    if (!Array.isArray(ast)) ast = [ast]

    const _currentChildren = component.children || []
    const tempNode = Hier.createElement("template")
    const _newChildren = new Array(ast.length)
    for (let childIndex in ast) {
      _newChildren[childIndex] = await Hier._renderAstObject(ast[childIndex], tempNode)
    }

    compareChildrenElements(component, _currentChildren, _newChildren)
    /** Free memory */
    Hier._deleteUnnecessaryNode(tempNode)
    free(ast, _currentChildren, _newChildren, tempNode)
  },
}

/**
 * Inner utilities
 */
const Util = {
  /**
   * Convert component props (or any other object) to JSON.
   * Replaces BaseComponent instances to string
   * @param {any} obj
   * @returns {string}
   */
  jsonSerialize: function (obj = isRequired(11), prettyPrint) {
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === "function") {
          return value.toString()
        } else {
          return value
        }
      },
      prettyPrint ? 2 : 0
    )
  },
  /**
   * Deep clone any object
   * @param {object} obj
   * @returns {object}
   */
  cloneObject: function (obj) {
    let newObj
    if (obj instanceof BaseComponent) {
      const clonedProps = Util.cloneObject(obj.props)
      const newComponent = new obj.constructor(clonedProps)
      newComponent._state = obj._state || {}
      newObj = newComponent
    } else if (obj instanceof Node) {
      newObj = obj.cloneNode()
    } else if (obj instanceof HierRef) {
      newObj = obj
    } else if (!obj) {
      return null
    } else {
      if (obj?.constructor?.name.toLowerCase() === "date") {
        newObj = new Date(obj.toUTCString())
      } else if (obj?.constructor && ["set", "weakset", "map", "weakmap"].includes(obj?.constructor?.name.toLowerCase())) {
        if (obj instanceof Set) newObj = new Set(obj)
        if (obj instanceof WeakSet) newObj = new WeakSet(obj)
        if (obj instanceof Map) newObj = new Map(obj)
        if (obj instanceof WeakMap) newObj = new WeakMap(obj)
      } else if (obj?.constructor && !["object", "array"].includes(obj?.constructor?.name.toLowerCase())) {
        /** Dont clone class instances */
        newObj = obj
      } else {
        newObj = Object.assign({}, obj || {})
      }
    }

    const objectEntries = Object.entries(newObj)
    for (let [key, value] of objectEntries) {
      if (Array.isArray(value)) {
        newObj[key] = [...value]
      } else if (typeof value !== "object") {
        newObj[key] = value
      } else {
        newObj[key] = Util.cloneObject(value)
      }
    }
    return Array.isArray(obj) ? Object.values(newObj) : newObj
  },

  /**
   * Finds out is function class or not
   * @param {Function} callable
   * @returns {boolean}
   */
  getIsClass: function (callable = isRequired(12)) {
    if (typeof callable !== "function") return false
    return /^class *\w+.*{/.test(callable)
  },

  /**
   * Returns specified HTML node attributes
   * @param {HTMLElement} element
   * @throws {TypeError}
   * @returns {object} Element attributes
   */
  getElementAttributes: function (element = isRequired(13)) {
    if (!(element instanceof HTMLElement)) throw new TypeError("Invalid object specified.")
    const attributes = element.attributes
    if (!attributes || !attributes.length) return {}
    const result = {}
    for (let index = 0; index < attributes.length; index++) {
      const attribute = attributes[index]
      result[attribute.name] = attribute.value
    }
    return result
  },

  /**
   * Decodes HTML entities like `&nbsp;` or `&mdash;`
   * @param {string} string
   * @returns {string} Decoded HTML entities
   */
  decodeEntity(string) {
    const textarea = Hier.createElement("textarea")
    textarea.innerHTML = string
    const response = textarea.value
    Hier._deleteUnnecessaryNode(textarea)
    free(textarea)
    return response
  },
}

/**
 * Hier components
 * @class
 * @property {object} props
 * @property {HTMLElement} node
 */
class BaseComponent extends EventTarget {
  _props = {}
  props = {}
  children = []
  /** @type {HTMLElement} */
  node = null
  isMounted = false

  /**
   * @constructor
   * @param {object} props key-value properties object
   * @throws {TypeError}
   */
  constructor(props) {
    super()
    if (props && typeof props !== "object") throw new TypeError("Please specify correct props object.")
    this._initChangeableAttr("_props")
    this._props = Hier._clearProps(props) || {}

    /** Initialisation props object */
    Object.defineProperty(this, "props", {
      configurable: false,
      enumerable: false,
      get: () => {
        return this._props || {}
      },
      set: async (currentValue) => {
        currentValue = Hier._clearProps(currentValue)
        const prevProps = Util.cloneObject(this._props)
        if (Util.jsonSerialize(prevProps) != Util.jsonSerialize(currentValue)) {
          this._props = currentValue

          isProfiling() && console.time(`⏰ ${this.constructor.name} re-rendered in`)
          await Hier.rerenderComponent(this)
          isProfiling() && console.timeEnd(`⏰ ${this.constructor.name} re-rendered in`)

          this.dispatchEvent(new CustomEvent("afterUpdate", { detail: { props: currentValue, prevProps } }))
        }
      },
    })

    /** Init life-time event listeners */
    this.addEventListener("afterCreate", () => {
      isDebug() && console.debug(`⭐️ %c[Created] [${this.constructor.name}]`, LogStyles.light)
      if (typeof this.afterCreate === "function") this.afterCreate.call(this)
    })
    this.addEventListener("internal:afterMount", (e) => {
      requestAnimationFrame(() => {
        if (!this.node.closest("body")) return
        isDebug() && console.debug(`✅ %c[Mounted] [${this.constructor.name}]`, LogStyles.light)
        if (typeof this.afterMount === "function") this.afterMount.call(this)
        this.dispatchEvent(new Event("afterMount"))
      })
    })
    this.addEventListener("afterUpdate", (event) => {
      const { props, prevProps, state, prevState } = event.detail
      isDebug() &&
        console.debug(`🔄 %c[Updated] [${this.constructor.name}]`, LogStyles.light, {
          props,
          prevProps,
          state,
          prevState,
        })
      if (typeof this.afterUpdate === "function") this.afterUpdate.call(this, props, prevProps, state, prevState)
    })
    this.addEventListener("beforeUnmount", () => {
      isDebug() && console.debug(`⛔️ %c[Unmounted] [${this.constructor.name}]`, LogStyles.light)
      if (typeof this.beforeUnmount === "function") this.beforeUnmount.call(this)
    })

    /** Create component root node for mounting */
    const elementAttributes = {}
    if (isDev()) elementAttributes["data-component"] = this.constructor.name
    this.node = Hier.createElement("main", Object.assign(elementAttributes, props))
  }

  /**
   * @inner
   * @param {string} attr
   * @param {any} defaultValue
   */
  _initChangeableAttr(attr, defaultValue) {
    Object.defineProperty(this, attr, {
      configurable: false,
      enumerable: false,
      value: defaultValue || {},
    })
  }

  toJSON() {
    return {
      "[[ComponentName]]": this.constructor.name,
      props: this._props,
    }
  }

  render() {
    return null
  }
}

/**
 * @class
 * @property {object} state
 */
class Component extends BaseComponent {
  _state = {}

  constructor(props) {
    super(props)

    /** Initialisation state object */
    Object.defineProperty(this, "state", {
      configurable: false,
      enumerable: false,
      get: () => {
        return this._state || {}
      },
      set: async (currentValue) => {
        const prevState = Util.cloneObject(this._state)
        if (Util.jsonSerialize(prevState) != Util.jsonSerialize(currentValue)) {
          this._state = currentValue

          isProfiling() && console.time(`⏰ ${this.constructor.name} re-rendered in`)
          await Hier.rerenderComponent(this)
          isProfiling() && console.timeEnd(`⏰ ${this.constructor.name} re-rendered in`)

          this.dispatchEvent(
            new CustomEvent("afterUpdate", {
              detail: { props: this._props, prevProps: this._props, state: currentValue, prevState },
            })
          )
        }
      },
    })

    this.addEventListener("afterCreate", () => {
      Object.freeze(this._state)
    })
  }

  /**
   * @param {object} partialState
   */
  async setState(partialState) {
    const prevState = this.state
    this.state = Object.assign({}, prevState || {}, partialState)
  }
}

export class HierRef {
  elem
  setElem(elem) {
    this.elem = elem
  }
}

export default {
  createElement: Hier.createElement,
  createRef: Hier.createRef,
  render: Hier.render,
  isRequired: isRequired,
  BaseComponent,
  Component,
}
