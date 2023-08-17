class Vector {
  constructor(x, y) {
    this.x = +x
    this.y = +y
  }

  clone() {
    return new Vector(this.x, this.y)
  }

  set(x, y) {
    ;[this.x, this.y] = [x, y]
  }

  setFromVector(vector) {
    this.set(vector.x, vector.y)
  }
}

export default Vector
