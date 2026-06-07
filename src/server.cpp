#include "../include/server.h"
#include <fstream>
#include <iostream>
#include <filesystem>

namespace fs = std::filesystem;

TrafficSimulatorServer::TrafficSimulatorServer(int port) : port(port), running(false) {
    setupRoutes();
}

TrafficSimulatorServer::~TrafficSimulatorServer() { stop(); }

void TrafficSimulatorServer::setupRoutes() {
    // CORS Middleware: Allow Frontend (port 5500) to communicate with C++ API (port 8080)
    auto& ctx = app.get_middleware<crow::CORSHandler>();
    ctx.global()
       .headers("Content-Type", "Accept")
       .methods("POST"_method, "GET"_method, "OPTIONS"_method)
       .origin("*");

    // GET: Return traffic_network.json to Frontend for rendering
    CROW_ROUTE(app, "/api/map-data").methods("GET"_method)([this](const crow::request&, crow::response& res) {
        res.set_header("Content-Type", "application/json");
        res.body = loadMapData().dump();
        res.code = 200;
        res.end(); // IMPORTANT: res.end() must be called to close the HTTP connection
    });

    // POST: Receive processed map data from Frontend -> Save to traffic_network.json
    CROW_ROUTE(app, "/api/confirm-map").methods("POST"_method)([this](const crow::request& req, crow::response& res) {
        std::cout << "[Backend] Received map data payload from Frontend." << std::endl;
        try {
            auto mapData = json::parse(req.body); // Parse JSON string into an Object
            
            if (saveMapData(mapData)) {
                res.code = 200;
                res.body = mapData.dump();
            } else {
                res.code = 500; // Internal Server Error
                res.body = R"({"error": "I/O Error while writing traffic_network.json to disk"})";
            }
        } catch (const std::exception& e) {
            res.code = 400; // Bad Request (JSON syntax error)
            res.body = json({{"error", e.what()}}).dump();
            std::cerr << "[Backend] Exception caught: " << e.what() << std::endl;
        }
        res.set_header("Content-Type", "application/json");
        res.end(); 
    });

    // POST /api/add-road - Add a new road
    CROW_ROUTE(app, "/api/add-road").methods("POST"_method)
    ([this](const crow::request& req, crow::response& res) {
        try {
            auto body = json::parse(req.body);
            auto mapData = loadMapData();

            json newRoad;
            newRoad["id"] = mapData["roads"].size() + 1;
            newRoad["name"] = body["name"];
            newRoad["type"] = body.contains("type") ? body["type"].get<std::string>() : "road";
            newRoad["coordinates"] = body["coordinates"];
            newRoad["color"] = body.contains("color") ? body["color"].get<std::string>() : "#666666";
            newRoad["width"] = body.contains("width") ? body["width"].get<int>() : 3;

            mapData["roads"].push_back(newRoad);

            if (saveMapData(mapData)) {
                res.set_header("Content-Type", "application/json");
                res.body = newRoad.dump(2);
                res.code = 201;
                res.end();
            } else {
                res.set_header("Content-Type", "application/json");
                res.body = R"({"error": "Failed to save road"})";
                res.code = 500;
                res.end();
            }
        } catch (const std::exception& e) {
            res.set_header("Content-Type", "application/json");
            res.body = json({{"error", e.what()}}).dump();
            res.code = 400;
            res.end();
        }
    });

    // POST /api/add-vehicle - Add a new vehicle
    CROW_ROUTE(app, "/api/add-vehicle").methods("POST"_method)
    ([this](const crow::request& req, crow::response& res) {
        try {
            auto body = json::parse(req.body);
            auto mapData = loadMapData();

            json newVehicle;
            newVehicle["id"] = mapData["vehicles"].size() + 1;
            newVehicle["name"] = body["name"];
            newVehicle["type"] = body.contains("type") ? body["type"].get<std::string>() : "car";
            newVehicle["coordinates"] = body["coordinates"];
            newVehicle["speed"] = body.contains("speed") ? body["speed"].get<int>() : 50;

            mapData["vehicles"].push_back(newVehicle);

            if (saveMapData(mapData)) {
                res.set_header("Content-Type", "application/json");
                res.body = newVehicle.dump(2);
                res.code = 201;
                res.end();
            } else {
                res.set_header("Content-Type", "application/json");
                res.body = R"({"error": "Failed to save vehicle"})";
                res.code = 500;
                res.end();
            }
        } catch (const std::exception& e) {
            res.set_header("Content-Type", "application/json");
            res.body = json({{"error", e.what()}}).dump();
            res.code = 400;
            res.end();
        }
    });

    // POST /api/add-intersection - Add a new intersection
    CROW_ROUTE(app, "/api/add-intersection").methods("POST"_method)
    ([this](const crow::request& req, crow::response& res) {
        try {
            auto body = json::parse(req.body);
            auto mapData = loadMapData();

            json newIntersection;
            newIntersection["id"] = mapData["intersections"].size() + 1;
            newIntersection["name"] = body["name"];
            newIntersection["type"] = body.contains("type") ? body["type"].get<std::string>() : "intersection";
            newIntersection["coordinates"] = body["coordinates"];
            newIntersection["color"] = body.contains("color") ? body["color"].get<std::string>() : "#ff7f50";

            mapData["intersections"].push_back(newIntersection);

            if (saveMapData(mapData)) {
                res.set_header("Content-Type", "application/json");
                res.body = newIntersection.dump(2);
                res.code = 201;
                res.end();
            } else {
                res.set_header("Content-Type", "application/json");
                res.body = R"({"error": "Failed to save intersection"})";
                res.code = 500;
                res.end();
            }
        } catch (const std::exception& e) {
            res.set_header("Content-Type", "application/json");
            res.body = json({{"error", e.what()}}).dump();
            res.code = 400;
            res.end();
        }
    });

    // OPTIONS handler for CORS preflight
    CROW_ROUTE(app, "/api/<string>").methods("OPTIONS"_method)
    ([](const crow::request&, crow::response& res, std::string) {
        res.code = 200;
        res.end();
    });
}

void TrafficSimulatorServer::start() {
    running = true;
    std::cout << "[Backend] Traffic Simulator Server is starting on port " << port << "..." << std::endl;
    app.port(port).multithreaded().run();
}

void TrafficSimulatorServer::stop() { running = false; }

std::string TrafficSimulatorServer::getMapDataFilePath() const {
    return (fs::current_path() / "data" / "traffic_network.json").string();
}

bool TrafficSimulatorServer::saveMapData(const json& data) {
    try {
        std::string path = getMapDataFilePath();
        fs::create_directories(fs::path(path).parent_path()); // Ensure 'data' directory exists
        
        std::ofstream file(path);
        file << data.dump(2); // Write JSON with 2-space indentation for readability
        std::cout << "[Backend] Successfully saved traffic_network.json!" << std::endl;
        return true;
    } catch (const std::exception& e) {
        std::cerr << "[Backend] File writing failed: " << e.what() << std::endl;
        return false; 
    }
}

json TrafficSimulatorServer::loadMapData() {
    try {
        std::ifstream file(getMapDataFilePath());
        if (!file.is_open()) {
            std::cout << "[Backend] traffic_network.json not found. Returning empty dataset." << std::endl;
            return json({{"roads", json::array()}, {"intersections", json::array()}});
        }
        return json::parse(file);
    } catch (...) {
        return json({{"roads", json::array()}, {"intersections", json::array()}});
    }
}