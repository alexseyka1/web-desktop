### TODO LIST

- [x] Create System Bus using Event Bus + Middleware patterns
  - [x] Move possibility open/read/write files to System Bus Middleware
  - [x] Move possibility to create new windows to System Bus Middleware
- [x] Move window header render and move/resize functionality to WindowSystem
- [ ] Create base class for all applications
  - [ ] This class must has run() method that return some output or numerical exit code (0 if all right)
  - [ ] Add methods for (cin, cout, cerr)
    - [ ] Sending all output
    - [ ] Sending application errors
    - [ ] Receiving input (including --arguments). Maybe I can use it inside props of Application::run() method
  - [ ] Add method for create window
  - [ ] Add possibility to have more than one window
    - [ ] Main windows must have posibility to lock when added modal window (info/error/etc. messages)
- [ ] (optional) Maybe developers must have possibility to add new applications after compliling this project?
      I mean some class for fetching applications from Window.applications array or something else needed?
- [ ]
