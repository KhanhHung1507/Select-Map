# Select-Map

g++ src/main.cpp src/Backend/server.cpp src/utils/FileHandler.cpp src/utils/GraphCleaner.cpp -I include -I include/libs -DASIO_STANDALONE -std=c++17 -D_WIN32_WINNT=0x0601 -o server.exe -lws2_32 -lwsock32

# PHÂN TÍCH KIẾN TRÚC HỆ THỐNG MÔ PHỎNG GIAO THÔNG

## PHẦN 1: BỘ NÃO GIAO DIỆN (FRONTEND - JAVASCRIPT)

Khu vực này chịu trách nhiệm hiển thị bản đồ, nhận thao tác từ người dùng và trao đổi dữ liệu với hệ thống Backend.

---

## 1. File `index.html` (Bộ khung giao diện)

### Công dụng

Là giao diện gốc của hệ thống. File này chứa các thành phần HTML, liên kết đến thư viện Leaflet để hiển thị bản đồ và tải các tập tin CSS, JavaScript cần thiết.

### Từ khóa quan trọng

```html
<script type="module" src="./js/main.js"></script>
```

### Tại sao sử dụng `type="module"`?

Nếu không khai báo thuộc tính `module`, các file JavaScript sẽ không thể sử dụng cú pháp:

```javascript
import ...
export ...
```

Việc sử dụng Module giúp:

* Chia chương trình thành nhiều file độc lập.
* Cho phép các file gọi lẫn nhau thông qua import/export.
* Tránh xung đột biến toàn cục.
* Tăng tính bảo mật và khả năng bảo trì mã nguồn.

Có thể hình dung mỗi file JavaScript như một phòng ban riêng biệt trong công ty, chỉ chia sẻ dữ liệu khi được cho phép.

---

## 2. File `config.js` (Kho lưu trữ dùng chung)

### Công dụng

Lưu trữ các biến và cấu hình được nhiều file khác cùng sử dụng.

### Biến quan trọng

```javascript
export const appState = {
    map: null,
    mapData: null,
    mapLocked: false
};
```

### Ý nghĩa

* `map`: Đối tượng bản đồ Leaflet.
* `mapData`: Dữ liệu JSON hiện tại.
* `mapLocked`: Trạng thái khóa hoặc mở bản đồ.

### Tại sao dùng `const`?

```javascript
const appState
```

thay vì:

```javascript
let appState
```

hoặc

```javascript
var appState
```

vì:

* Đảm bảo biến `appState` không bị gán lại sang một đối tượng khác.
* Cho phép thay đổi dữ liệu bên trong đối tượng.
* Giảm nguy cơ lỗi trong quá trình phát triển.

Nói cách khác, có thể thay đổi đồ vật trong chiếc hộp nhưng không thể thay chiếc hộp bằng chiếc khác.

---

## 3. File `main.js` (Điểm khởi động hệ thống)

### Công dụng

Là file đầu tiên được nạp khi trang web khởi động.

Nhiệm vụ chính:

* Khởi tạo bản đồ.
* Khởi tạo giao diện.
* Đăng ký các sự kiện cho nút bấm.

### Hàm quan trọng

```javascript
setupEventListeners()
```

### Chức năng

Gắn các sự kiện vào giao diện.

Ví dụ:

```javascript
confirmMapBtn.addEventListener(
    "click",
    confirmMapSelection
);
```

Khi người dùng nhấn nút Confirm Map, chương trình sẽ gọi hàm:

```javascript
confirmMapSelection()
```

trong file `api.js`.

---

## 4. File `map.js` (Bộ phận hiển thị bản đồ)

### Công dụng

Chỉ chứa các đoạn mã liên quan đến thư viện Leaflet (`L`).

### Các hàm chính

#### `initMap()`

Khởi tạo bản đồ.

#### `lockMap()`

Khóa thao tác:

* Zoom
* Kéo thả

#### `unlockMap()`

Mở khóa thao tác bản đồ.

### Hàm hiển thị dữ liệu

#### `renderRoad()`

Đầu vào:

```javascript
coordinates[]
```

Đầu ra:

* Vẽ Polyline lên bản đồ.

#### `renderIntersection()`

Đầu vào:

```javascript
latitude
longitude
```

Đầu ra:

* Vẽ CircleMarker đại diện giao lộ.

### Ảnh hưởng

Sau khi vẽ xong, mỗi đối tượng sẽ được gắn thêm sự kiện:

```javascript
layer.on("click", ...)
```

Khi người dùng nhấn vào đường hoặc giao lộ, dữ liệu sẽ được gửi sang `ui.js` để hiển thị.

---

## 5. File `ui.js` (Quản lý giao diện)

### Công dụng

Điều khiển các thành phần giao diện:

* Hiện hoặc ẩn nút bấm.
* Cập nhật bảng thông tin.
* Hiển thị dữ liệu người dùng đang chọn.

### Hàm quan trọng

#### `updateInfoPanel()`

Đọc dữ liệu từ:

```javascript
appState
```

sau đó tạo nội dung HTML và hiển thị lên Information Panel.

---

#### `checkZoomState()`

Kiểm tra mức độ phóng to của bản đồ.

Ví dụ:

```javascript
map.getZoom() >= 15
```

Nếu đủ điều kiện:

* Bật nút Confirm.

Ngược lại:

* Tắt nút Confirm.

---

## 6. File `api.js` (Giao tiếp dữ liệu và xử lý thuật toán)

### Công dụng

Đây là thành phần quan trọng nhất của Frontend.

Nhiệm vụ:

* Giao tiếp với Overpass API.
* Tiền xử lý dữ liệu.
* Gửi dữ liệu sang Backend.

### Hàm chính

#### `confirmMapSelection()`

### Quy trình xử lý

1. Khóa bản đồ.
2. Lấy Bounding Box.
3. Gửi truy vấn tới Overpass API.
4. Nhận dữ liệu Node và Way.
5. Phân tích giao lộ bằng thuật toán đếm Node.
6. Đóng gói dữ liệu thành JSON chuẩn.
7. Gửi sang Backend.

### Từ khóa quan trọng

```javascript
async
await
```

### Tại sao cần `await`?

Truy cập mạng cần thời gian phản hồi.

Nếu không sử dụng:

```javascript
const data = fetch(...)
```

thì chương trình có thể chạy tiếp khi dữ liệu chưa được tải xong.

Kết quả:

```javascript
undefined
```

hoặc lỗi truy cập dữ liệu.

Sử dụng:

```javascript
await fetch(...)
```

sẽ buộc chương trình chờ đến khi dữ liệu tải xong rồi mới thực hiện bước tiếp theo.

---

# PHẦN 2: LÕI HỆ THỐNG (BACKEND - C++)

Khu vực này chịu trách nhiệm:

* Nhận dữ liệu từ Frontend.
* Lưu trữ xuống ổ cứng.
* Cung cấp API cho toàn hệ thống.

Framework sử dụng:

Crow Framework.

---

## 1. File `main.cpp` (Điểm khởi động Server)

### Công dụng

Chứa:

```cpp
int main()
```

là điểm bắt đầu của chương trình C++.

### Nhiệm vụ

* Tạo đối tượng Server.
* Khởi động Server.

Ví dụ:

```cpp
server.start();
```

Sau khi chạy, chương trình sẽ đứng chờ các HTTP Request từ Frontend.

---

## 2. Lớp `TrafficSimulatorServer`

(`server.h` và `server.cpp`)

### Công dụng

Đóng vai trò Router của hệ thống.

Nhiệm vụ:

* Nhận URL.
* Chuyển Request tới đúng đoạn mã xử lý.

### Hàm quan trọng

```cpp
setupRoutes()
```

### Ví dụ luồng hoạt động

Frontend:

```javascript
fetch("/api/confirm-map")
```

↓

Backend:

```cpp
CROW_ROUTE(app, "/api/confirm-map")
```

### Nhiệm vụ xử lý

* Nhận JSON.
* Chuyển cho FileHandler.
* Trả kết quả về trình duyệt.

Ví dụ:

```cpp
200 OK
```

hoặc

```cpp
500 Internal Server Error
```

### Từ khóa quan trọng

```cpp
[](const crow::request& req,
   crow::response& res)
{
}
```

### Tại sao dùng Lambda?

Cho phép viết logic xử lý ngay tại vị trí khai báo Route.

Ưu điểm:

* Code ngắn gọn.
* Dễ đọc.
* Tương tự cách viết Callback trong JavaScript.

---

## 3. Lớp `FileHandler`

(`FileHandler.h` và `FileHandler.cpp`)

### Công dụng

Là thành phần duy nhất được phép thao tác với file trên ổ cứng.

### Hàm chính

#### `saveMapData()`

Lưu dữ liệu JSON.

#### `loadMapData()`

Đọc dữ liệu JSON.

### Quy trình

1. Xác định đường dẫn file.
2. Mở file bằng Stream.
3. Chuyển đổi giữa JSON và Text.
4. Ghi hoặc đọc dữ liệu.

---

### Từ khóa quan trọng

```cpp
static
```

### Tại sao dùng static?

Cho phép gọi:

```cpp
FileHandler::saveMapData(...)
```

mà không cần:

```cpp
FileHandler handler;
handler.saveMapData(...);
```

Ưu điểm:

* Tiết kiệm bộ nhớ.
* Không cần tạo đối tượng.
* Thích hợp với các hàm tiện ích.

---

### Từ khóa quan trọng thứ hai

```cpp
try
{
}
catch(const std::exception& e)
{
}
```

### Tại sao cần Try-Catch?

Ghi file có thể thất bại do:

* Hết dung lượng ổ cứng.
* Không có quyền truy cập.
* File bị khóa bởi chương trình khác.

Nếu không xử lý ngoại lệ:

* Server có thể bị Crash.

Try-Catch giúp:

* Ghi log lỗi.
* Trả thông báo lỗi phù hợp.
* Tiếp tục phục vụ các Request khác.

---

# TỔNG KẾT LUỒNG HOẠT ĐỘNG HỆ THỐNG

1. Người dùng nhấn nút **Confirm Map** trên giao diện Web.

2. `main.js` bắt sự kiện và gọi:

```javascript
confirmMapSelection()
```

trong `api.js`.

3. `api.js`:

* Lấy Bounding Box.
* Gọi Overpass API.
* Tiền xử lý dữ liệu.
* Tạo JSON chuẩn.

4. `api.js` gửi dữ liệu tới:

```http
POST /api/confirm-map
```

5. `server.cpp` nhận Request thông qua Crow Framework.

6. `server.cpp` chuyển JSON sang `FileHandler.cpp`.

7. `FileHandler.cpp` ghi dữ liệu vào:

```text
data/traffic_network.json
```

8. Ghi thành công → trả về:

```http
HTTP 200 OK
```

9. Frontend nhận phản hồi và chuyển sang giao diện mô phỏng giao thông.
