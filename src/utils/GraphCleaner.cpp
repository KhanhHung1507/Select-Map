#include "../../include/utils/GraphCleaner.h"
#include <iostream>
#include <cmath>

// ---- KOSARAJU ALGORITHM ----

// First DFS: Order nodes by their finish time
void GraphCleaner::dfs1(long long u, const std::map<long long, std::vector<long long>>& adj, 
                        std::set<long long>& visited, std::vector<long long>& orderStack) {
    visited.insert(u);
    if (adj.find(u) != adj.end()) {
        for (long long v : adj.at(u)) {
            if (visited.find(v) == visited.end()) {
                dfs1(v, adj, visited, orderStack);
            }
        }
    }
    orderStack.push_back(u); 
}

// Second DFS: Collect nodes in the same SCC
void GraphCleaner::dfs2(long long u, const std::map<long long, std::vector<long long>>& revAdj, 
                        std::set<long long>& visited, std::vector<long long>& component) {
    visited.insert(u);
    component.push_back(u); 
    if (revAdj.find(u) != revAdj.end()) {
        for (long long v : revAdj.at(u)) {
            if (visited.find(v) == visited.end()) {
                dfs2(v, revAdj, visited, component);
            }
        }
    }
}

// Main logic
json GraphCleaner::keepLargestConnectedComponent(const json& rawMapData) {
    std::cout << "[GraphCleaner] Processing multi-region graph using Kosaraju's algorithm..." << std::endl;

    // 1. Find intersection coordinates for fast mapping
    std::set<long long> allIntersectionIds;
    std::map<long long, std::pair<double, double>> interCoords;
    
    for (const auto& inter : rawMapData["intersections"]) {
        long long id = inter["id"].get<long long>();
        allIntersectionIds.insert(id);
        interCoords[id] = {inter["coordinates"][0].get<double>(), inter["coordinates"][1].get<double>()};
    }

    // 2. Build Adjacency List
    std::map<long long, std::vector<long long>> adj;
    std::map<long long, std::vector<long long>> revAdj;

    for (const auto& road : rawMapData["roads"]) {
        bool isOneWay = road.contains("oneway") ? road["oneway"].get<bool>() : false;
        
        std::vector<long long> intersectionsOnThisRoad;
        for (const auto& coord : road["coordinates"]) {
            double rLat = coord[0].get<double>();
            double rLon = coord[1].get<double>();

            for (const auto& pair : interCoords) {
                if (std::abs(rLat - pair.second.first) < 1e-6 && std::abs(rLon - pair.second.second) < 1e-6) {
                    intersectionsOnThisRoad.push_back(pair.first);
                    break;
                }
            }
        }

        if (intersectionsOnThisRoad.size() > 1) {
            for (size_t i = 0; i < intersectionsOnThisRoad.size() - 1; ++i) {
                long long u = intersectionsOnThisRoad[i];
                long long v = intersectionsOnThisRoad[i + 1];

                adj[u].push_back(v);
                revAdj[v].push_back(u); 

                if (!isOneWay) {
                    adj[v].push_back(u);
                    revAdj[u].push_back(v);
                }
            }
        }
    }

    // 3. Kosaraju Step 1
    std::vector<long long> orderStack;
    std::set<long long> visited1;

    for (long long id : allIntersectionIds) {
        if (visited1.find(id) == visited1.end()) {
            dfs1(id, adj, visited1, orderStack);
        }
    }

    // 4. Kosaraju Steps 2 & 3: Multi-region Labeling
    std::set<long long> visited2;
    std::map<long long, int> nodeRegionMap; 
    int currentRegionId = 1;

    for (auto it = orderStack.rbegin(); it != orderStack.rend(); ++it) {
        long long id = *it;
        if (visited2.find(id) == visited2.end()) {
            std::vector<long long> currentComponent;
            dfs2(id, revAdj, visited2, currentComponent);

            // Ignore isolated 1-node islands
            if (currentComponent.size() > 1) {
                for (long long node : currentComponent) {
                    nodeRegionMap[node] = currentRegionId; 
                }
                currentRegionId++; 
            }
        }
    }

    // 5. Filter JSON and Inject Region ID
    json cleanMapData = rawMapData;
    cleanMapData["intersections"] = json::array();
    cleanMapData["roads"] = json::array();

    // Process Intersections
    for (auto inter : rawMapData["intersections"]) { // Make a copy to modify
        long long id = inter["id"].get<long long>();
        if (nodeRegionMap.find(id) != nodeRegionMap.end()) {
            inter["region"] = nodeRegionMap[id]; // Inject region label
            cleanMapData["intersections"].push_back(inter);
        }
    }

    // Process Roads
    for (auto road : rawMapData["roads"]) {
        int roadRegion = -1;
        for (const auto& coord : road["coordinates"]) {
            double rLat = coord[0].get<double>();
            double rLon = coord[1].get<double>();

            for (const auto& pair : interCoords) {
                long long interId = pair.first;
                if (std::abs(rLat - pair.second.first) < 1e-6 && std::abs(rLon - pair.second.second) < 1e-6) {
                    // Check if the intersection belongs to a valid region
                    if (nodeRegionMap.find(interId) != nodeRegionMap.end()) {
                        roadRegion = nodeRegionMap[interId];
                        break;
                    }
                }
            }
            if (roadRegion != -1) break;
        }

        if (roadRegion != -1) {
            road["region"] = roadRegion; // Inject region label into the road
            cleanMapData["roads"].push_back(road);
        }
    }

    std::cout << "[GraphCleaner] SUCCESS! Multi-region graph processed." << std::endl;
    std::cout << "               Total valid regions generated: " << (currentRegionId - 1) << std::endl;
    std::cout << "               Valid intersections kept: " << nodeRegionMap.size() 
              << " / " << allIntersectionIds.size() << std::endl;

    return cleanMapData;
}