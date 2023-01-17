import Application from "../../modules/Application"

class RandomColor extends Application {
  main() {
    const _window = this.createWindow({
      x: 250,
      y: 200,
      width: 350,
      height: 350,
      icon: "🌈",
      title: "Random color",
    })

    const setRandomColor = () => {
      const randomHex = () => Math.floor(Math.random() * 255)
      const color = `rgb(${randomHex()}, ${randomHex()}, ${randomHex()})`
      _window.domElement.style.transition = "all 0.5s linear"
      _window.domElement.style.backgroundColor = color
      _window.title = `Random color ${color}`
      _window.icon = "🌈"
    }
    setRandomColor()
    setInterval(() => setRandomColor(), 3000)
  }
}

export default RandomColor
