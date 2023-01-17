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
- [ ] Rewrite FileExplorer and ImageViewer as new Application class
- [ ] Add posibility to run applications from terminal
- [ ] Add file manifest.json to all applications that must contain application name and icon
- [ ] Add posibility to set wallpaper for folders
- [ ] Add posibility to hide window header at all
- [ ] Add posibility to leave window behind all other windows for creating Desktop FileExplorer window
- [ ] Move current terminal functionality to CommandShell application. Terminal must be stupid simple app that only run single application - CommandShell. If CommandShell has closed - Terminal must be closed too.

- [ ] (optional) Maybe developers must have possibility to add new applications after compliling this project?
      I mean some class for fetching applications from Window.applications array or something else needed?
