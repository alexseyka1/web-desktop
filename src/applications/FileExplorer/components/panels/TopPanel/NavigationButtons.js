import Hier from "../../../../../hier/hier"
import { ast as h } from "../../../../../hier/hier-parser"

class NavigationButtons extends Hier.BaseComponent {
  render() {
    const {
      isGoBackDisabled = false,
      isGoForwardDisabled = false,
      isGoUpDisabled = false,
      onGoBack = () => {},
      onGoForward = () => {},
      onGoUp = () => {},
    } = this.props

    return h`
      <button class="file-explorer-top-bar__button file-explorer-top-bar__button-back"
        title="Go back"
        onClick=${onGoBack}
        disabled=${isGoBackDisabled}
      >
        <span class="material-symbols-outlined">navigate_before</span>
      </button>
      
      <button class="file-explorer-top-bar__button file-explorer-top-bar__button-forward"
        title="Go forward"
        onClick=${onGoForward}
        disabled=${isGoForwardDisabled}
      >
        <span class="material-symbols-outlined">navigate_next</span>
      </button>
      
      <button class="file-explorer-top-bar__button file-explorer-top-bar__button-up"
        title="Go to upper level"
        onClick=${onGoUp}
        disabled=${isGoUpDisabled}
      >
        <span class="material-symbols-outlined">drive_folder_upload</span>
      </button>
    `
  }
}

export default NavigationButtons
