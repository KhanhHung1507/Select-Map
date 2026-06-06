#include "../include/server.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <filesystem>
#include <cmath>

namespace fs = std::filesystem;

TrafficSimulatorServer::TrafficSimulatorServer(int port)
    : port(port), running(false) {
    setupRoutes();
}

TrafficSimulatorServer::~TrafficSimulatorServer() {
    stop();
}

void TrafficSimulatorServer::setupRoutes() {
    // CORS middleware
    auto& ctx = app.get_middleware<crow::CORSHandler>();
    ctx
        .global()
        .headers("Content-Type", "Accept")
        .methods("POST"_method, "GET"_method, "OPTIONS"_method)
        .origin("*");

    // GET /api/map-data - Retrieve current map data
    CROW_ROUTE(app, "/api/map-data").methods("GET"_method)
    ([this](const crow::request&, crow::response& res) {
        auto data = loadMapData();
        res.set_header("Content-Type", "application/json");
        res.body = data.dump(2);
        res.code = 200;
        res.end();
    });

    // POST /api/confirm-map - Receive real map data from Frontend and save it
    CROW_ROUTE(app, "/api/confirm-map").methods("POST"_method)
    ([this](const crow::request& req, crow::response& res) {
        std::cout << "DEBUG: Received confirm-map request with real Overpass data" << std::endl;
        
        try {
            // Parse the complete JSON data containing real roads and intersections sent from JS
            auto mapData = json::parse(req.body);
            
            // Save data directly into map.json file
            if (saveMapData(mapData)) {
                std::cout << "DEBUG: Real map data saved successfully" << std::endl;
                res.set_header("Content-Type", "application/json");
                res.body = mapData.dump(2);
                res.code = 200;
                res.end();
            } else {
                std::cerr << "DEBUG: Failed to save map data" << std::endl;
                res.set_header("Content-Type", "application/json");
                res.body = R"({"error": "Failed to save map data"})";
                res.code = 500;
                res.end();
            }
        } catch (const std::exception& e) {
            std::cerr << "DEBUG: Exception caught: " << e.what() << std::endl;
            res.set_header("Content-Type", "application/json");
            res.body = json({{"error", e.what()}}).dump();
            res.code = 400;
            res.end();
        }
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
    std::cout << "Starting Traffic Simulator Server on port " << port << "..." << std::endl;
    
    app.port(port).multithreaded().run();
}

void TrafficSimulatorServer::stop() {
    running = false;
}

std::string TrafficSimulatorServer::getMapDataFilePath() const {
    fs::path mapPath = fs::current_path() / "data" / "map.json";
    return mapPath.string();
}

json TrafficSimulatorServer::generateMapData(const json& bounds) {
    json mapData;
    mapData["bounds"] = bounds;
    mapData["roads"] = json::array();
    mapData["intersections"] = json::array();
    mapData["vehicles"] = json::array();

    // Generate sample roads based on bounds
    double north = bounds["north"].get<double>();
    double south = bounds["south"].get<double>();
    double east = bounds["east"].get<double>();
    double west = bounds["west"].get<double>();

    // Create a grid of roads
    json road1;
    road1["id"] = 1;
    road1["name"] = "Main Street";
    road1["type"] = "primary";
    road1["color"] = "#ff0000";
    road1["width"] = 4;
    road1["coordinates"] = json::array();
    road1["coordinates"].push_back(json::array({(north + south) / 2, west}));
    road1["coordinates"].push_back(json::array({(north + south) / 2, east}));
    mapData["roads"].push_back(road1);

    json road2;
    road2["id"] = 2;
    road2["name"] = "Second Avenue";
    road2["type"] = "primary";
    road2["color"] = "#0000ff";
    road2["width"] = 4;
    road2["coordinates"] = json::array();
    road2["coordinates"].push_back(json::array({north, (east + west) / 2}));
    road2["coordinates"].push_back(json::array({south, (east + west) / 2}));
    mapData["roads"].push_back(road2);

    // Create intersections at crossings
    json intersection;
    intersection["id"] = 1;
    intersection["name"] = "Main Intersection";
    intersection["type"] = "intersection";
    intersection["color"] = "#ff7f50";
    intersection["coordinates"] = json::array({(north + south) / 2, (east + west) / 2});
    mapData["intersections"].push_back(intersection);

    return mapData;
}

bool TrafficSimulatorServer::saveMapData(const json& data) {
    try {
        std::string filePath = getMapDataFilePath();
        
        // Ensure data directory exists
        fs::path dataDir = fs::path(filePath).parent_path();
        if (!fs::exists(dataDir)) {
            fs::create_directories(dataDir);
        }

        // Write to file
        std::ofstream file(filePath);
        if (!file.is_open()) {
            std::cerr << "Failed to open file: " << filePath << std::endl;
            return false;
        }

        file << data.dump(2);
        file.close();

        std::cout << "Map data saved to: " << filePath << std::endl;
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error saving map data: " << e.what() << std::endl;
        return false;
    }
}

json TrafficSimulatorServer::loadMapData() {
    try {
        std::string filePath = getMapDataFilePath();
        
        if (!fs::exists(filePath)) {
            // Return empty map data if file doesn't exist
            json emptyData;
            emptyData["roads"] = json::array();
            emptyData["intersections"] = json::array();
            emptyData["vehicles"] = json::array();
            return emptyData;
        }

        std::ifstream file(filePath);
        if (!file.is_open()) {
            throw std::runtime_error("Failed to open map.json");
        }

        json root = json::parse(file);
        file.close();

        return root;
    } catch (const std::exception& e) {
        std::cerr << "Error loading map data: " << e.what() << std::endl;
        json emptyData;
        emptyData["roads"] = json::array();
        emptyData["intersections"] = json::array();
        emptyData["vehicles"] = json::array();
        return emptyData;
    }
}

std::vector<std::pair<double, double>> TrafficSimulatorServer::fetchRoadCoordinates(
    double north, double south, double east, double west) {
    // This would typically fetch real road data from an API like OpenStreetMap
    // For now, we'll return sample coordinates
    std::vector<std::pair<double, double>> coordinates;
    coordinates.push_back({(north + south) / 2, west});
    coordinates.push_back({(north + south) / 2, east});
    return coordinates;
}
