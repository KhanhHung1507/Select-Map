# Select-Map

g++ src/main.cpp src/Backend/server.cpp -I include -I include/libs -DASIO_STANDALONE -std=c++17 -D_WIN32_WINNT=0x0601 -o server.exe -lws2_32 -lwsock32