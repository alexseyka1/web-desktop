import Hier from "../../../../../hier/hier"
import { ast as h } from "../../../../../hier/hier-parser"
import "./styles.scss"

class FavoritesPanel extends Hier.BaseComponent {
  render() {
    const { items, currentPath = "", onClick = () => {} } = this.props
    if (!items || !Array.isArray(items) || !items.length) return

    return h`${items.map((item) => {
      if (item === "separator") {
        return h`<hr/>`
      } else if (typeof item === "object") {
        const { path, title } = item
        const _className = currentPath === path ? "active" : ""
        return h`<button class=${_className} onClick=${() => onClick(item)}>
          <span class="material-symbols-outlined">folder</span>
          ${title}
        </button>`
      }
    })}`
  }
}

export default FavoritesPanel
