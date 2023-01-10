import Window from "../modules/Window"

class RandomColor extends Window {
  constructor(params) {
    super(params)

    this.title = "Random color"
    const setRandomColor = () => {
      const randomHex = () => Math.floor(Math.random() * 255)
      const color = `rgb(${randomHex()}, ${randomHex()}, ${randomHex()})`
      this.domElement.style.transition = "all 0.5s linear"
      this.domElement.style.backgroundColor = color
      this.title = `Random color ${color}`
      this.icon = "🌈"
    }
    setRandomColor()
    setInterval(() => setRandomColor(), 3000)
  }
}

export default RandomColor
