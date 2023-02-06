import Hier from "../../../../../hier/hier"
import { ast as h } from "../../../../../hier/hier-parser"
import { bytesToReadable } from "../../../../../modules/FileSystem/Storage"
import FileIcon from "../../FileIcon"
import "./styles.scss"

const COLUMNS = [
  {
    title: "Name",
    attribute: "name",
    value: (file) => file.displayName || file.name || "",
  },
  {
    title: "Type",
    attribute: "mimeType",
    value: (file) => file.mimeType,
  },
  {
    title: "Size",
    attribute: "size",
    value: (file) => (file.size != null ? bytesToReadable(file.size) : ""),
  },
]

class ListView extends Hier.BaseComponent {
  render() {
    const { files, selectedIds = [], sort } = this.props
    const isFilesExists = files && Array.isArray(files) && files.length

    const onMouseDown = this.props?.onMouseDown || (() => {})
    const onDblClick = this.props?.onDblClick || (() => {})
    const onTouchStart = this.props?.onTouchStart || (() => {})
    const onContextMenu = this.props?.onContextMenu || (() => {})
    const onFocus = this.props?.onFocus || (() => {})
    const onBlur = this.props?.onBlur || (() => {})
    const onChangeSort = this.props?.onChangeSort || (() => {})
    const onClickHeader = (column) => {
      if (!("attribute" in column)) return
      if (sort !== column.attribute) return onChangeSort(column.attribute)
      if (column.attribute.substring(0, 1) === "-") column.attribute = column.attribute.substring(1)
      else column.attribute = `-${column.attribute}`
      return onChangeSort(column.attribute)
    }

    return h`
      <table class="files-list-table">
        <thead>
          <tr>
            ${COLUMNS.map((column, index) => {
              const isActive = column.attribute === sort
              const isDesc = column.attribute.substring(0, 1) === "-"
              return h`
                <th colspan=${!index && "2"}"
                  onClick=${() => onClickHeader(column)}
                  class="${isActive && "active"}"
                >
                  ${column.title}
                  ${isActive && (isDesc ? h`<span class="text-muted">▲</span>` : h`<span class="text-muted">▼</span>`)}
                </th>`
            })}
          </tr>
        </thead>
        <tbody>
          ${
            isFilesExists &&
            files.map((file, index) => {
              let _className = "files-list-item files-item"
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
            })
          }
        </tbody>
      </table>
    `
  }
}

export default ListView
