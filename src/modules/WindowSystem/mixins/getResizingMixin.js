import Helper from "../../Helper"
import Vector from "../../../classes/Vector"
import { WindowEvents } from "../../Window"

const BORDER_SIZE = 8

const getResizingMixin = () => ({
  registerResizeHandle() {
    let mouseOnBorderType,
      startMousePosition = new Vector(),
      newWindowPosition = this.position.clone(),
      newWindowSize = this.size.clone()

    const cursorTypeMouseMoveHandler = (e) => {
      mouseOnBorderType = Helper.getMouseOnBorderType(new Vector(e.clientX, e.clientY), this, BORDER_SIZE)

      if (mouseOnBorderType) this.domElement.style.outline = `${BORDER_SIZE / 1.5}px solid black`
      else this.domElement.style.outline = null

      if ([4, 6].includes(mouseOnBorderType)) document.body.style.cursor = "ew-resize"
      else if ([1, 9].includes(mouseOnBorderType)) document.body.style.cursor = "nwse-resize"
      else if ([3, 7].includes(mouseOnBorderType)) document.body.style.cursor = "nesw-resize"
      else if ([2, 8].includes(mouseOnBorderType)) document.body.style.cursor = "ns-resize"
      else document.body.style.cursor = "default"
    }

    const mouseMoveHandler = (e) => {
      e.stopPropagation()
      let [x, y] = [Math.min(e.clientX, window.innerWidth), Math.min(e.clientY, window.innerHeight)]

      const [dx, dy] = [x - startMousePosition.x, y - startMousePosition.y]
      const minWidth = this?.minSize?.x || 0,
        maxWidth = this?.maxSize?.x || Infinity,
        minHeight = this?.minSize?.y || 0,
        maxHeight = this?.maxSize?.y || Infinity

      requestAnimationFrame(() => {
        /**
         * Right/bottom resizing
         */
        if ([3, 6, 9].includes(mouseOnBorderType)) {
          let newWidth = this.size.x + dx
          if (newWidth < minWidth) newWidth = minWidth
          if (newWidth > maxWidth) newWidth = maxWidth

          newWindowSize.x = newWidth
          this.resizeWindow(newWidth)
        }
        if ([7, 8, 9].includes(mouseOnBorderType)) {
          let newHeight = this.size.y + dy
          if (newHeight < minHeight) newHeight = minHeight
          if (newHeight > maxHeight) newHeight = maxHeight

          newWindowSize.y = newHeight
          this.resizeWindow(null, newHeight)
        }
        /**
         * Left/top resizing
         */
        if ([1, 4, 7].includes(mouseOnBorderType)) {
          let newWidth = this.size.x - dx
          if (newWidth < minWidth) newWidth = minWidth
          if (newWidth > maxWidth) newWidth = maxWidth

          if (newWindowSize.x !== newWidth) {
            newWindowPosition.x = this.position.x + dx
            this.moveWindow(newWindowPosition.x)
          }

          newWindowSize.x = newWidth
          this.resizeWindow(newWidth)
        }
        if ([1, 2, 3].includes(mouseOnBorderType)) {
          let newHeight = this.size.y - dy
          if (newHeight < minHeight) newHeight = minHeight
          if (newHeight > maxHeight) newHeight = maxHeight

          if (newWindowSize.y !== newHeight) {
            newWindowPosition.y = this.position.y + dy
            this.moveWindow(null, newWindowPosition.y)
          }

          newWindowSize.y = newHeight
          this.resizeWindow(null, newHeight)
        }
      })
    }

    const mouseUpHandler = () => {
      this.position.setFromVector(newWindowPosition)
      this.size.setFromVector(newWindowSize)

      document.addEventListener("mousemove", cursorTypeMouseMoveHandler)
      document.removeEventListener("mousemove", mouseMoveHandler)
      document.removeEventListener("mouseup", mouseUpHandler)
    }
    const mouseDownHandler = (e) => {
      if (!mouseOnBorderType) return

      newWindowPosition = this.position.clone()
      newWindowSize = this.size.clone()
      ;[startMousePosition.x, startMousePosition.y] = [e.clientX, e.clientY]

      document.removeEventListener("mousemove", cursorTypeMouseMoveHandler)
      document.addEventListener("mousemove", mouseMoveHandler)
      document.addEventListener("mouseup", mouseUpHandler)
    }

    document.addEventListener("mousedown", mouseDownHandler)
    document.addEventListener("mousemove", cursorTypeMouseMoveHandler)

    /**
     * DISABLE ALL RESIZING FUNCTIONALITY WHEN THE WINDOW IS NOT IN FOCUS
     */
    this.addEventListener(WindowEvents.BLURED, () => {
      document.removeEventListener("mousedown", mouseDownHandler)
      document.removeEventListener("mousemove", cursorTypeMouseMoveHandler)
    })
    this.addEventListener(WindowEvents.FOCUSED, () => {
      document.addEventListener("mousedown", mouseDownHandler)
      document.addEventListener("mousemove", cursorTypeMouseMoveHandler)
    })
  },
})

export default getResizingMixin
