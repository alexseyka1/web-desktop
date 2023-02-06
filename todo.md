### TODO LIST

- [x] Create System Bus using Event Bus + Middleware patterns
  - [x] Move possibility open/read/write files to System Bus Middleware
  - [x] Move possibility to create new windows to System Bus Middleware
- [x] Move window header render and move/resize functionality to WindowSystem
- [x] Create base class for all applications
  - [x] This class must has run() method that return some output or numerical exit code (0 if all right)
  - [x] Add methods for (cin, cout, cerr)
    - [x] Sending all output
    - [x] Sending application errors
    - [x] Receiving input (including --arguments). Maybe I can use it inside props of Application::run() method
  - [x] Add method for create window
  - [x] Add possibility to have more than one window
    - [ ] Main windows must have posibility to lock when added modal window (info/error/etc. messages)
- [x] Add thumbnails generation for showing image previews in FileExplorer
- [x] Rewrite FileExplorer and ImageViewer as new Application class
- [x] Add posibility to run applications from terminal
- [x] Add file manifest.json to all applications that must contain application name and icon
- [x] Add posibility to walk through files in FileExplorer with keyboard arrows
  - [x] And Tab (Shift+Tab)
- [x] Add method for writing file content
  - [x] Add feature to Notepad for open/save file's content
- [x] Add grid/list view toggle to FileExplorer

- [ ] Move terminal command line editing functionality to a separate class Readline. This class must:
  - [ ] have store:
    - [ ] current typed string
    - [ ] current displaying string
    - [ ] current cursor position
    - [ ] strings history
    - [ ] current history position
  - [ ] have method for executing commands:
    - [ ] adding character to current typed string
    - [ ] removing character from current typed string
    - [ ] moving cursor forward, backward, to start and end the typed string
    - [ ] navigate through history and substitute historical value to current displaying string
  - [ ] have method to add text string to his history
  - [ ] have method for returning current displaying string
- [ ] All console applications must use Readline for input strings
- [ ] Move all the command line functionality to separate application Shell (Terminal app must be stupid simple: run Shell on startup and close when Shell terminating)
- [ ] Add context for callable applications. This context should include global context like PATH variable and custom needed context

- [ ] Add posibility to select files by mouse
- [ ] Add posibility to set wallpaper for folders
- [ ] Add posibility to hide window header at all
- [ ] Add posibility to leave window behind all other windows for creating Desktop FileExplorer window
- [ ] Move current terminal functionality to CommandShell application. Terminal must be stupid simple app that only run single application - CommandShell. If CommandShell has closed - Terminal must be closed too.
- [ ] Add tabs or two panels to FileExplorer application
- [ ] Create new store for saving application settings
- [ ] Create system settings panel
- [ ] Add copy and paste functionality to FileExplorer / file system

- [ ] (optional) Maybe developers must have possibility to add new applications after compliling this project?
      I mean some class for fetching applications from Window.applications array or something else needed?
