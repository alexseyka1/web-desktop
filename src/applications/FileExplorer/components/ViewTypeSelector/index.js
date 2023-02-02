import Hier from "../../../../hier/hier"
import { ast as h } from "../../../../hier/hier-parser"
import "./styles.scss"

export const VIEW_TYPE_GRID = "grid"
export const VIEW_TYPE_LIST = "list"
const VIEW_TYPES = [
  {
    id: VIEW_TYPE_GRID,
    icon: "grid_view",
  },
  {
    id: VIEW_TYPE_LIST,
    icon: "view_headline",
  },
]

class ViewTypeSelector extends Hier.BaseComponent {
  render() {
    const { type, onChange = () => {} } = this.props

    return h`
      <div class="file-explorer__view-selector">
        ${VIEW_TYPES.map(({ id, icon }) => {
          return h`
            <button type="button" 
              class="${type === id ? "active" : ""}"
              onClick=${(e) => {
                e.preventDefault()
                if (type !== id) onChange(id)
              }}
            >
              <span class="material-symbols-outlined">${icon}</span>
            </button>
          `
        })}
      </div>
    `
  }
}

export default ViewTypeSelector
