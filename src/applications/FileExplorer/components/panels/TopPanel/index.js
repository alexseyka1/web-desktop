import Hier from "../../../../../hier/hier"
import { ast as h } from "../../../../../hier/hier-parser"
import NavigationButtons from "./NavigationButtons"
import "./styles.scss"

class TopPanel extends Hier.Component {
  constructor(props) {
    super(props)

    this._state = {
      timestamp: Date.now(),
    }

    props.locationStack.addEventListener("change", () => {
      this.setState({ timestamp: Date.now() })
    })
  }

  get locationStringElement() {
    return this.node.querySelector(".file-explorer-top-bar__path > input")
  }

  #renderPathForm() {
    const { locationStack, onChangePath = () => {} } = this.props
    const _submitHandler = (e) => {
      e.preventDefault()
      const newPath = this.locationStringElement?.value?.replace(/\/+$/, "").trim() || "/"
      this.locationStringElement.blur()
      if (newPath === locationStack.current) return
      onChangePath(newPath)
    }

    return h`<form class="file-explorer-top-bar__path"
        onKeyDown=${(e) => e.stopPropagation()}
        onSubmit=${_submitHandler}
      >
        <input type="text" value=${locationStack.current} />
      </form>
    `
  }

  #renderUploadForm() {
    const { locationStack, onUploadFiles } = this.props

    const _submitHandler = (e) => {
      e.preventDefault()
      const input = e.target.querySelector("input")
      input.click()
    }
    const _filesChangedHandler = (e) => {
      const files = e?.target?.files || []
      if (files.length) onUploadFiles(Array.from(files), locationStack.current)
    }

    return h`<form class="file-explorer-upload-form"
        onKeyDown=${(e) => e.stopPropagation()}
        onSubmit=${_submitHandler}
        title="Click for upload files to this directory"
      >
        <button type="submit" className="file-explorer-top-bar__button file-explorer-upload-form__button">
          <span class="material-symbols-outlined">drive_folder_upload</span>
        </button>
        <input type="file" tabindex="-1" onChange=${_filesChangedHandler} multiple/>
      </form>
    `
  }

  render() {
    const { locationStack, onChangePath } = this.props

    return h`
      <${NavigationButtons}
        className="file-explorer-top-bar__buttons"
        :isGoBackDisabled=${!locationStack.canGoBack}
        :isGoForwardDisabled=${!locationStack.canGoForward}
        :isGoUpDisabled=${locationStack.current === "/" && "disabled"}
        onGoBack=${(e) => locationStack.goBack()}
        onGoForward=${(e) => locationStack.goForward()}
        onGoUp=${(e) => {
          let oldPath = locationStack.current.split("/")
          oldPath.splice(-1)
          onChangePath(oldPath.join("/") || "/")
        }}
      />
      ${this.#renderPathForm()}
      ${this.#renderUploadForm()}
    `
  }
}

export default TopPanel
