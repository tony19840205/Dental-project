@echo off
echo ========================================
echo 牙科跨院 FHIR 系統 - 本機伺服器啟動
echo ========================================
echo.
echo 正在啟動 HTTP 伺服器於端口 8080...
echo.
echo 請在瀏覽器訪問以下網址：
echo.
echo   http://localhost:8080/dental-ehr.html      (獨立模式)
echo   http://localhost:8080/smart-launcher.html  (SMART Launch 測試)
echo.
echo ========================================
echo.
echo 在衛福部沙盒中使用以下網址：
echo   http://localhost:8080/smart-launcher.html
echo.
echo 按 Ctrl+C 可停止伺服器
echo ========================================
echo.
python -m http.server 8080
