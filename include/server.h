#ifndef SERVER_H
#define SERVER_H

#include <string>
#include <vector>
#include "libs/json.hpp"
#include "libs/crow_all.h"

using json = nlohmann::json;

class TrafficSimulatorServer {
public:
    TrafficSimulatorServer(int port = 8080);
    ~TrafficSimulatorServer();

    void start();
    void stop();

private:
    int port;
    crow::Crow<crow::CORSHandler> app;
    bool running;

    // Route handlers
    void setupRoutes();
    
    // API endpoints
    void handleConfirmMap();
    void handleGetMapData();
    void handleAddRoad();
    void handleAddVehicle();
    void handleAddIntersection();

    // Utility functions
    std::string getMapDataFilePath() const;
    json generateMapData(const json& bounds);
    bool saveMapData(const json& data);
    json loadMapData();
    std::vector<std::pair<double, double>> fetchRoadCoordinates(double north, double south, double east, double west);
};

#endif // SERVER_H
