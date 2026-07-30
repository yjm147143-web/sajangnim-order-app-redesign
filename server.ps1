param(
  # 0이면 '지정 안 됨'으로 보고 PORT 환경변수를 따른다. 실행 환경이 포트를 배정해 주므로
  # 특정 포트를 하드코딩하면 다른 세션이 그 포트를 쓰고 있을 때 기동에 실패한다.
  [int]$Port = 0,
  [string]$Root = $PSScriptRoot
)
if ($Port -eq 0) {
  if ($env:PORT) { $Port = [int]$env:PORT } else { $Port = 8936 }
}
Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"

$mime = @{
  ".html"="text/html"; ".htm"="text/html"; ".js"="application/javascript"; ".css"="text/css";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".svg"="image/svg+xml"; ".json"="application/json"
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $req = $context.Request
  $res = $context.Response
  try {
    $path = $req.Url.AbsolutePath
    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $Root ($path.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar)
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($filePath)
      $ct = $mime[$ext]
      if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [Text.Encoding]::UTF8.GetBytes("Not found: $path")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
