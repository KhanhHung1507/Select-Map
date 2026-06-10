#pragma once
#include <string>
#include <filesystem>
#include "../libs/json.hpp" 

using json = nlohmann::json;
namespace fs = std::filesystem;

class FileHandler {
public:
    static std::string getMapDataFilePath();
    static bool saveMapData(const json& data);
    static json loadMapData();
};