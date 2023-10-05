const getRandomInt = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

class Environment {
  constructor(parent) {
    this.parent = parent
    this.vars = Object.create(parent ? parent.vars : null)
  }

  extend() {
    return new Environment(this)
  }

  lookup(name) {
    let scope = this
    while (scope) {
      if (Object.prototype.hasOwnProperty.call(scope.vars, name)) return scope
      scope = scope.parent
    }
  }

  has(name) {
    return name in this.vars
  }

  get(name) {
    if (name in this.vars) return this.vars[name]
    if (name === "RANDOM") return getRandomInt(0, 32767)
    return null
  }

  set(name, value) {
    const scope = this.lookup(name)
    return ((scope || this).vars[name] = value)
  }

  def(name, value) {
    return (this.vars[name] = value)
  }
}

export default Environment
