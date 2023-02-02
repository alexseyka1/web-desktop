/**
 * Function adds submenu to dropdown with event handlers
 * @typedef {{title: string, icon: string, onClick: Function, children: MenuItem[], className: string}} MenuItem
 * @typedef {{element: HTMLElement, x: number, y: number}} DropdownMenuParams
 *
 * @param {MenuItem|MenuItem[]} item Menu item or array of items
 * @param {HTMLElement} appendTo HTML element for appending dropdown menu
 * @param {DropdownMenuParams|null} params
 * @returns {HTMLElement} Menu element
 */
export const addDropdownSubMenu = (item, appendTo, params = null) => {
  const _existingMenu = appendTo.querySelector(".dropdown-menu")
  if (_existingMenu) {
    if (appendTo === document.body) _existingMenu.remove()
    else return
  }

  const _menuElem = createDropdownMenu(item)
  let verticalOffset = 0,
    horizontalOffset = 0

  if (!params?.element && (!params?.x || !params?.y)) {
    throw new Error("Please specify element or coordinates for dropdown menu.")
  }
  appendTo.append(_menuElem)

  const updateMenuPosition = () => {
    if (params?.element) {
      const isNestedMenu = params.element === appendTo
      const { top, left, width, height } = params.element.getBoundingClientRect()
      verticalOffset = height
      horizontalOffset = width

      _menuElem.style.top = isNestedMenu ? `${top - 1}px` : `${top + height}px`
      _menuElem.style.left = isNestedMenu ? `${left + width}px` : `${left}px`
    } else if (params?.x && params?.y) {
      _menuElem.style.left = `${params?.x}px`
      _menuElem.style.top = `${params?.y}px`
    }

    const _menuElemBoundings = _menuElem.getBoundingClientRect()
    /**
     * Invert menu vertically
     */
    if (_menuElemBoundings.top + _menuElemBoundings.height > window.innerHeight) {
      let newTop = _menuElemBoundings.top - _menuElemBoundings.height - verticalOffset
      _menuElem.style.top = `${newTop}px`
    }
    /**
     * Invert menu horizontally
     */
    if (_menuElemBoundings.left + _menuElemBoundings.width > window.innerWidth) {
      let newLeft = _menuElemBoundings.left - _menuElemBoundings.width - horizontalOffset
      _menuElem.style.left = `${newLeft}px`
    }
  }
  updateMenuPosition()

  window.addEventListener("resize", () => updateMenuPosition())

  setTimeout(() => {
    window.addEventListener(
      "mousedown",
      (e) => {
        if (e?.path && !e.path.includes(_menuElem)) {
          _menuElem.remove()
        } else if (e?.target && !e.target?.closest(".dropdown-menu")) {
          _menuElem.remove()
        }
      },
      { once: true }
    )
  })

  return _menuElem
}

/**
 * Function creates dropdown menu
 */
const createDropdownMenu = (item) => {
  const dropdownElement = document.createElement("div")
  dropdownElement.className = "dropdown-menu"

  if (item?.className) dropdownElement.classList.add(item.className)

  let menuItems
  if (Array.isArray(item)) {
    menuItems = item
  } else if (typeof item === "object" && item?.children && Array.isArray(item?.children)) {
    menuItems = item?.children
  }

  menuItems?.forEach((child) => {
    const childElement = document.createElement("div")

    if (typeof child === "object") {
      const hasChildren = Array.isArray(child.children) && child.children.length
      childElement.className = "dropdown-menu__item"
      childElement.title = child.title || ""
      childElement.innerHTML = `
        <div class="dropdown-menu-item__icon">${child.icon || ""}</div>
        <div class="dropdown-menu-item__title">${child.title}</div>
        ${hasChildren ? `<div class="dropdown-menu-item__arrow"></div>` : ""}
      `
      if (child?.className) childElement.classList.add(child.className)
    } else if (child === "separator") {
      childElement.className = "dropdown-menu__separator"
    }
    dropdownElement.append(childElement)

    /**
     * Looking for event handlers in child props and apply their
     */
    for (let prop of Object.keys(child)) {
      const regexp = /^on(\w+)$/gi
      if (!regexp.test(prop.toLowerCase())) continue
      if (typeof child[prop] !== "function") continue

      const eventName = prop.toLowerCase().replace(regexp, "$1")
      childElement.addEventListener(eventName, child[prop])
    }

    if (child.children && Array.isArray(child.children)) {
      /**
       * Menu item has children
       * Adding submenu
       */
      childElement.addEventListener("click", () => {
        if (childElement.querySelector(".dropdown-menu")) return
        addDropdownSubMenu(child, childElement, { element: childElement })
      })
    } else {
      childElement.addEventListener("click", () => {
        if (!dropdownElement) return

        /**
         * Find root dropdown menu element and remove it (close menu)
         */
        let rootDropdownElement = dropdownElement,
          currentNode = dropdownElement
        while (currentNode !== document.body) {
          if (!currentNode.parentElement) break

          currentNode = currentNode.parentElement
          if (currentNode.classList.contains("dropdown-menu")) {
            rootDropdownElement = currentNode
          }
        }
        rootDropdownElement?.remove()
      })
    }
  })
  return dropdownElement
}

/**
 * @param {{title: string, icon: string, onClick: Function}[]} menu
 */
export const getRegisterMenuObject = (menuElement) => {
  function registerMenu(menu) {
    for (let i = 0; i < menu.length; i++) {
      const panelMenuItem = menu[i]
      if (!panelMenuItem.title) continue

      /**
       * Creating menu panel item
       */
      const panelMenuItemElement = document.createElement("div")
      panelMenuItemElement.className = "menu__item"
      panelMenuItemElement.innerHTML = `
        <div class="menu-item__icon">${panelMenuItem.icon || ""}</div>
        <div class="menu-item__title">${panelMenuItem.title}</div>
      `

      if (panelMenuItem.onClick && typeof panelMenuItem.onClick === "function") {
        /**
         * Menu item has click handler
         */
        panelMenuItemElement.addEventListener("click", (e) => panelMenuItem.onClick())
      } else if (panelMenuItem.children && Array.isArray(panelMenuItem.children)) {
        /**
         * Adding dropdown menu to main menu panel
         */
        panelMenuItemElement.addEventListener("click", () => {
          addDropdownSubMenu(panelMenuItem, menuElement, { element: panelMenuItemElement })
        })
      }

      menuElement.append(panelMenuItemElement)
    }
  }

  return registerMenu
}

/**
 * @param {object} object
 * @returns {object}
 */
export const withMenuPanel = (object, menuElement) => {
  return Object.assign(object, {
    registerMenu: getRegisterMenuObject(menuElement).bind(object),
  })
}
