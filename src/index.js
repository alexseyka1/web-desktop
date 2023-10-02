import WindowSystem from "./modules/WindowSystem"
import "./styles/document.scss"
import "./styles/dropdown-menu.scss"
import Desktop from "./modules/desktop"
import BottomBar from "./modules/desktop/BottomBar"
import FileMeta from "./modules/FileSystem/FileMeta"
import systemBus, { SYSTEM_BUS_COMMANDS, SYSTEM_BUS_EVENTS } from "./modules/SystemBus"
import ImageViewer from "./applications/ImageViewer"
import Notepad from "./applications/Notepad"
import WindowMessage, { WINDOW_MESSAGE_TYPES } from "./modules/Window/WindowMessage"
import { getDefinedApplications } from "./classes/ApplicationFinder"
import InputIterator from "./modules/CommandLineLang/InputIterator"
import TokenIterator from "./modules/CommandLineLang/TokenIterator"
import Parser from "./modules/CommandLineLang/Parser"
import Environment from "./modules/CommandLineLang/Environment"
import { evaluate } from "./modules/CommandLineLang/Translator"
import { UserRequestedError } from "./modules/CommandLineLang/Translator/parameterExpansions"

globalThis.__DEV__ = false
globalThis.__DEBUG__ = false

// document.addEventListener("DOMContentLoaded", async () => {
//   /**
//    * Import predefined applications
//    */
//   ;(() => {
//     const getAppName = (key) => key.replace(/\.\/(.*\/)?([^\/]+)$/, "$1").replace(/\/$/, "")
//     const importApps = (r) => {
//       globalThis.definedApplications = {}
//       r.keys().forEach((key) => {
//         globalThis.definedApplications[getAppName(key)] = r(key)
//       })
//     }
//     importApps(require.context("./applications/", true, /^\.\/[^\/]+\/index\.js$/))

//     const importManifests = (r) => {
//       globalThis.definedManifests = {}
//       r.keys().forEach((key) => {
//         globalThis.definedManifests[getAppName(key)] = r(key)
//       })
//     }
//     importManifests(require.context("./applications/", true, /^\.\/[^\/]+\/manifest\.json$/))
//   })()

//   /**
//    * INIT THE FILE SYSTEM
//    */
//   const { isCreated } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.IS_STRUCTURE_EXISTS)
//   if (!isCreated) {
//     const { isCompleted } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.CREATE_FILE_STRUCTURE)
//     if (isCompleted) {
//       setTimeout(() => window.location.reload())
//     }
//     return
//   }

//   /**
//    * @todo move code below to separate file
//    */
//   systemBus.addMiddleware(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.OPEN_FILE, async (request, response, next) => {
//     /** @type {FileMeta} */
//     const { file } = await systemBus.execute(SYSTEM_BUS_COMMANDS.FILE_SYSTEM.READ_FILE_META, request)
//     if (!file) return
//     if (file.mimeType.startsWith("image/")) {
//       new ImageViewer().main([file.fullPath])
//     } else if (file.mimeType.startsWith("text/") || file.mimeType === "application/json") {
//       new Notepad().main([file.fullPath])
//     } else if (file.mimeType === "application") {
//       const apps = getDefinedApplications()
//       if (file.name in apps) systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, apps[file.name].module)
//     } else {
//       systemBus.execute(
//         SYSTEM_BUS_COMMANDS.WINDOW_SYSTEM.OPEN_WINDOW,
//         new WindowMessage({ title: "Oops", message: "We haven't application that can open this file", type: WINDOW_MESSAGE_TYPES.ERROR })
//       )
//     }
//   })

//   /**
//    * REGISTER SERVICE WORKER
//    */
//   // ;(async () => {
//   //   if ("serviceWorker" in navigator) {
//   //     try {
//   //       const registration = await navigator.serviceWorker.register("/serviceWorker.js", {
//   //         scope: "/",
//   //       })
//   //       if (registration.installing) {
//   //         console.log("Service worker installing")
//   //       } else if (registration.waiting) {
//   //         console.log("Service worker installed")
//   //       } else if (registration.active) {
//   //         console.log("Service worker active")
//   //       }
//   //     } catch (error) {
//   //       console.error(`Registration failed with ${error}`)
//   //     }
//   //   }
//   // })()

//   /**
//    * WINDOW SYSTEM
//    */
//   const windowSystem = new WindowSystem(document.getElementById("windows"))
//   windowSystem.run()

//   /**
//    * DESKTOP
//    */
//   const desktop = new Desktop(windowSystem)
//   windowSystem.root.prepend(desktop.domElement)

//   /**
//    * BOTTOM BAR
//    */
//   const bottomBar = new BottomBar(windowSystem)
//   document.body.append(bottomBar.domElement)
//   systemBus.addEventListener(SYSTEM_BUS_EVENTS.WINDOW_SYSTEM.STACK_CHANGED, () => bottomBar.render())

//   /**
//    * MOVE THIS FUNCIONALITY TO SEPARATE CLASS (SOME APPLICATION RUNNER)
//    */
//   const definedApplications = getDefinedApplications()
//   // systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, { app: definedApplications["image-viewer.app"].module })
//   // systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, { app: definedApplications["file-explorer.app"].module, input: "/home/documents" })
//   // systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, { app: definedApplications["notepad.app"].module, input: "/home/documents/hello.txt" })
//   systemBus.execute(SYSTEM_BUS_COMMANDS.APP_RUNNER.RUN_APPLICATION, { app: definedApplications["terminal.app"].module })
// })

const environment = new Environment()
environment.def("echo", function (...args) {
  const result = args.length ? args.join(" ") : null
  console.log(`[ECHO]: ${result}`)
  return result
})
environment.def("get_fruits", function (type = "fruits") {
  switch ((type + "").toLowerCase()) {
    case "veggies":
      return ["Tomato", "Cucumber", "Carrot"]
    default:
      return ["Apple", "Banana", "Orange", "Cherry"]
  }
})

// const inputIterator = new InputIterator(text)
// const tokenIterator = new TokenIterator(inputIterator)
// const parser = new Parser(tokenIterator)
// const parsedAst = parser.parse()
// console.log(parsedAst)
// evaluate(parsedAst, environment)

const assert = (str, expected, params = {}) => {
  const { throwError } = params

  const env = environment.extend()
  const inputIterator = new InputIterator(str)
  const tokenIterator = new TokenIterator(inputIterator)
  const parser = new Parser(tokenIterator)
  let parsedAst = null
  try {
    parsedAst = parser.parse()
  } catch (e) {
    console.error("Parsing failed: ", { input: str, expected, e })
    return
  }

  let result
  try {
    result = evaluate(parsedAst, env)
  } catch (e) {
    if (throwError && e instanceof UserRequestedError) result = e.message
    else throw e
  }

  let response = result == expected
  if (typeof expected === "object") {
    if (typeof result !== "object") response = false
    else if (expected != null) {
      response = true
      for (let key of Object.keys(expected)) response &= key in result && result[key] == expected[key]
    }
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(result)) response = false
    else response = result.toString() === expected.toString()
  }

  console.assert(response, { str, result, expected, input: inputIterator.getInput(), parsedAst, env })
}

// console.time("✅ Parameter expansions - Basics")
// assert(`name = "John"; $name`, "John")
// assert(`name = "John"; "\${name}"`, "John")
// assert(`name = "John"; "\${name/J/j}"`, "john")
// assert(`"\${food:-Cake}"`, "Cake")
// assert(`str="Hello world"; "\${str:6:5}"`, "world")
// assert(`str="Hello world"; "\${str:0:2}"`, "He")
// assert(`str="Hello world"; "\${str::2}"`, "He")
// assert(`str="Hello world"; "\${str::-1}"`, "Hello worl")
// assert(`str="Hello world"; "\${str: -5:5}"`, "world")
// assert(`str="Hello world"; "\${str:(-1)}"`, "d")
// assert(`str="Hello world"; "\${str:(-2):1}"`, "l")
// assert(`src="/path/to/foo.cpp"; base=\${src##*/};`, "foo.cpp")
// assert(`src="/path/to/foo.cpp"; base=\${src##*/}; dir=\${src%$base}`, "/path/to/")
// assert(`name = "John"; offset = -3; length = 3; "\${name:(offset):length}"`, "ohn")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str%in*}"`, "Be liberal in what you accept, and conservative ")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str%%in*}"`, "Be liberal ")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str#*in}"`, " what you accept, and conservative in what you send")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str##*in}"`, " what you send")
// assert(`str="/path/to/foo.cpp"; "\${str%.cpp}"`, "/path/to/foo")
// assert(`str="/path/to/foo.cpp"; "\${str%.cpp}.o"`, "/path/to/foo.o")
// assert(`str="/path/to/foo.cpp"; "\${str%/*}"`, "/path/to")
// assert(`str="/path/to/foo.cpp"; "\${str##*.}"`, "cpp")
// assert(`str="/path/to/foo.cpp"; "\${str##*/}"`, "foo.cpp")
// assert(`str="/path/to/foo.cpp"; "\${str#*/}"`, "path/to/foo.cpp")
// assert(`str="/path/to/foo.cpp"; "\${str##*/}"`, "foo.cpp")
// assert(`str="/path/to/foo.cpp"; "\${str/foo/bar}"`, "/path/to/bar.cpp")
// console.timeLog("✅ Parameter expansions - Basics")

// console.time("✅ Parameter expansions - Substitution")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str%in*}"`, "Be liberal in what you accept, and conservative ")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str%%in*}"`, "Be liberal ")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str/%in*}"`, "Be liberal ")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str#*in}"`, " what you accept, and conservative in what you send")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str##*in}"`, " what you send")
// assert(`str = "Be liberal in what you accept, and conservative in what you send"; "\${str/#*in}"`, " what you send")
// assert(`name = "John James"; "\${name/J/j}"`, "john James")
// assert(`name = "John James"; "\${name//J/j}"`, "john james")
// assert(`name = "John James"; "\${name/%Jo/ja}"`, "jahn James")
// assert(`name = "John James"; "\${name/#es/y}"`, "John Jamy")
// console.timeLog("✅ Parameter expansions - Substitution")

// console.time("✅ Parameter expansions - Manipulation")
// assert(`str = "HELLO WORLD!"; "\${str,}"`, "hELLO WORLD!")
// assert(`str = "HELLO WORLD!"; "\${str,,}"`, "hello world!")
// assert(`str = "hello world!"; "\${str^}"`, "Hello world!")
// assert(`str = "hello world!"; "\${str^^}"`, "HELLO WORLD!")
// console.timeLog("✅ Parameter expansions - Manipulation")

// console.time("✅ Parameter expansions - Length")
// assert(`str = "hello world!"; "\${#str}"`, 12)
// console.timeLog("✅ Parameter expansions - Length")

// console.time("✅ Parameter expansions - Default values")
// assert(`test = "Dolly"; "\${food-test}"`, "Dolly")
// assert(`test = "Dolly"; "\${food:-test}"`, "Dolly")
// assert(`food = "cake"; test = "Dolly"; "\${food:-test}"`, "cake")
// assert(`test = "Dolly"; "\${food=test}"; "\${food}"`, "Dolly")
// assert(`test = "Dolly"; "\${food:=test}"; "\${food}"`, "Dolly")
// assert(`food = "cake"; test = "Dolly"; "\${food:=test}"; "\${food}"`, "cake")
// assert(`food = "cake"; test = "Dolly"; "\${food+test}"`, "Dolly")
// assert(`food = "cake"; test = "Dolly"; "\${food:+test}"`, "Dolly")
// assert(`test = "Dolly"; "\${food:+test}"`, null)
// assert(`"\${food:?food is not found}"`, "food is not found", { throwError: true })
// assert(`"\${food?food is not found}"`, "food is not found", { throwError: true })
// console.timeLog("✅ Parameter expansions - Default values")

// console.time("✅ Brace expansions")
// assert(`text = {a,b,c}`, ["a", "b", "c"])
// assert(`text = pre-{a,b,c}`, ["pre-a", "pre-b", "pre-c"])
// assert(`text = {a,b,c}-post`, ["a-post", "b-post", "c-post"])
// assert(`text = pre-{a,b,c}-post`, ["pre-a-post", "pre-b-post", "pre-c-post"])
// assert(`test = {1..5}`, [1, 2, 3, 4, 5])
// assert(`test = {001..5}`, ["001", "002", "003", "004", "005"])
// assert(`test = 0{1..9}`, ["01", "02", "03", "04", "05", "06", "07", "08", "09"])
// assert(`test = {1..5..2}`, [1, 3, 5])
// assert(`test = {10..1..3}`, [10, 7, 4, 1])
// assert(`test = {a..e}`, ["a", "b", "c", "d", "e"])
// assert(`test = {a..z..3}`, ["a", "d", "g", "j", "m", "p", "s", "v", "y"])
// assert(`test = {z..a..3}`, ["z", "w", "t", "q", "n", "k", "h", "e", "b"])
// assert(`test = {5..k}`, "{5..k}")
// assert(`test = 1.{0..3}`, ["1.0", "1.1", "1.2", "1.3"])
// assert(`PATH = "/hello/dolly"; test = {a,b}$PATH`, ["a/hello/dolly", "b/hello/dolly"])
// assert(`PATH = "/hello/dolly"; test = $PATH/{a,b}`, ["/hello/dolly/a", "/hello/dolly/b"])
// assert(`PRE = "/hello"; POST = "/dolly"; test = $PRE/{a,b}$POST`, ["/hello/a/dolly", "/hello/b/dolly"])
// assert(`test = {a..c}{1..3}`, ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"])
// assert(`test = {{a..c},{1..3}}`, ["a", "b", "c", 1, 2, 3])
// assert(`test = http://docs.example.com/documentation/slides_part{1..6}.html`, [
//   "http://docs.example.com/documentation/slides_part1.html",
//   "http://docs.example.com/documentation/slides_part2.html",
//   "http://docs.example.com/documentation/slides_part3.html",
//   "http://docs.example.com/documentation/slides_part4.html",
//   "http://docs.example.com/documentation/slides_part5.html",
//   "http://docs.example.com/documentation/slides_part6.html",
// ])
// assert(`test = /home/bash/test/{foo,bar,baz,cat,dog}`, [
//   "/home/bash/test/foo",
//   "/home/bash/test/bar",
//   "/home/bash/test/baz",
//   "/home/bash/test/cat",
//   "/home/bash/test/dog",
// ])
// {
//   const _fruits = `
// Fruits=('Apple' 'Banana' "Orange" "Cherry")
// `
//   assert(`${_fruits} test = "\${Fruits[0]}"`, "Apple")
//   assert(`${_fruits} test = "\${Fruits[-1]}"`, "Cherry")
//   assert(`${_fruits} test = "\${Fruits[@]}"`, ["Apple", "Banana", "Orange", "Cherry"])
//   assert(`${_fruits} test = "\${#Fruits[@]}"`, 4)
//   assert(`${_fruits} test = "\${#Fruits}"`, "Apple".length)
//   assert(`${_fruits} test = "\${#Fruits[3]}"`, "Cherry".length)
//   assert(`${_fruits} test = "\${Fruits[@]:2:2}"`, ["Orange", "Cherry"])
//   assert(`${_fruits} test = "\${!Fruits[@]}"`, [0, 1, 2, 3])
// }
// console.timeLog("✅ Brace expansions")

// console.time("✅ Classic for-loop")
// assert(
//   `response = ""
//   for x in {a..d} {
//     response = "$response$x"
//   }`,
//   "abcd"
// )
// assert(
//   `response = ""
//   for x in {1..9} {
//     response = "$response$x"
//   }`,
//   "123456789"
// )
// assert(`response = ""; for x in {a..d}; do response = "$response$x"; done`, "abcd")
// assert(`n = 1; for x in {1..10}; do n++; done`, 11)
// console.timeLog("✅ Classic for-loop")

// console.time("✅ Arrays")
// assert(
//   `
//   test[0] = "test0"
//   test[1] = "test1"
//   test[2] = "test2"
//   test[3] = "test3"

//   test3 = test[3]
//   test
// `,
//   ["test0", "test1", "test2", "test3"]
// )
// {
//   const _fruits = `
// Fruits=('Apple' 'Banana' "Orange" "Cherry")
// `
//   assert(`${_fruits}`, ["Apple", "Banana", "Orange", "Cherry"])
//   assert(`${_fruits} Fruits = ("\${Fruits[@]}" "Watermelon")`, ["Apple", "Banana", "Orange", "Cherry", "Watermelon"])
//   assert(`${_fruits} Fruits += ("Lemon")`, ["Apple", "Banana", "Orange", "Cherry", "Lemon"])
//   assert(`${_fruits} unset Fruits[1]`, ["Apple", "Orange", "Cherry"])
//   assert(
//     `${_fruits}
//     response = ()
//     for index in "\${!Fruits[@]/Ap*/}" {
//       response[$index] = "\${Fruits[$index]}"
//     }
//   `,
//     [, "Banana", "Orange", "Cherry"]
//   )
// }
// console.timeLog("✅ Arrays")

const text = `
Fruits = \`get_fruits\`
Veggies = \`get_fruits "veggies"\`
Double = ("\${Fruits[@]}" "\${Veggies[@]}")
unset Fruits[1]

echo "Fruits:"
for fruitIdx in "\${!Fruits[@]}" {
  echo "Fruit $fruitIdx: \${Fruits[$fruitIdx]}"
}

echo "Double:"
for fruitIdx in "\${!Double[@]}" {
  echo "Double $fruitIdx: \${Double[$fruitIdx]}"
}
`

const env = environment.extend()
const inputIterator = new InputIterator(text)
console.log(inputIterator.getInput())
const tokenIterator = new TokenIterator(inputIterator)
const parser = new Parser(tokenIterator)
const parsedAst = parser.parse()
console.log(parsedAst)
evaluate(parsedAst, env)
// console.log(evaluate(parsedAst, env), env)
