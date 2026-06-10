#pragma once
#include <string>
#include "../libs/json.hpp"
#include "../libs/crow_all.h"

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

    void setupRoutes();
};