import Hier from "../../../../../hier/hier"
import { ast as h } from "../../../../../hier/hier-parser"
import FileMeta from "../../../../../modules/FileSystem/FileMeta"
import { bytesToReadable } from "../../../../../modules/FileSystem/Storage"
import FileIcon from "../../FileIcon"
import "./styles.scss"

const COLUMNS = [
  {
    title: "Name",
    value: (file) => file.displayName || file.name || "",
  },
  {
    title: "Type",
    value: (file) => file.mimeType,
  },
  {
    title: "Size",
    value: (file) => (file.size != null ? bytesToReadable(file.size) : ""),
  },
]

class ListView extends Hier.BaseComponent {
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
      <table class="files-list-table">
        <thead>
          <tr>
            ${COLUMNS.map((column, index) => {
              return !index ? h`<th colspan="2">${column.title}</th>` : h`<th>${column.title}</th>`
            })}
          </tr>
        </thead>
        <tbody>
          ${files.map((file, index) => {
            let _className = "files-list-item"
            if (selectedIds.includes(file.fileId)) _className += " active"
            if (file.isDirectory) _className += " files-list-item__directory"

            return h`
              <tr className=${_className}
                onMouseDown=${(e) => onMouseDown(e, file)}
                onDblClick=${(e) => onDblClick(e, file)}
                onTouchStart=${(e) => onTouchStart(e, file)}
                onContextMenu=${(e) => onContextMenu(e, file)}
                onFocus=${(e) => onFocus(e, file)}
                onBlur=${(e) => onBlur(e, file)}
                tabindex=${!index ? "0" : "-1"}
              >
                <td class="files-list-icon-column">
                  <${FileIcon} file=${file}/>
                </td>
                ${COLUMNS.map((column) => {
                  return h`<td>${column.value(file)}</td>`
                })}
              </tr>
            `
          })}
        </tbody>
      </table>
    `
    return h`
      ${files.map((file, index) => {
        let _className = "files-list-item"
        if (selectedIds.includes(file.fileId)) _className += " active"
        if (file.isDirectory) _className += " files-list-item__directory"
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
            <div class="files-list-item__icon">
              <${FileIcon} file=${file} />
            </div>
            <div class="files-lits-item__title" title="${file.description || file.displayName || file.name || ""}">${fileName}</div>
          </div>
        `
      })}
    `
  }
}

export default ListView
