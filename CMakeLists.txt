cmake_minimum_required(VERSION 3.10)
project(TrafficSimulator)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include directories - add libs folder for asio and other dependencies
include_directories(${CMAKE_SOURCE_DIR}/include)
include_directories(${CMAKE_SOURCE_DIR}/include/libs)

# Create executable
add_executable(Select-Map
    src/main.cpp
    src/server.cpp
)

# Link Windows socket libraries (required by ASIO)
if(WIN32)
    target_link_libraries(Select-Map ws2_32 wsock32 mswsock)
endif()

# No external libraries needed - using header-only libraries (Crow, nlohmann/json)
