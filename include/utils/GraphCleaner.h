#pragma once
#include "../libs/json.hpp"
#include <vector>
#include <map>
#include <set>

using json = nlohmann::json;

class GraphCleaner {
public:
    static json keepLargestConnectedComponent(const json& rawMapData);

private:
    static void dfs1(long long u, const std::map<long long, std::vector<long long>>& adj, std::set<long long>& visited, std::vector<long long>& orderStack);
    static void dfs2(long long u, const std::map<long long, std::vector<long long>>& revAdj, std::set<long long>& visited, std::vector<long long>& component);
};