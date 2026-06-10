#include "../include/Server/server.h"
#include <iostream>

int main() {
    try {
        TrafficSimulatorServer server(8080);
        std::cout << "Traffic Simulator Server is starting..." << std::endl;
        server.start();
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}
