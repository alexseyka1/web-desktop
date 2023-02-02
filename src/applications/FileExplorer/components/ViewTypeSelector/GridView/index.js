import Hier from "../../../../../hier/hier"
import { ast as h } from "../../../../../hier/hier-parser"
import FileIcon from "../../FileIcon"
import "./styles.scss"

class GridView extends Hier.BaseComponent {
  render() {
    const { files, selectedIds = [] } = this.props
    if (!files || !Array.isArray(files) || !files.length) return

    const onMouseDown = this.props?.onMouseDown || (() => {})
    const onDblClick = this.props?.onDblClick || (() => {})
    const onTouchStart = this.props?.onTouchStart || (() => {})
    const onContextMenu = this.props?.onContextMenu || (() => {})
    const onFocus = this.props?.onFocus || (() => {})
    const onBlur = this.props?.onBlur || (() => {})

    return h`
      ${files.map((file, index) => {
        let _className = "files-grid-item"
        if (selectedIds.includes(file.fileId)) _className += " active"
        if (file.isDirectory) _className += " files-grid-item__directory"
        let fileName = file.displayName || file.name || ""

        return h`
          <div className=${_className}
            onMouseDown=${(e) => onMouseDown(e, file)}
            onDblClick=${(e) => onDblClick(e, file)}
            onTouchStart=${(e) => onTouchStart(e, file)}
            onContextMenu=${(e) => onContextMenu(e, file)}
            onFocus=${(e) => onFocus(e, file)}
            onBlur=${(e) => onBlur(e, file)}
            tabindex=${!index ? "0" : "-1"}
          >
            <div class="files-grid-item__icon">
              <${FileIcon} file=${file} />
            </div>
            <div class="files-grid-item__title" title="${file.description || file.displayName || file.name || ""}">${fileName}</div>
          </div>
        `
      })}
    `
  }
}

export default GridView
