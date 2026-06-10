#include "../../include/utils/FileHandler.h"
#include <fstream>
#include <iostream>

std::string FileHandler::getMapDataFilePath() {
    return (fs::current_path() / "data" / "traffic_network.json").string();
}

bool FileHandler::saveMapData(const json& data) {
    try {
        std::string path = getMapDataFilePath();
        fs::create_directories(fs::path(path).parent_path()); 
        
        std::ofstream file(path);
        file << data.dump(2); 
        
        std::cout << "[FileHandler] SUCCESS! File saved strictly at: " 
                  << fs::absolute(path) << std::endl;
                  
        return true;
    } catch (const std::exception& e) {
        std::cerr << "[FileHandler] I/O Error: " << e.what() << std::endl;
        return false; 
    }
}

json FileHandler::loadMapData() {
    try {
        std::ifstream file(getMapDataFilePath());
        if (!file.is_open()) {
            std::cout << "[FileHandler] traffic_network.json not found. Returning empty dataset." << std::endl;
            return json({{"roads", json::array()}, {"intersections", json::array()}});
        }
        return json::parse(file);
    } catch (...) {
        return json({{"roads", json::array()}, {"intersections", json::array()}});
    }
}