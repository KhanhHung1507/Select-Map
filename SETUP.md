# Web-based Traffic Simulator

A web-based traffic simulator built with Leaflet.js frontend and C++ Crow backend.

## Project Structure

```
Select-Map/
├── include/          # HTML and header files
│   ├── index.html   # Main frontend UI
│   └── server.h     # C++ server header
├── src/             # JavaScript and C++ source files
│   ├── main.js      # Frontend logic
│   ├── server.cpp   # C++ server implementation
│   └── main.cpp     # Server entry point
├── data/            # Data files
│   └── map.json     # Map data (auto-generated)
└── CMakeLists.txt   # Build configuration
```

## Features

### Frontend (HTML/CSS/JavaScript)
- **Interactive Map**: Uses Leaflet.js to render an interactive map
- **Vietnam Bounds**: Map is restricted to Vietnam's geographical coordinates
- **Control Panel**: 
  - Initial state: Map draggable with "Confirm Map Selection" button
  - After confirmation: Pause/Resume controls, Add Road/Vehicle/Intersection buttons
- **Information Panel**: Displays properties of selected roads, intersections, or vehicles
- **Real-time Updates**: Loads and displays map data from the backend

### Backend (C++ with Crow)
- **REST API**: RESTful endpoints for all operations
- **File Management**: Automatically manages `map.json` file
- **CORS Support**: Enabled for cross-origin requests
- **Map Generation**: Generates sample roads and intersections based on map bounds

## API Endpoints

### GET /api/map-data
Retrieves the current map data.

**Response:**
```json
{
  "bounds": {...},
  "roads": [...],
  "intersections": [...],
  "vehicles": [...]
}
```

### POST /api/confirm-map
Confirms map selection and generates initial map data.

**Request:**
```json
{
  "north": 23.5,
  "south": 8.5,
  "east": 109.5,
  "west": 102.0
}
```

**Response:** Map data JSON

### POST /api/add-road
Adds a new road to the map.

**Request:**
```json
{
  "name": "New Street",
  "type": "primary",
  "coordinates": [[lat1, lng1], [lat2, lng2]],
  "color": "#ff0000",
  "width": 3
}
```

### POST /api/add-vehicle
Adds a new vehicle to the map.

**Request:**
```json
{
  "name": "Vehicle 1",
  "type": "car",
  "coordinates": [lat, lng],
  "speed": 50
}
```

### POST /api/add-intersection
Adds a new intersection to the map.

**Request:**
```json
{
  "name": "Intersection 1",
  "type": "intersection",
  "coordinates": [lat, lng],
  "color": "#ff7f50"
}
```

## Setup Instructions

### Prerequisites
- C++17 compatible compiler (MSVC, GCC, or Clang)
- CMake 3.10 or later
- jsoncpp library
- Crow framework (header-only)

### Windows Setup

1. **Install Dependencies**
   ```powershell
   # Using vcpkg (recommended)
   vcpkg install jsoncpp:x64-windows crow:x64-windows
   ```

2. **Download Crow**
   - Download from: https://github.com/CrowCpp/Crow/releases
   - Extract to a known location

3. **Build the Project**
   ```powershell
   mkdir build
   cd build
   cmake .. -DCROW_INCLUDE_DIR="path/to/crow/include"
   cmake --build . --config Release
   ```

4. **Run the Server**
   ```powershell
   ./Release/traffic_simulator_server.exe
   ```

5. **Open the Frontend**
   - Open your browser and navigate to: `file:///path/to/Select-Map/include/index.html`
   - Or set up a local web server to serve the files

### Linux/macOS Setup

1. **Install Dependencies**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install libjsoncpp-dev cmake build-essential
   
   # macOS
   brew install jsoncpp cmake
   ```

2. **Download Crow**
   ```bash
   git clone https://github.com/CrowCpp/Crow.git
   cd Crow && mkdir build && cd build
   cmake .. && make install
   ```

3. **Build the Project**
   ```bash
   mkdir build
   cd build
   cmake ..
   make
   ```

4. **Run the Server**
   ```bash
   ./traffic_simulator_server
   ```

## Usage

1. **Start the Backend Server**
   - Compile and run the C++ server on port 8080
   - The server will start listening for requests

2. **Open the Frontend**
   - Open `include/index.html` in a web browser
   - The map will load with Vietnam's bounds

3. **Confirm Map Selection**
   - Click the "Confirm Map Selection" button
   - This sends the current map bounds to the backend
   - The backend generates and saves `map.json`

4. **Interact with the Simulator**
   - **Pause**: Click to pause and see Resume/Select New Map options
   - **Add Road**: Add new roads to the map
   - **Add Vehicle**: Add vehicles to simulate traffic
   - **Add Intersection**: Add traffic intersections
   - **Click Elements**: Click on roads, vehicles, or intersections to view their properties

5. **Select New Map**
   - Click "Select New Map" to unlock and change the map bounds
   - Drag the map to new bounds and confirm again

## Data Format

### map.json Structure

```json
{
  "bounds": {
    "north": 23.5,
    "south": 8.5,
    "east": 109.5,
    "west": 102.0
  },
  "roads": [
    {
      "id": 1,
      "name": "Main Street",
      "type": "primary",
      "color": "#ff0000",
      "width": 4,
      "coordinates": [[lat1, lng1], [lat2, lng2]]
    }
  ],
  "intersections": [
    {
      "id": 1,
      "name": "Main Intersection",
      "type": "intersection",
      "color": "#ff7f50",
      "coordinates": [lat, lng]
    }
  ],
  "vehicles": [
    {
      "id": 1,
      "name": "Vehicle 1",
      "type": "car",
      "coordinates": [lat, lng],
      "speed": 50
    }
  ]
}
```

## Technical Notes

- **Frontend**: Pure HTML/CSS/JavaScript using Leaflet.js for mapping
- **Backend**: C++ with Crow framework for lightweight HTTP server
- **Communication**: JSON-based REST API
- **Cross-Origin**: CORS enabled for development
- **File I/O**: Backend handles all file operations

## Troubleshooting

1. **Port Already in Use**
   - Modify the port in `server.h` and `main.cpp` (default: 8080)

2. **CORS Errors**
   - Ensure the backend is running and CORS is enabled
   - Check browser console for detailed error messages

3. **map.json Not Found**
   - Confirm map selection to generate the initial map.json
   - Check that the `/data/` directory exists

4. **Crow Compilation Errors**
   - Ensure Crow headers are in the include path
   - Crow is header-only, no compilation needed

## Future Enhancements

- Real OpenStreetMap data integration
- Vehicle movement simulation
- Traffic light simulation
- Advanced analytics dashboard
- Database integration
- User authentication
- Export/Import functionality

## License

This project is provided as-is for educational purposes.
