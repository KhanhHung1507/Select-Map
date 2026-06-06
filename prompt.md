Act as an expert Full-Stack Developer (JavaScript Frontend, C++ Backend). I need to build a Web-based Traffic Simulator. Generate the necessary code, strictly following the folder structure, UI layout, and logic below.

### 1. Folder Structure Constraint
You must split the files exactly into these directories:
- `/include/`: Contains ALL `.html` and `.h` (header) files.
- `/src/`: Contains ALL `.js` and `.cpp` (source) files.
- `/data/`: Contains the `map.json` file.

### 2. UI Requirements (HTML/CSS/JS)
Create a responsive web interface divided into 3 distinct sections:

- **Section 1: Map View (Main area)**
  - Use Leaflet.js to render the map.
  - Restrict the map panning and zooming bounds exclusively to Vietnam's geographical coordinates.

- **Section 2: Control Panel (Sidebar/Top)**
  - **Initial State:** Map is draggable. Show a "Confirm Map Selection" button. 
  - **Selected State:** When the user clicks "Confirm", lock the map (disable dragging/panning). Hide the confirm button and display these new buttons:
    - "Pause": Clicking this shows two sub-options -> "Resume" or "Select New Map" (which unlocks the map again).
    - "Add Road"
    - "Add Vehicle"
    - "Add Intersection"

- **Section 3: Information Panel (Sidebar/Bottom)**
  - When the user clicks on a specific road, intersection, or roundabout on the map, this section must display its properties (Name, Type, Coordinates, etc.).

### 3. Backend & File Handling Logic (C++ & JS integration)
- Browser JS cannot write directly to local folders. Therefore, write a lightweight C++ backend server (e.g., using Crow or native sockets).
- When the user confirms the map selection, the JS frontend must send the selected map bounds/data to the C++ backend.
- The C++ backend must automatically generate/fetch the map data, overwrite the old `map.json` file inside the `/data/` directory, and save the new `.json` file.
- The JS frontend then reads this new `map.json` to initialize the simulator objects.

Please provide the code for:
1. `index.html` (in /include)
2. `main.js` (in /src)
3. The C++ backend server setup (`server.h` in /include and `server.cpp` in /src) to handle the map.json file overwrite.